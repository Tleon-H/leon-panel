package router

import (
	"bytes"
	"encoding/json"
	"fmt"
	"leon-panel/global"
	"leon-panel/lib/cache"
	"leon-panel/lib/cmn"
	"leon-panel/lib/cmn/systemSetting"
	"leon-panel/lib/language"
	"leon-panel/lib/sessionguard"
	"leon-panel/models"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type syncLogBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (s *syncLogBuffer) Write(p []byte) (int, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.Write(p)
}

func (s *syncLogBuffer) Sync() error { return nil }

func (s *syncLogBuffer) String() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.buf.String()
}

type pr1aTestEnv struct {
	engine *gin.Engine
	db     *gorm.DB
	logs   *syncLogBuffer
}

func setupPR1AEnv(t *testing.T) *pr1aTestEnv {
	t.Helper()
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "pr1a_router.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(
		&models.User{},
		&models.SystemSetting{},
		&models.ItemIcon{},
		&models.ItemIconGroup{},
		&models.UserConfig{},
		&models.ModuleConfig{},
		&models.File{},
	); err != nil {
		t.Fatal(err)
	}

	prevDb := global.Db
	prevModelsDb := models.Db
	prevUserToken := global.UserToken
	prevCUserToken := global.CUserToken
	prevSysSetting := global.SystemSetting
	prevLogger := global.Logger
	prevLang := global.Lang

	logBuf := &syncLogBuffer{}
	encCfg := zap.NewDevelopmentEncoderConfig()
	core := zapcore.NewCore(zapcore.NewConsoleEncoder(encCfg), logBuf, zapcore.DebugLevel)
	global.Logger = zap.New(core).Sugar()

	global.Db = db
	models.Db = db
	global.UserToken = cache.NewGoCache[models.User](time.Minute, time.Hour)
	global.CUserToken = cache.NewGoCache[string](72*time.Hour, 48*time.Hour)
	global.SystemSetting = &systemSetting.SystemSettingCache{
		Cache: cache.NewGoCache[interface{}](5*time.Hour, 0),
	}
	langFile := filepath.Join(tempDir, "zh-cn.ini")
	if err := cmn.AssetsTakeFileToPath("lang/zh-cn.ini", langFile); err != nil {
		t.Fatal(err)
	}
	global.Lang = language.NewLang(langFile)

	t.Cleanup(func() {
		global.Db = prevDb
		models.Db = prevModelsDb
		global.UserToken = prevUserToken
		global.CUserToken = prevCUserToken
		global.SystemSetting = prevSysSetting
		global.Logger = prevLogger
		global.Lang = prevLang
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})

	webPath, uploadPath := siteFixture(t)
	engine := NewEngine(webPath, uploadPath)

	return &pr1aTestEnv{
		engine: engine,
		db:     db,
		logs:   logBuf,
	}
}

func (e *pr1aTestEnv) postJSON(t *testing.T, path string, token string, body string) (string, map[string]interface{}) {
	t.Helper()
	req := httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("token", token)
	}
	rec := httptest.NewRecorder()
	e.engine.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("POST %s status = %d body = %s", path, rec.Code, rec.Body.String())
	}
	var resp map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("POST %s invalid JSON %q: %v", path, rec.Body.String(), err)
	}
	return rec.Body.String(), resp
}

func assertNoSensitiveUserFields(t *testing.T, contextLabel string, rawJSON string, forbiddenLiterals ...string) {
	t.Helper()
	for _, forbiddenKey := range []string{`"password"`, `"referralCode"`} {
		if strings.Contains(rawJSON, forbiddenKey) {
			t.Fatalf("%s leaked key %s in response: %s", contextLabel, forbiddenKey, rawJSON)
		}
	}
	for _, secret := range forbiddenLiterals {
		if secret != "" && strings.Contains(rawJSON, secret) {
			t.Fatalf("%s leaked secret literal %q in response: %s", contextLabel, secret, rawJSON)
		}
	}
}

func TestPR1AAdminEndpointsVsPublicHomepageRoleAccessAndExplicitFields(t *testing.T) {
	env := setupPR1AEnv(t)

	adminPassHash := cmn.PasswordEncryption("adminPass123")
	memberPassHash := cmn.PasswordEncryption("memberPass123")
	admin := models.User{
		Username:     "admin@leon.local",
		Password:     adminPassHash,
		Name:         "Admin",
		Status:       1,
		Role:         1,
		Mail:         "admin@leon.local",
		ReferralCode: "ADMREF01",
	}
	member := models.User{
		Username:     "member01",
		Password:     memberPassHash,
		Name:         "Member One",
		Status:       1,
		Role:         2,
		Mail:         "member@leon.local",
		ReferralCode: "MEMREF02",
	}
	for _, u := range []*models.User{&admin, &member} {
		if err := env.db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}

	// Sign in both accounts via real /api/login.
	rawAdminLogin, adminLogin := env.postJSON(t, "/api/login", "", `{"username":"admin@leon.local","password":"adminPass123"}`)
	if adminLogin["code"] != float64(0) {
		t.Fatalf("admin login failed: %s", rawAdminLogin)
	}
	adminData := adminLogin["data"].(map[string]interface{})
	adminCToken := adminData["token"].(string)

	rawMemberLogin, memberLogin := env.postJSON(t, "/api/login", "", `{"username":"member01","password":"memberPass123"}`)
	if memberLogin["code"] != float64(0) {
		t.Fatalf("member login failed: %s", rawMemberLogin)
	}
	memberData := memberLogin["data"].(map[string]interface{})
	memberCToken := memberData["token"].(string)

	// Load generated persistent bTokens from DB to verify they never appear in responses or logs.
	var dbAdmin, dbMember models.User
	if err := env.db.First(&dbAdmin, "id = ?", admin.ID).Error; err != nil {
		t.Fatal(err)
	}
	if err := env.db.First(&dbMember, "id = ?", member.ID).Error; err != nil {
		t.Fatal(err)
	}
	if len(dbAdmin.Token) != 32 || dbAdmin.Token == adminCToken {
		t.Fatalf("unexpected persistent bToken for admin: %q", dbAdmin.Token)
	}
	assertNoSensitiveUserFields(t, "admin /api/login", rawAdminLogin, adminPassHash, dbAdmin.Token, "ADMREF01")
	assertNoSensitiveUserFields(t, "member /api/login", rawMemberLogin, memberPassHash, dbMember.Token, "MEMREF02")

	// Configure member as the Public Visit User (as Admin).
	_, setPubResp := env.postJSON(t, "/api/panel/users/setPublicVisitUser", adminCToken, fmt.Sprintf(`{"userId":%d}`, member.ID))
	if setPubResp["code"] != float64(0) {
		t.Fatalf("setPublicVisitUser failed: %#v", setPubResp)
	}

	// 1. Distinguish Admin User Management Endpoints: anonymous visitors (1000) and regular members (1005) MUST be denied!
	adminRoutes := []struct {
		path string
		body string
	}{
		{"/api/panel/users/getPublicVisitUser", `{}`},
		{"/api/panel/users/getList", `{"page":1,"limit":10}`},
		{"/api/panel/users/update", fmt.Sprintf(`{"id":%d,"username":"member01","name":"Tamper","role":1}`, member.ID)},
		{"/api/panel/users/setPublicVisitUser", `{"userId":null}`},
	}
	for _, rt := range adminRoutes {
		_, anonResp := env.postJSON(t, rt.path, "", rt.body)
		if anonResp["code"] != float64(1000) {
			t.Fatalf("anonymous visitor on %s expected 1000, got %#v", rt.path, anonResp)
		}
		_, memResp := env.postJSON(t, rt.path, memberCToken, rt.body)
		if memResp["code"] != float64(1005) {
			t.Fatalf("regular member on %s expected 1005, got %#v", rt.path, memResp)
		}
	}

	// 2. Admin calling getPublicVisitUser, getList, and update succeeds AND exposes ONLY explicit allowed fields (never password, token/bToken, or referralCode).
	rawPubUser, pubUserResp := env.postJSON(t, "/api/panel/users/getPublicVisitUser", adminCToken, `{}`)
	if pubUserResp["code"] != float64(0) {
		t.Fatalf("admin getPublicVisitUser failed: %s", rawPubUser)
	}
	if strings.Contains(rawPubUser, `"token"`) {
		t.Fatalf("getPublicVisitUser leaked token field: %s", rawPubUser)
	}
	assertNoSensitiveUserFields(t, "admin getPublicVisitUser", rawPubUser, memberPassHash, dbMember.Token, "MEMREF02")

	rawList, listResp := env.postJSON(t, "/api/panel/users/getList", adminCToken, `{"page":1,"limit":10}`)
	if listResp["code"] != float64(0) {
		t.Fatalf("admin getList failed: %s", rawList)
	}
	if strings.Contains(rawList, `"token"`) {
		t.Fatalf("admin getList leaked token field: %s", rawList)
	}
	assertNoSensitiveUserFields(t, "admin getList", rawList, adminPassHash, memberPassHash, dbAdmin.Token, dbMember.Token, "ADMREF01", "MEMREF02")

	rawUpdate, updateResp := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
		`{"id":%d,"username":"member01","name":"Member Updated","role":2,"password":""}`,
		member.ID,
	))
	if updateResp["code"] != float64(0) {
		t.Fatalf("admin update failed: %s", rawUpdate)
	}
	if strings.Contains(rawUpdate, `"token"`) {
		t.Fatalf("admin update leaked token field: %s", rawUpdate)
	}
	assertNoSensitiveUserFields(t, "admin update", rawUpdate, memberPassHash, dbMember.Token, "MEMREF02")

	// 3. Public Homepage endpoints (anonymous visitor via PublicModeInterceptor) return only safe public profile & groups.
	rawPublicAuth, publicAuthResp := env.postJSON(t, "/api/user/getAuthInfo", "", `{}`)
	if publicAuthResp["code"] != float64(0) {
		t.Fatalf("public getAuthInfo failed: %s", rawPublicAuth)
	}
	if strings.Contains(rawPublicAuth, `"token"`) {
		t.Fatalf("public getAuthInfo leaked token field: %s", rawPublicAuth)
	}
	assertNoSensitiveUserFields(t, "public getAuthInfo", rawPublicAuth, memberPassHash, dbMember.Token, "MEMREF02")

	rawPublicGroups, publicGroupsResp := env.postJSON(t, "/api/panel/itemIconGroup/getList", "", `{"includeItems":true}`)
	if publicGroupsResp["code"] != float64(0) {
		t.Fatalf("public itemIconGroup/getList failed: %s", rawPublicGroups)
	}
	if strings.Contains(rawPublicGroups, `"user":`) || strings.Contains(rawPublicGroups, `"token"`) {
		t.Fatalf("public itemIconGroup/getList leaked nested user/token: %s", rawPublicGroups)
	}

	// 4. Verify debug logs contain ZERO cTokens, bTokens, or password hashes!
	logText := env.logs.String()
	for _, secret := range []string{adminCToken, memberCToken, dbAdmin.Token, dbMember.Token, adminPassHash, memberPassHash} {
		if secret != "" && strings.Contains(logText, secret) {
			t.Fatalf("debug log leaked credential %q:\n%s", secret, logText)
		}
	}
}

func TestPR1AHotCacheRevocationPublicFallbackReenableAndPostCutoverSessionRotation(t *testing.T) {
	env := setupPR1AEnv(t)

	admin := models.User{
		Username: "admin@leon.local",
		Password: cmn.PasswordEncryption("adminPass123"),
		Name:     "Admin",
		Status:   1,
		Role:     1,
	}
	member := models.User{
		Username: "alice01",
		Password: cmn.PasswordEncryption("alicePass123"),
		Name:     "Alice",
		Status:   1,
		Role:     2,
	}
	bob := models.User{
		Username: "bob0002",
		Password: cmn.PasswordEncryption("bobPass123"),
		Name:     "Bob",
		Status:   1,
		Role:     2,
	}
	pubAccount := models.User{
		Username: "public_showcase",
		Password: cmn.PasswordEncryption("pubPass123"),
		Name:     "Public Showcase",
		Status:   1,
		Role:     2,
	}
	for _, u := range []*models.User{&admin, &member, &bob, &pubAccount} {
		if err := env.db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}
	if err := env.db.Create(&models.UserConfig{UserId: bob.ID, PanelJson: `{"logoText":"Bob"}`}).Error; err != nil {
		t.Fatal(err)
	}

	login := func(username, password string) (string, map[string]interface{}) {
		t.Helper()
		_, resp := env.postJSON(t, "/api/login", "", fmt.Sprintf(`{"username":%q,"password":%q}`, username, password))
		if resp["code"] != float64(0) {
			return "", resp
		}
		tok := resp["data"].(map[string]interface{})["token"].(string)
		return tok, resp
	}

	adminCToken, _ := login("admin@leon.local", "adminPass123")
	aliceCToken, _ := login("alice01", "alicePass123")
	bobCToken, _ := login("bob0002", "bobPass123")

	// Set Public Showcase as public visit user.
	_, setPub := env.postJSON(t, "/api/panel/users/setPublicVisitUser", adminCToken, fmt.Sprintf(`{"userId":%d}`, pubAccount.ID))
	if setPub["code"] != float64(0) {
		t.Fatalf("setPublicVisitUser: %#v", setPub)
	}

	// Warm up UserToken hot cache for both Alice and Bob by making authenticated requests.
	for _, tok := range []string{adminCToken, aliceCToken, bobCToken} {
		_, infoResp := env.postJSON(t, "/api/user/getInfo", tok, `{}`)
		if infoResp["code"] != float64(0) {
			t.Fatalf("warm cache getInfo failed: %#v", infoResp)
		}
	}
	var aliceDB models.User
	_ = env.db.First(&aliceDB, "id = ?", member.ID)
	if _, cached := global.UserToken.Get(aliceDB.Token); !cached {
		t.Fatal("expected Alice to be present in hot UserToken cache")
	}

	// 1. Even if UserToken cache artificially holds a stale Status=2 struct (cache-hit branch test) OR Admin disables Alice via API:
	// First verify direct cache-hit branch rejects Status != 1 immediately.
	staleUser := aliceDB
	staleUser.Status = 2
	global.UserToken.SetDefault(aliceDB.Token, staleUser)
	_, hitReject := env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
	if hitReject["code"] != float64(1001) {
		t.Fatalf("LoginInterceptor cache-hit branch failed to reject Status=2: %#v", hitReject)
	}

	// Re-login Alice to restore active hot cache, then disable Alice via Admin /api/panel/users/update.
	aliceCToken, _ = login("alice01", "alicePass123")
	_, _ = env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
	_, disableAlice := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
		`{"id":%d,"username":"alice01","name":"Alice","role":2,"status":2}`,
		member.ID,
	))
	if disableAlice["code"] != float64(0) {
		t.Fatalf("admin disable Alice failed: %#v", disableAlice)
	}

	// Immediate revocation check (< 1m TTL): LoginInterceptor rejects Alice's cToken immediately!
	_, afterDisable := env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
	if afterDisable["code"] != float64(1001) {
		t.Fatalf("disabled Alice token still accepted on LoginInterceptor: %#v", afterDisable)
	}

	// PublicModeInterceptor fallback check: sending disabled Alice's cToken must NOT return Alice's private account —
	// it must fall back to Public Showcase (visitMode = 1)!
	_, pubFallback := env.postJSON(t, "/api/user/getAuthInfo", aliceCToken, `{}`)
	if pubFallback["code"] != float64(0) {
		t.Fatalf("expected fallback to active public user, got: %#v", pubFallback)
	}
	pubData := pubFallback["data"].(map[string]interface{})
	pubUser := pubData["user"].(map[string]interface{})
	if pubUser["id"] != float64(pubAccount.ID) || pubData["visitMode"] != float64(1) {
		t.Fatalf("disabled token did not fall back to public user: %#v", pubData)
	}

	// 2. Disable -> Re-enable lifecycle: Alice cannot log in while disabled (1004);
	// after re-enabling (status: 1), old aliceCToken stays dead (1001), while fresh login succeeds!
	_, disabledLogin := login("alice01", "alicePass123")
	if disabledLogin["code"] != float64(1004) {
		t.Fatalf("expected 1004 for disabled login, got: %#v", disabledLogin)
	}
	_, reenableAlice := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
		`{"id":%d,"username":"alice01","name":"Alice","role":2,"status":1}`,
		member.ID,
	))
	if reenableAlice["code"] != float64(0) {
		t.Fatalf("admin re-enable Alice failed: %#v", reenableAlice)
	}
	_, oldTokenAfterReenable := env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
	if oldTokenAfterReenable["code"] != float64(1001) {
		t.Fatalf("old cToken resurrected after re-enable: %#v", oldTokenAfterReenable)
	}
	newAliceCToken, reloginResp := login("alice01", "alicePass123")
	if reloginResp["code"] != float64(0) || newAliceCToken == "" || newAliceCToken == aliceCToken {
		t.Fatalf("re-enabled Alice failed fresh login: %#v", reloginResp)
	}

	// 3. Disabling the Public Visit User itself must immediately stop PublicModeInterceptor from serving public data!
	_, disablePub := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
		`{"id":%d,"username":"public_showcase","name":"Public Showcase","role":2,"status":2}`,
		pubAccount.ID,
	))
	if disablePub["code"] != float64(0) {
		t.Fatalf("disable public account failed: %#v", disablePub)
	}
	_, anonWhenPubDisabled := env.postJSON(t, "/api/user/getAuthInfo", "", `{}`)
	if anonWhenPubDisabled["code"] != float64(1001) {
		t.Fatalf("disabled public visit account still served to anonymous visitor: %#v", anonWhenPubDisabled)
	}

	// 4. Deleting Bob immediately revokes Bob's hot-cached token AND deletes Bob's UserConfig;
	// attempting to disable or delete the last active admin is blocked (1201).
	_, delBob := env.postJSON(t, "/api/panel/users/deletes", adminCToken, fmt.Sprintf(`{"userIds":[%d]}`, bob.ID))
	if delBob["code"] != float64(0) {
		t.Fatalf("delete Bob failed: %#v", delBob)
	}
	_, bobAfterDel := env.postJSON(t, "/api/user/getInfo", bobCToken, `{}`)
	if bobAfterDel["code"] != float64(1001) {
		t.Fatalf("deleted Bob hot-cached token still accepted: %#v", bobAfterDel)
	}
	var bobCfgCount int64
	_ = env.db.Model(&models.UserConfig{}).Where("user_id = ?", bob.ID).Count(&bobCfgCount)
	if bobCfgCount != 0 {
		t.Fatalf("deleted user's UserConfig was not cleaned up: count=%d", bobCfgCount)
	}

	_, disableLastAdmin := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
		`{"id":%d,"username":"admin@leon.local","name":"Admin","role":1,"status":2}`,
		admin.ID,
	))
	if disableLastAdmin["code"] != float64(1201) {
		t.Fatalf("expected 1201 when disabling last active admin, got: %#v", disableLastAdmin)
	}

	// 5. Post-cutover Option A one-time session rotation with hot caches active (simulating old instance stopped -> new boot):
	// Warm Alice's new token in UserToken cache first.
	_, warmAlice := env.postJSON(t, "/api/user/getInfo", newAliceCToken, `{}`)
	if warmAlice["code"] != float64(0) {
		t.Fatalf("warm Alice failed: %#v", warmAlice)
	}
	rotated, err := sessionguard.EnsureLegacySessionRotation(env.db, global.UserToken, global.CUserToken, false)
	if err != nil || !rotated {
		t.Fatalf("cutover rotation failed: rotated=%v err=%v", rotated, err)
	}
	_, adminAfterRotate := env.postJSON(t, "/api/user/getInfo", adminCToken, `{}`)
	_, aliceAfterRotate := env.postJSON(t, "/api/user/getInfo", newAliceCToken, `{}`)
	if adminAfterRotate["code"] != float64(1001) || aliceAfterRotate["code"] != float64(1001) {
		t.Fatalf("pre-rotation hot sessions survived cutover rotation: admin=%#v alice=%#v", adminAfterRotate, aliceAfterRotate)
	}

	// Fresh login after rotation works seamlessly and survives subsequent idempotent startup checks!
	postRotateAdminToken, postLogin := login("admin@leon.local", "adminPass123")
	if postLogin["code"] != float64(0) {
		t.Fatalf("login after rotation failed: %#v", postLogin)
	}
	rotatedSecondBoot, err := sessionguard.EnsureLegacySessionRotation(env.db, global.UserToken, global.CUserToken, false)
	if err != nil || rotatedSecondBoot {
		t.Fatalf("second boot should not re-rotate: rotated=%v err=%v", rotatedSecondBoot, err)
	}
	_, checkSurvives := env.postJSON(t, "/api/user/getInfo", postRotateAdminToken, `{}`)
	if checkSurvives["code"] != float64(0) {
		t.Fatalf("post-rotation session lost on second boot check: %#v", checkSurvives)
	}
}

func TestPR1AConcurrentCacheBackfillCannotResurrectRevokedSessionOnBothAuthEntrypoints(t *testing.T) {
	env := setupPR1AEnv(t)

	admin := models.User{
		Username: "admin@leon.local",
		Password: cmn.PasswordEncryption("adminPass123"),
		Name:     "Admin",
		Status:   1,
		Role:     1,
	}
	alice := models.User{
		Username: "alice_race",
		Password: cmn.PasswordEncryption("alicePass123"),
		Name:     "Alice Race",
		Status:   1,
		Role:     2,
	}
	bob := models.User{
		Username: "bob_race",
		Password: cmn.PasswordEncryption("bobPass123"),
		Name:     "Bob Race",
		Status:   1,
		Role:     2,
	}
	carol := models.User{
		Username: "carol_race",
		Password: cmn.PasswordEncryption("carolPass123"),
		Name:     "Carol Race",
		Status:   1,
		Role:     2,
	}
	pubAccount := models.User{
		Username: "public_race",
		Password: cmn.PasswordEncryption("pubPass123"),
		Name:     "Public Race",
		Status:   1,
		Role:     2,
	}
	for _, u := range []*models.User{&admin, &alice, &bob, &carol, &pubAccount} {
		if err := env.db.Create(u).Error; err != nil {
			t.Fatal(err)
		}
	}

	login := func(username, password string) string {
		t.Helper()
		_, resp := env.postJSON(t, "/api/login", "", fmt.Sprintf(`{"username":%q,"password":%q}`, username, password))
		if resp["code"] != float64(0) {
			t.Fatalf("login %s failed: %#v", username, resp)
		}
		return resp["data"].(map[string]interface{})["token"].(string)
	}

	adminCToken := login("admin@leon.local", "adminPass123")
	_, setPub := env.postJSON(t, "/api/panel/users/setPublicVisitUser", adminCToken, fmt.Sprintf(`{"userId":%d}`, pubAccount.ID))
	if setPub["code"] != float64(0) {
		t.Fatalf("setPublicVisitUser failed: %#v", setPub)
	}

	// Subtest 1: LoginInterceptor (/api/user/getInfo) — concurrent disable (UsersApi.Update)
	t.Run("LoginInterceptor_DisableRace", func(t *testing.T) {
		aliceCToken := login("alice_race", "alicePass123")
		var aliceDB models.User
		if err := env.db.First(&aliceDB, "id = ?", alice.ID).Error; err != nil {
			t.Fatal(err)
		}
		aliceBToken := aliceDB.Token
		global.UserToken.Delete(aliceBToken) // Force DB lookup path.

		dbLoaded := make(chan struct{})
		releaseBackfill := make(chan struct{})
		var once sync.Once
		restore := sessionguard.SetAfterDBLookupHookForTest(func(bToken string) {
			if bToken == aliceBToken {
				once.Do(func() { close(dbLoaded) })
				<-releaseBackfill
			}
		})
		defer restore()

		type callResult struct {
			resp map[string]interface{}
		}
		done := make(chan callResult, 1)
		go func() {
			_, resp := env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
			done <- callResult{resp: resp}
		}()

		// Wait until LoginInterceptor has loaded Alice's pre-revocation active snapshot from DB and paused before backfill.
		<-dbLoaded

		// Revoke Alice via Admin disable while LoginInterceptor holds stale active snapshot.
		_, disableResp := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
			`{"id":%d,"username":"alice_race","name":"Alice Race","role":2,"status":2}`,
			alice.ID,
		))
		if disableResp["code"] != float64(0) {
			t.Fatalf("disable Alice failed: %#v", disableResp)
		}

		// Release the paused LoginInterceptor goroutine to attempt late cache backfill.
		close(releaseBackfill)
		res := <-done
		if res.resp["code"] != float64(1001) {
			t.Fatalf("expected paused LoginInterceptor request to reject with 1001 after revocation, got: %#v", res.resp)
		}
		if _, resurrected := global.UserToken.Get(aliceBToken); resurrected {
			t.Fatal("stale snapshot resurrected disabled Alice in UserToken hot cache")
		}

		// Subsequent request with Alice's cToken must also fail with 1001.
		_, followUp := env.postJSON(t, "/api/user/getInfo", aliceCToken, `{}`)
		if followUp["code"] != float64(1001) {
			t.Fatalf("follow-up request accepted revoked Alice token: %#v", followUp)
		}
	})

	// Subtest 2: LoginInterceptor (/api/user/getInfo) — concurrent delete (UsersApi.Deletes)
	t.Run("LoginInterceptor_DeleteRace", func(t *testing.T) {
		bobCToken := login("bob_race", "bobPass123")
		var bobDB models.User
		if err := env.db.First(&bobDB, "id = ?", bob.ID).Error; err != nil {
			t.Fatal(err)
		}
		bobBToken := bobDB.Token
		global.UserToken.Delete(bobBToken)

		dbLoaded := make(chan struct{})
		releaseBackfill := make(chan struct{})
		var once sync.Once
		restore := sessionguard.SetAfterDBLookupHookForTest(func(bToken string) {
			if bToken == bobBToken {
				once.Do(func() { close(dbLoaded) })
				<-releaseBackfill
			}
		})
		defer restore()

		done := make(chan map[string]interface{}, 1)
		go func() {
			_, resp := env.postJSON(t, "/api/user/getInfo", bobCToken, `{}`)
			done <- resp
		}()

		<-dbLoaded

		_, delResp := env.postJSON(t, "/api/panel/users/deletes", adminCToken, fmt.Sprintf(`{"userIds":[%d]}`, bob.ID))
		if delResp["code"] != float64(0) {
			t.Fatalf("delete Bob failed: %#v", delResp)
		}

		close(releaseBackfill)
		racedResp := <-done
		if racedResp["code"] != float64(1001) {
			t.Fatalf("expected paused LoginInterceptor request to reject with 1001 after deletion, got: %#v", racedResp)
		}
		if _, resurrected := global.UserToken.Get(bobBToken); resurrected {
			t.Fatal("stale snapshot resurrected deleted Bob in UserToken hot cache")
		}

		_, followUp := env.postJSON(t, "/api/user/getInfo", bobCToken, `{}`)
		if followUp["code"] != float64(1001) {
			t.Fatalf("follow-up request accepted deleted Bob token: %#v", followUp)
		}
	})

	// Subtest 3: PublicModeInterceptor (/api/user/getAuthInfo) — concurrent token reset / disable must NOT resurrect Carol's private session
	t.Run("PublicModeInterceptor_RevocationRace", func(t *testing.T) {
		carolCToken := login("carol_race", "carolPass123")
		var carolDB models.User
		if err := env.db.First(&carolDB, "id = ?", carol.ID).Error; err != nil {
			t.Fatal(err)
		}
		carolBToken := carolDB.Token
		global.UserToken.Delete(carolBToken)

		dbLoaded := make(chan struct{})
		releaseBackfill := make(chan struct{})
		var once sync.Once
		restore := sessionguard.SetAfterDBLookupHookForTest(func(bToken string) {
			if bToken == carolBToken {
				once.Do(func() { close(dbLoaded) })
				<-releaseBackfill
			}
		})
		defer restore()

		done := make(chan map[string]interface{}, 1)
		go func() {
			_, resp := env.postJSON(t, "/api/user/getAuthInfo", carolCToken, `{}`)
			done <- resp
		}()

		<-dbLoaded

		// Admin updates Carol (resets token & disables account) while PublicModeInterceptor holds Carol's pre-revocation active snapshot.
		_, revokeCarol := env.postJSON(t, "/api/panel/users/update", adminCToken, fmt.Sprintf(
			`{"id":%d,"username":"carol_race","name":"Carol Race","role":2,"status":2}`,
			carol.ID,
		))
		if revokeCarol["code"] != float64(0) {
			t.Fatalf("revoke Carol failed: %#v", revokeCarol)
		}

		close(releaseBackfill)
		racedResp := <-done
		if racedResp["code"] != float64(0) {
			t.Fatalf("expected PublicModeInterceptor to fall back to public user, got: %#v", racedResp)
		}
		racedData := racedResp["data"].(map[string]interface{})
		racedUser := racedData["user"].(map[string]interface{})
		if racedUser["id"] != float64(pubAccount.ID) || racedData["visitMode"] != float64(1) {
			t.Fatalf("PublicModeInterceptor returned revoked Carol instead of public fallback: %#v", racedData)
		}
		if _, resurrected := global.UserToken.Get(carolBToken); resurrected {
			t.Fatal("PublicModeInterceptor backfilled revoked Carol into UserToken hot cache")
		}

		// Subsequent calls on both PublicModeInterceptor and LoginInterceptor must NOT restore Carol's privileges.
		_, followUpPublic := env.postJSON(t, "/api/user/getAuthInfo", carolCToken, `{}`)
		followUpData := followUpPublic["data"].(map[string]interface{})
		followUpUser := followUpData["user"].(map[string]interface{})
		if followUpUser["id"] != float64(pubAccount.ID) || followUpData["visitMode"] != float64(1) {
			t.Fatalf("follow-up PublicModeInterceptor restored Carol privileges: %#v", followUpData)
		}
		_, followUpLogin := env.postJSON(t, "/api/user/getInfo", carolCToken, `{}`)
		if followUpLogin["code"] != float64(1001) {
			t.Fatalf("follow-up LoginInterceptor accepted revoked Carol token: %#v", followUpLogin)
		}
	})
}
