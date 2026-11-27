package sessionguard

import (
	"bufio"
	"context"
	"errors"
	"fmt"
	"io"
	"leon-panel/lib/cache"
	"leon-panel/models"
	"net"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"testing"
	"time"

	redis "github.com/redis/go-redis/v9"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// miniRESPServer implements the minimal RESP2 wire protocol (HELLO/PING/SELECT/HSET/HGET/HDEL/HLEN/HKEYS/DEL/SET/GET/EXISTS)
// so go-redis/v9 and cache.NewRedisCache can be verified over real TCP sockets without an external Redis daemon.
type miniRESPServer struct {
	mu          sync.Mutex
	hashes      map[string]map[string]string
	strings     map[string]string
	failDelKeys map[string]string
	ln          net.Listener
}

func startMiniRESPServer(t *testing.T) (*miniRESPServer, string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &miniRESPServer{
		hashes:      make(map[string]map[string]string),
		strings:     make(map[string]string),
		failDelKeys: make(map[string]string),
		ln:          ln,
	}
	go srv.acceptLoop()
	t.Cleanup(func() { _ = ln.Close() })
	return srv, ln.Addr().String()
}

func (s *miniRESPServer) SetDelError(key string, errMsg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if errMsg == "" {
		delete(s.failDelKeys, key)
		return
	}
	s.failDelKeys[key] = errMsg
}

func (s *miniRESPServer) acceptLoop() {
	for {
		conn, err := s.ln.Accept()
		if err != nil {
			return
		}
		go s.handleConn(conn)
	}
}

func (s *miniRESPServer) handleConn(conn net.Conn) {
	defer conn.Close()
	r := bufio.NewReader(conn)
	for {
		args, err := readRESPCommand(r)
		if err != nil {
			return
		}
		if len(args) == 0 {
			continue
		}
		cmd := strings.ToUpper(args[0])
		s.mu.Lock()
		switch cmd {
		case "HELLO":
			_, _ = conn.Write([]byte("-ERR unknown command 'HELLO'\r\n"))
		case "PING":
			_, _ = conn.Write([]byte("+PONG\r\n"))
		case "SELECT", "CLIENT":
			_, _ = conn.Write([]byte("+OK\r\n"))
		case "HSET":
			if len(args) >= 4 {
				h, ok := s.hashes[args[1]]
				if !ok {
					h = make(map[string]string)
					s.hashes[args[1]] = h
				}
				added := 0
				for i := 2; i+1 < len(args); i += 2 {
					if _, exists := h[args[i]]; !exists {
						added++
					}
					h[args[i]] = args[i+1]
				}
				_, _ = fmt.Fprintf(conn, ":%d\r\n", added)
			} else {
				_, _ = conn.Write([]byte("-ERR wrong number of arguments\r\n"))
			}
		case "HSETNX":
			if len(args) >= 4 {
				h, ok := s.hashes[args[1]]
				if !ok {
					h = make(map[string]string)
					s.hashes[args[1]] = h
				}
				if _, exists := h[args[2]]; exists {
					_, _ = conn.Write([]byte(":0\r\n"))
				} else {
					h[args[2]] = args[3]
					_, _ = conn.Write([]byte(":1\r\n"))
				}
			} else {
				_, _ = conn.Write([]byte("-ERR wrong number of arguments\r\n"))
			}
		case "HGET":
			if len(args) >= 3 {
				if h, ok := s.hashes[args[1]]; ok {
					if val, exists := h[args[2]]; exists {
						_, _ = fmt.Fprintf(conn, "$%d\r\n%s\r\n", len(val), val)
						s.mu.Unlock()
						continue
					}
				}
				_, _ = conn.Write([]byte("$-1\r\n"))
			}
		case "HDEL":
			if len(args) >= 3 {
				removed := 0
				if h, ok := s.hashes[args[1]]; ok {
					for _, field := range args[2:] {
						if _, exists := h[field]; exists {
							delete(h, field)
							removed++
						}
					}
				}
				_, _ = fmt.Fprintf(conn, ":%d\r\n", removed)
			}
		case "HLEN":
			if len(args) >= 2 {
				_, _ = fmt.Fprintf(conn, ":%d\r\n", len(s.hashes[args[1]]))
			}
		case "HKEYS":
			if len(args) >= 2 {
				h := s.hashes[args[1]]
				_, _ = fmt.Fprintf(conn, "*%d\r\n", len(h))
				for k := range h {
					_, _ = fmt.Fprintf(conn, "$%d\r\n%s\r\n", len(k), k)
				}
			}
		case "DEL":
			var injectedErr string
			for _, key := range args[1:] {
				if msg, fail := s.failDelKeys[key]; fail {
					injectedErr = msg
					break
				}
			}
			if injectedErr != "" {
				_, _ = fmt.Fprintf(conn, "-ERR %s\r\n", injectedErr)
				s.mu.Unlock()
				continue
			}
			removed := 0
			for _, key := range args[1:] {
				if _, ok := s.hashes[key]; ok {
					delete(s.hashes, key)
					removed++
				}
				if _, ok := s.strings[key]; ok {
					delete(s.strings, key)
					removed++
				}
			}
			_, _ = fmt.Fprintf(conn, ":%d\r\n", removed)
		case "SET":
			if len(args) >= 3 {
				s.strings[args[1]] = args[2]
				_, _ = conn.Write([]byte("+OK\r\n"))
			}
		case "GET":
			if len(args) >= 2 {
				if val, ok := s.strings[args[1]]; ok {
					_, _ = fmt.Fprintf(conn, "$%d\r\n%s\r\n", len(val), val)
				} else {
					_, _ = conn.Write([]byte("$-1\r\n"))
				}
			}
		default:
			_, _ = fmt.Fprintf(conn, "-ERR unsupported command %s\r\n", cmd)
		}
		s.mu.Unlock()
	}
}

func readRESPCommand(r *bufio.Reader) ([]string, error) {
	line, err := r.ReadString('\n')
	if err != nil {
		return nil, err
	}
	line = strings.TrimSuffix(strings.TrimSuffix(line, "\n"), "\r")
	if line == "" || line[0] != '*' {
		return nil, fmt.Errorf("expected array header, got %q", line)
	}
	count, err := strconv.Atoi(line[1:])
	if err != nil {
		return nil, err
	}
	args := make([]string, 0, count)
	for i := 0; i < count; i++ {
		bulkHeader, err := r.ReadString('\n')
		if err != nil {
			return nil, err
		}
		bulkHeader = strings.TrimSuffix(strings.TrimSuffix(bulkHeader, "\n"), "\r")
		if bulkHeader == "" || bulkHeader[0] != '$' {
			return nil, fmt.Errorf("expected bulk string, got %q", bulkHeader)
		}
		size, err := strconv.Atoi(bulkHeader[1:])
		if err != nil {
			return nil, err
		}
		buf := make([]byte, size+2)
		if _, err := io.ReadFull(r, buf); err != nil {
			return nil, err
		}
		args = append(args, string(buf[:size]))
	}
	return args, nil
}

func TestEnsureLegacySessionRotationIsIdempotentAndStrictlyScopedToRedisPrefix(t *testing.T) {
	_, addr := startMiniRESPServer(t)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Protocol: 2,
	})
	t.Cleanup(func() { _ = rdb.Close() })

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Fatalf("mini redis ping failed: %v", err)
	}

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "rotation.db")), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	u1 := models.User{Username: "admin@leon.local", Password: "p1", Status: 1, Role: 1, Token: "legacy_btoken_admin"}
	u2 := models.User{Username: "alice", Password: "p2", Status: 1, Role: 2, Token: "legacy_btoken_alice"}
	for _, u := range []*models.User{&u1, &u2} {
		if err := db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}

	// Instance A (upgrading) and Instance B + external app sharing the same Redis DB.
	instAUserToken := cache.NewRedisCache[models.User](rdb, "leon_inst_a:UserToken", time.Minute, 0)
	instACUserToken := cache.NewRedisCache[string](rdb, "leon_inst_a:CUserToken", 72*time.Hour, 0)

	instBUserToken := cache.NewRedisCache[models.User](rdb, "leon_inst_b:UserToken", time.Minute, 0)
	instBCUserToken := cache.NewRedisCache[string](rdb, "leon_inst_b:CUserToken", 72*time.Hour, 0)

	instAUserToken.SetDefault("legacy_btoken_admin", u1)
	instACUserToken.SetDefault("ctoken_admin_old", "legacy_btoken_admin")

	instBUserToken.SetDefault("inst_b_btoken", models.User{BaseModel: models.BaseModel{ID: 99}, Status: 1, Token: "inst_b_btoken"})
	instBCUserToken.SetDefault("inst_b_ctoken", "inst_b_btoken")
	if err := rdb.Set(context.Background(), "other_service:key", "keep-me", 0).Err(); err != nil {
		t.Fatal(err)
	}

	// 1. Escape hatch skip=true keeps legacy tokens untouched (layered rollback verification).
	rotated, err := EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, true)
	if err != nil || rotated {
		t.Fatalf("skip=true should not rotate: rotated=%v err=%v", rotated, err)
	}
	if _, ok := instACUserToken.Get("ctoken_admin_old"); !ok {
		t.Fatal("skip=true unexpectedly cleared CUserToken")
	}

	// 2. Old instance stops serving; new instance runs one-time rotation on cutover.
	rotated, err = EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, false)
	if err != nil || !rotated {
		t.Fatalf("expected first rotation to run: rotated=%v err=%v", rotated, err)
	}

	// Verify DB tokens are cleared for all accounts.
	var users []models.User
	if err := db.Order("id").Find(&users).Error; err != nil {
		t.Fatal(err)
	}
	for _, u := range users {
		if u.Token != "" {
			t.Fatalf("user %s still has legacy bToken %q", u.Username, u.Token)
		}
	}

	// Verify Instance A hot caches are cleared.
	if _, ok := instAUserToken.Get("legacy_btoken_admin"); ok {
		t.Fatal("instA UserToken hot cache still holds legacy entry")
	}
	if _, ok := instACUserToken.Get("ctoken_admin_old"); ok {
		t.Fatal("instA CUserToken still holds legacy cToken")
	}

	// Verify Instance B and external Redis namespaces are 100% untouched!
	if _, ok := instBUserToken.Get("inst_b_btoken"); !ok {
		t.Fatal("instB UserToken was wiped by instA rotation")
	}
	if got, ok := instBCUserToken.Get("inst_b_ctoken"); !ok || got != "inst_b_btoken" {
		t.Fatalf("instB CUserToken was wiped: ok=%v got=%q", ok, got)
	}
	if val, err := rdb.Get(context.Background(), "other_service:key").Result(); err != nil || val != "keep-me" {
		t.Fatalf("external redis key affected: val=%q err=%v", val, err)
	}

	// 3. Simulate post-upgrade re-login and a subsequent container restart: second boot MUST NOT re-wipe new sessions!
	if err := db.Model(&models.User{}).Where("id = ?", u1.ID).Update("token", "fresh_crypto_btoken_admin").Error; err != nil {
		t.Fatal(err)
	}
	instACUserToken.SetDefault("ctoken_admin_fresh", "fresh_crypto_btoken_admin")

	rotatedAgain, err := EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, false)
	if err != nil || rotatedAgain {
		t.Fatalf("second startup should be idempotent no-op: rotated=%v err=%v", rotatedAgain, err)
	}
	var refreshedAdmin models.User
	if err := db.First(&refreshedAdmin, "id = ?", u1.ID).Error; err != nil {
		t.Fatal(err)
	}
	if refreshedAdmin.Token != "fresh_crypto_btoken_admin" {
		t.Fatalf("second startup wiped newly issued bToken: %q", refreshedAdmin.Token)
	}
	if got, ok := instACUserToken.Get("ctoken_admin_fresh"); !ok || got != "fresh_crypto_btoken_admin" {
		t.Fatalf("second startup wiped newly issued Redis cToken: ok=%v got=%q", ok, got)
	}
}

func TestEnsureLegacySessionRotationRetriesAfterPartialCacheFlushFailure(t *testing.T) {
	srv, addr := startMiniRESPServer(t)
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Protocol: 2,
	})
	t.Cleanup(func() { _ = rdb.Close() })

	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Fatalf("mini redis ping failed: %v", err)
	}

	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "rotation_retry.db")), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.SystemSetting{}); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	admin := models.User{Username: "admin@leon.local", Password: "p1", Status: 1, Role: 1, Token: "legacy_retry_btoken"}
	if err := db.Create(&admin).Error; err != nil {
		t.Fatal(err)
	}

	instAUserToken := cache.NewRedisCache[models.User](rdb, "inst_a:UserToken", time.Minute, 0)
	instACUserToken := cache.NewRedisCache[string](rdb, "inst_a:CUserToken", 72*time.Hour, 0)
	instBUserToken := cache.NewRedisCache[models.User](rdb, "inst_b:UserToken", time.Minute, 0)
	instBCUserToken := cache.NewRedisCache[string](rdb, "inst_b:CUserToken", 72*time.Hour, 0)

	instAUserToken.SetDefault("legacy_retry_btoken", admin)
	instACUserToken.SetDefault("legacy_retry_ctoken", "legacy_retry_btoken")
	instBUserToken.SetDefault("inst_b_btoken", models.User{BaseModel: models.BaseModel{ID: 77}, Status: 1, Token: "inst_b_btoken"})
	instBCUserToken.SetDefault("inst_b_ctoken", "inst_b_btoken")
	if err := rdb.Set(context.Background(), "foreign_app:state", "untouched", 0).Err(); err != nil {
		t.Fatal(err)
	}

	// Inject partial cache cleanup failure: UserToken DEL succeeds, CUserToken DEL fails!
	srv.SetDelError("inst_a:CUserToken", "READONLY cannot delete CUserToken")

	rotated, err := EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, false)
	if err == nil {
		t.Fatal("expected error when CUserToken Redis DEL fails, got nil")
	}
	if rotated {
		t.Fatal("rotation must NOT report rotated=true on partial cache flush failure")
	}

	// Completion marker MUST NOT be recorded as "1" after partial failure.
	var markerCount int64
	if err := db.Model(&models.SystemSetting{}).
		Where("config_name = ? AND config_value = ?", LegacyBTokenRotationV1Key, "1").
		Count(&markerCount).Error; err != nil {
		t.Fatal(err)
	}
	if markerCount != 0 {
		t.Fatalf("completion marker persisted despite flush failure: count=%d", markerCount)
	}
	// Verify partial state: UserToken was cleared, CUserToken still present, other namespaces untouched.
	if _, ok := instAUserToken.Get("legacy_retry_btoken"); ok {
		t.Fatal("expected UserToken flush to have executed during partial attempt")
	}
	if _, ok := instACUserToken.Get("legacy_retry_ctoken"); !ok {
		t.Fatal("expected failed CUserToken entry to still exist before retry")
	}
	if _, ok := instBUserToken.Get("inst_b_btoken"); !ok {
		t.Fatal("inst_b UserToken was modified during inst_a partial failure")
	}
	if got, ok := instBCUserToken.Get("inst_b_ctoken"); !ok || got != "inst_b_btoken" {
		t.Fatalf("inst_b CUserToken was modified: ok=%v got=%q", ok, got)
	}
	if val, err := rdb.Get(context.Background(), "foreign_app:state").Result(); err != nil || val != "untouched" {
		t.Fatalf("foreign_app key modified: val=%q err=%v", val, err)
	}

	// Clear injected Redis error and simulate service restart -> retry MUST succeed and finish cleanup!
	srv.SetDelError("inst_a:CUserToken", "")

	rotated, err = EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, false)
	if err != nil {
		t.Fatalf("retry after Redis recovery failed: %v", err)
	}
	if !rotated {
		t.Fatal("expected retry after partial failure to complete rotation (rotated=true)")
	}

	if _, ok := instACUserToken.Get("legacy_retry_ctoken"); ok {
		t.Fatal("inst_a CUserToken still holds legacy session after retry")
	}
	if err := db.Model(&models.SystemSetting{}).
		Where("config_name = ? AND config_value = ?", LegacyBTokenRotationV1Key, "1").
		Count(&markerCount).Error; err != nil {
		t.Fatal(err)
	}
	if markerCount != 1 {
		t.Fatalf("expected completion marker after successful retry, got count=%d", markerCount)
	}

	// Other Redis namespaces remain completely untouched after successful retry.
	if _, ok := instBUserToken.Get("inst_b_btoken"); !ok {
		t.Fatal("inst_b UserToken was wiped on retry")
	}
	if got, ok := instBCUserToken.Get("inst_b_ctoken"); !ok || got != "inst_b_btoken" {
		t.Fatalf("inst_b CUserToken was wiped on retry: ok=%v got=%q", ok, got)
	}
	if val, err := rdb.Get(context.Background(), "foreign_app:state").Result(); err != nil || val != "untouched" {
		t.Fatalf("foreign_app key modified on retry: val=%q err=%v", val, err)
	}

	// Next restart after new login is a no-op and preserves fresh sessions.
	if err := db.Model(&models.User{}).Where("id = ?", admin.ID).Update("token", "post_retry_btoken").Error; err != nil {
		t.Fatal(err)
	}
	instACUserToken.SetDefault("post_retry_ctoken", "post_retry_btoken")
	rotatedAgain, err := EnsureLegacySessionRotation(db, instAUserToken, instACUserToken, false)
	if err != nil || rotatedAgain {
		t.Fatalf("post-completion restart should be no-op: rotated=%v err=%v", rotatedAgain, err)
	}
	if got, ok := instACUserToken.Get("post_retry_ctoken"); !ok || got != "post_retry_btoken" {
		t.Fatalf("post-completion restart wiped fresh session: ok=%v got=%q", ok, got)
	}
}

func TestCrossProcessRedisRevocationBlocksHotHitAndLateBackfillAcrossIndependentGuards(t *testing.T) {
	_, addr := startMiniRESPServer(t)

	// Two completely independent "processes": separate TokenGuards (zero shared in-process memory),
	// separate Redis TCP clients, and separate SQLite DB pools sharing the SAME DB file & Redis namespace.
	dbPath := filepath.Join(t.TempDir(), "cross_process.db")
	openDB := func() *gorm.DB {
		db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
			NamingStrategy: schema.NamingStrategy{SingularTable: true},
		})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(func() {
			if sqlDB, err := db.DB(); err == nil {
				_ = sqlDB.Close()
			}
		})
		return db
	}
	dbA := openDB()
	dbB := openDB()
	if err := dbA.AutoMigrate(&models.User{}); err != nil {
		t.Fatal(err)
	}

	rdbA := redis.NewClient(&redis.Options{Addr: addr, Protocol: 2})
	rdbB := redis.NewClient(&redis.Options{Addr: addr, Protocol: 2})
	t.Cleanup(func() {
		_ = rdbA.Close()
		_ = rdbB.Close()
	})

	userTokenA := cache.NewRedisCache[models.User](rdbA, "shared_ns:UserToken", time.Minute, 0)
	cUserTokenA := cache.NewRedisCache[string](rdbA, "shared_ns:CUserToken", 72*time.Hour, 0)
	guardA := NewTokenGuard()

	userTokenB := cache.NewRedisCache[models.User](rdbB, "shared_ns:UserToken", time.Minute, 0)
	cUserTokenB := cache.NewRedisCache[string](rdbB, "shared_ns:CUserToken", 72*time.Hour, 0)
	guardB := NewTokenGuard()

	loadFrom := func(db *gorm.DB) func(string) (models.User, error) {
		return func(tok string) (models.User, error) {
			var u models.User
			err := db.Where("token = ?", tok).First(&u).Error
			return u, err
		}
	}

	// Subtest 1: Process A warms shared Redis cache; Process B revokes in DB + shared Redis;
	// Process A's very next hot-cache read MUST reject immediately without sharing any Go memory with Process B.
	t.Run("HotCacheHit_CrossProcessRevocation", func(t *testing.T) {
		alice := models.User{Username: "alice_xp", Password: "h1", Name: "Alice XP", Role: 2, Status: 1, Token: "xp_alice_btoken"}
		if err := dbA.Create(&alice).Error; err != nil {
			t.Fatal(err)
		}
		cUserTokenA.SetDefault("xp_alice_ctoken", alice.Token)

		// Process A resolves and populates shared Redis UserToken cache.
		got, status, err := guardA.ResolveTokenUser(userTokenA, cUserTokenA, "xp_alice_ctoken", alice.Token, loadFrom(dbA))
		if err != nil || status != TokenResolveActive || got.ID != alice.ID {
			t.Fatalf("Process A initial auth failed: got=%+v status=%v err=%v", got, status, err)
		}

		// Process B revokes Alice in DB and writes shared Redis tombstone using independent guardB.
		if err := dbB.Model(&models.User{}).Where("id = ?", alice.ID).Updates(map[string]interface{}{
			"status": 2,
			"token":  "",
		}).Error; err != nil {
			t.Fatal(err)
		}
		guardB.RevokeToken(userTokenB, alice.Token)

		// Process A immediately calls ResolveTokenUser -> must reject via shared Redis tombstone!
		_, statusAfter, errAfter := guardA.ResolveTokenUser(userTokenA, cUserTokenA, "xp_alice_ctoken", alice.Token, loadFrom(dbA))
		if errAfter != nil || statusAfter != TokenResolveInvalid {
			t.Fatalf("Process A hot-cache check accepted cross-process revoked user: status=%v err=%v", statusAfter, errAfter)
		}
		if _, stillMapped := cUserTokenB.Get("xp_alice_ctoken"); stillMapped {
			t.Fatal("revoked cToken mapping was not removed from shared CUserToken")
		}
	})

	// Subtest 2: Cold cache on Process A -> Process A queries DB and pauses right before backfill ->
	// Process B revokes in DB + writes shared Redis tombstone -> Process A resumes HSETNX backfill ->
	// MUST NOT overwrite tombstone, MUST reject paused request AND all subsequent requests on BOTH processes!
	t.Run("ConcurrentLateBackfill_CrossProcessRevocation", func(t *testing.T) {
		bob := models.User{Username: "bob_xp", Password: "h2", Name: "Bob XP", Role: 2, Status: 1, Token: "xp_bob_btoken"}
		if err := dbA.Create(&bob).Error; err != nil {
			t.Fatal(err)
		}
		cUserTokenA.SetDefault("xp_bob_ctoken", bob.Token)

		dbLoaded := make(chan struct{})
		releaseBackfill := make(chan struct{})
		var once sync.Once
		restore := guardA.SetAfterDBLookupHookForTest(func(bToken string) {
			if bToken == bob.Token {
				once.Do(func() { close(dbLoaded) })
				<-releaseBackfill
			}
		})
		defer restore()

		type resolveRes struct {
			status TokenResolveStatus
			err    error
		}
		doneA := make(chan resolveRes, 1)
		go func() {
			_, st, err := guardA.ResolveTokenUser(userTokenA, cUserTokenA, "xp_bob_ctoken", bob.Token, loadFrom(dbA))
			doneA <- resolveRes{status: st, err: err}
		}()

		// Wait until Process A has loaded Bob's active pre-revocation snapshot from DB.
		<-dbLoaded

		// Independent Process B revokes Bob in DB and writes revocation tombstone to shared Redis.
		if err := dbB.Model(&models.User{}).Where("id = ?", bob.ID).Updates(map[string]interface{}{
			"status": 2,
			"token":  "",
		}).Error; err != nil {
			t.Fatal(err)
		}
		guardB.RevokeToken(userTokenB, bob.Token)

		// Release Process A to attempt late cache backfill via HSETNX against shared Redis.
		close(releaseBackfill)
		resA := <-doneA
		if resA.err != nil || resA.status != TokenResolveInvalid {
			t.Fatalf("Process A late backfill succeeded after cross-process revocation: status=%v err=%v", resA.status, resA.err)
		}

		// Verify shared Redis STILL holds tombstone (NOT active Bob!).
		cached, hit := userTokenB.Get(bob.Token)
		if !hit || !IsRevokedTombstone(cached) || IsActiveTokenUser(cached) {
			t.Fatalf("shared Redis entry corrupted by late backfill: hit=%v cached=%+v", hit, cached)
		}

		// Follow-up resolution on BOTH Process A and Process B must reject.
		if _, stA, errA := guardA.ResolveTokenUser(userTokenA, cUserTokenA, "xp_bob_ctoken", bob.Token, loadFrom(dbA)); errA != nil || stA != TokenResolveInvalid {
			t.Fatalf("follow-up Process A accepted revoked Bob: status=%v err=%v", stA, errA)
		}
		if _, stB, errB := guardB.ResolveTokenUser(userTokenB, cUserTokenB, "xp_bob_ctoken", bob.Token, loadFrom(dbB)); errB != nil || stB != TokenResolveInvalid {
			t.Fatalf("follow-up Process B accepted revoked Bob: status=%v err=%v", stB, errB)
		}
	})
}

func TestTransientLookupErrorDoesNotPoisonTokenAndRecovers(t *testing.T) {
	userCache := cache.NewGoCache[models.User](time.Minute, time.Hour)
	cCache := cache.NewGoCache[string](72*time.Hour, 48*time.Hour)
	guard := NewTokenGuard()

	activeUser := models.User{
		BaseModel: models.BaseModel{ID: 42},
		Username:  "transient_user",
		Status:    1,
		Role:      2,
		Token:     "stable_btoken_42",
	}
	cCache.SetDefault("ctoken_42", activeUser.Token)

	transientErr := errors.New("driver: bad connection")
	_, status, err := guard.ResolveTokenUser(userCache, cCache, "ctoken_42", activeUser.Token, func(string) (models.User, error) {
		return models.User{}, transientErr
	})
	if status != TokenResolveTransientError || !errors.Is(err, transientErr) {
		t.Fatalf("expected TokenResolveTransientError, got status=%v err=%v", status, err)
	}
	if guard.IsTokenRevoked(userCache, activeUser.Token) {
		t.Fatal("transient DB error erroneously marked bToken as revoked")
	}
	if gotTok, ok := cCache.Get("ctoken_42"); !ok || gotTok != activeUser.Token {
		t.Fatalf("transient DB error erroneously deleted cToken mapping: ok=%v got=%q", ok, gotTok)
	}

	// Once DB recovers, resolving the exact same bToken succeeds cleanly.
	gotUser, statusOK, errOK := guard.ResolveTokenUser(userCache, cCache, "ctoken_42", activeUser.Token, func(string) (models.User, error) {
		return activeUser, nil
	})
	if errOK != nil || statusOK != TokenResolveActive || gotUser.ID != activeUser.ID {
		t.Fatalf("expected recovery after transient error, got user=%+v status=%v err=%v", gotUser, statusOK, errOK)
	}
}
