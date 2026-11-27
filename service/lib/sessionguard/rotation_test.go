package sessionguard

import (
	"bufio"
	"context"
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
	mu      sync.Mutex
	hashes  map[string]map[string]string
	strings map[string]string
	ln      net.Listener
}

func startMiniRESPServer(t *testing.T) (*miniRESPServer, string) {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	srv := &miniRESPServer{
		hashes:  make(map[string]map[string]string),
		strings: make(map[string]string),
		ln:      ln,
	}
	go srv.acceptLoop()
	t.Cleanup(func() { _ = ln.Close() })
	return srv, ln.Addr().String()
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
