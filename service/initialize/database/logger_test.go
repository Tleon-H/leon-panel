package database

import (
	"bytes"
	"context"
	"errors"
	"leon-panel/models"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

type syncBuffer struct {
	mu  sync.Mutex
	buf bytes.Buffer
}

func (b *syncBuffer) Write(p []byte) (int, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.Write(p)
}

func (b *syncBuffer) String() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.buf.String()
}

func (b *syncBuffer) Reset() {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.buf.Reset()
}

func openTestSQLiteWithProdLogger(t *testing.T, buf *syncBuffer) *gorm.DB {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "logger_redaction.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: newLogger(buf),
		NamingStrategy: schema.NamingStrategy{
			SingularTable: true,
		},
	})
	if err != nil {
		t.Fatalf("open sqlite failed: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql.DB failed: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })
	return db
}

func TestGetLoggerAndSQLiteConnectEnableParameterizedQueries(t *testing.T) {
	const (
		testToken    = "pr1a_secret_btoken_filter_918273"
		testPassHash = "pr1a_secret_passhash_filter_a1b2c3"
		sampleSQL    = "SELECT * FROM `user` WHERE token=? AND password=?"
	)

	prodLogger := GetLogger()
	filter, ok := prodLogger.(gorm.ParamsFilter)
	if !ok {
		t.Fatalf("GetLogger() does not implement gorm.ParamsFilter")
	}
	gotSQL, gotVars := filter.ParamsFilter(context.Background(), sampleSQL, testToken, testPassHash)
	if gotSQL != sampleSQL {
		t.Fatalf("expected SQL preserved, got %q", gotSQL)
	}
	if len(gotVars) != 0 {
		t.Fatalf("expected bind params redacted (empty), got %v", gotVars)
	}

	sqliteClient := &SQLiteConfig{Filename: filepath.Join(t.TempDir(), "connect_check.db")}
	db, err := sqliteClient.Connect()
	if err != nil {
		t.Fatalf("SQLiteConfig.Connect() failed: %v", err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatalf("get sql.DB failed: %v", err)
	}
	t.Cleanup(func() { _ = sqlDB.Close() })

	connFilter, ok := db.Logger.(gorm.ParamsFilter)
	if !ok {
		t.Fatalf("SQLiteConfig.Connect() logger does not implement gorm.ParamsFilter")
	}
	gotSQL, gotVars = connFilter.ParamsFilter(context.Background(), sampleSQL, testToken, testPassHash)
	if gotSQL != sampleSQL || len(gotVars) != 0 {
		t.Fatalf("expected SQLiteConfig.Connect() logger to strip bind params, got sql=%q vars=%v", gotSQL, gotVars)
	}
}

func TestProductionLoggerRedactsSQLErrorParams(t *testing.T) {
	const (
		testToken    = "pr1a_err_btoken_7766554433221100"
		testPassHash = "pr1a_err_passhash_00112233445566"
		testUser     = "err-alice@example.com"
	)

	var buf syncBuffer
	db := openTestSQLiteWithProdLogger(t, &buf)

	// 1) Missing table triggers real DB errors (not ErrRecordNotFound) on exact User lookup shapes.
	var u models.User
	err := db.Where("token=?", testToken).First(&u).Error
	if err == nil || errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected real sqlite error for token lookup on missing table, got %v", err)
	}
	err = db.Where("username=?", testUser).Where("password=?", testPassHash).First(&u).Error
	if err == nil || errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected real sqlite error for password lookup on missing table, got %v", err)
	}

	selectErrLogged := buf.String()
	for _, want := range []string{
		"no such table: user",
		"SELECT * FROM `user`",
		"token=?",
		"password=?",
	} {
		if !strings.Contains(selectErrLogged, want) {
			t.Fatalf("expected SELECT error log to contain %q, got:\n%s", want, selectErrLogged)
		}
	}
	for _, secret := range []string{testToken, testPassHash, testUser} {
		if strings.Contains(selectErrLogged, secret) {
			t.Fatalf("production SELECT SQL error log leaked sensitive bind parameter %q:\n%s", secret, selectErrLogged)
		}
	}

	// 2) Migrated table with invalid column in UPDATE triggers a real DB error binding token and password.
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}
	buf.Reset()

	err = db.Model(&models.User{}).
		Where("non_existent_col = ?", 1).
		Updates(map[string]interface{}{
			"token":    testToken,
			"password": testPassHash,
		}).Error
	if err == nil || errors.Is(err, gorm.ErrRecordNotFound) {
		t.Fatalf("expected real sqlite error for update with missing column, got %v", err)
	}

	updateErrLogged := buf.String()
	for _, want := range []string{
		"no such column: non_existent_col",
		"UPDATE `user`",
		"`token`=?",
		"`password`=?",
	} {
		if !strings.Contains(updateErrLogged, want) {
			t.Fatalf("expected UPDATE error log to contain %q, got:\n%s", want, updateErrLogged)
		}
	}
	for _, secret := range []string{testToken, testPassHash, testUser} {
		if strings.Contains(updateErrLogged, secret) {
			t.Fatalf("production UPDATE SQL error log leaked sensitive bind parameter %q:\n%s", secret, updateErrLogged)
		}
	}
}

func TestProductionLoggerRedactsSlowQueryParams(t *testing.T) {
	const (
		testToken       = "pr1a_slow_btoken_998877665544332"
		testPassHash    = "pr1a_slow_passhash_2233445566778"
		rotatedToken    = "pr1a_slow_rotated_token_11223344"
		rotatedPassHash = "pr1a_slow_rotated_pass_556677889"
		testUser        = "slow-alice@example.com"
	)

	var buf syncBuffer
	db := openTestSQLiteWithProdLogger(t, &buf)
	if err := db.AutoMigrate(&models.User{}); err != nil {
		t.Fatalf("AutoMigrate failed: %v", err)
	}

	seeded := models.User{
		Username: testUser,
		Password: testPassHash,
		Name:     "Slow Test User",
		Status:   1,
		Role:     2,
		Mail:     testUser,
		Token:    testToken,
	}
	if err := db.Create(&seeded).Error; err != nil {
		t.Fatalf("seed user failed: %v", err)
	}
	buf.Reset()

	// Exceed the production SlowThreshold (1s) inside GORM's own callback execution window
	// while keeping the exact unwrapped production logger configuration.
	slowDelay := func(tx *gorm.DB) {
		time.Sleep(1050 * time.Millisecond)
	}
	if err := db.Callback().Query().After("gorm:query").Register("test:slow_query_delay", slowDelay); err != nil {
		t.Fatalf("register slow query callback failed: %v", err)
	}
	if err := db.Callback().Update().After("gorm:update").Register("test:slow_update_delay", slowDelay); err != nil {
		t.Fatalf("register slow update callback failed: %v", err)
	}

	var gotByToken models.User
	if err := db.Where("token=?", testToken).First(&gotByToken).Error; err != nil {
		t.Fatalf("slow token lookup failed: %v", err)
	}
	if gotByToken.ID != seeded.ID {
		t.Fatalf("expected user ID %d, got %d", seeded.ID, gotByToken.ID)
	}

	var gotByPassword models.User
	if err := db.Where("username=?", testUser).Where("password=?", testPassHash).First(&gotByPassword).Error; err != nil {
		t.Fatalf("slow username+password lookup failed: %v", err)
	}
	if gotByPassword.ID != seeded.ID {
		t.Fatalf("expected user ID %d, got %d", seeded.ID, gotByPassword.ID)
	}

	if err := db.Model(&models.User{}).Where("id=?", seeded.ID).Updates(map[string]interface{}{
		"token":    rotatedToken,
		"password": rotatedPassHash,
	}).Error; err != nil {
		t.Fatalf("slow credential update failed: %v", err)
	}

	logged := buf.String()
	if strings.TrimSpace(logged) == "" {
		t.Fatalf("expected slow query logs to be emitted, got empty output")
	}

	// Diagnostic slow-query details must remain intact.
	if count := strings.Count(logged, "SLOW SQL >= 1s"); count < 3 {
		t.Fatalf("expected at least 3 slow SQL entries (token lookup, password lookup, credential update), got %d:\n%s", count, logged)
	}
	for _, want := range []string{
		"SELECT * FROM `user`",
		"UPDATE `user`",
		"token=?",
		"password=?",
		"`token`=?",
		"`password`=?",
	} {
		if !strings.Contains(logged, want) {
			t.Fatalf("expected slow SQL log to contain diagnostic marker %q, got:\n%s", want, logged)
		}
	}

	// Sensitive bind values must never appear in slow SQL logs.
	for _, secret := range []string{testToken, testPassHash, rotatedToken, rotatedPassHash, testUser} {
		if strings.Contains(logged, secret) {
			t.Fatalf("production slow SQL log leaked sensitive bind parameter %q:\n%s", secret, logged)
		}
	}
}
