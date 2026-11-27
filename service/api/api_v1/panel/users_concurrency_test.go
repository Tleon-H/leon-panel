package panel

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"leon-panel/models"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"gorm.io/driver/mysql"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func openConcurrentAdminSQLite(t *testing.T, dbPath string) *gorm.DB {
	t.Helper()
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

func intPtr(v int) *int { return &v }

func TestLastActiveAdminProtectionUnderDatabaseConcurrency(t *testing.T) {
	type opKind string
	const (
		opDisable opKind = "disable"
		opDemote  opKind = "demote"
		opDelete  opKind = "delete"
	)

	scenarios := []struct {
		name string
		op1  opKind
		op2  opKind
	}{
		{"disable_vs_disable", opDisable, opDisable},
		{"demote_vs_demote", opDemote, opDemote},
		{"delete_vs_delete", opDelete, opDelete},
		{"disable_vs_demote", opDisable, opDemote},
		{"disable_vs_delete", opDisable, opDelete},
		{"demote_vs_delete", opDemote, opDelete},
	}

	execOp := func(db *gorm.DB, kind opKind, u models.User) error {
		switch kind {
		case opDisable:
			_, _, err := updateUserInProtectedTx(db, userUpdateReq{
				ID:       u.ID,
				Username: u.Username,
				Name:     u.Name,
				Role:     1,
				Status:   intPtr(2),
			})
			return err
		case opDemote:
			_, _, err := updateUserInProtectedTx(db, userUpdateReq{
				ID:       u.ID,
				Username: u.Username,
				Name:     u.Name,
				Role:     2,
				Status:   intPtr(1),
			})
			return err
		case opDelete:
			_, err := deleteUsersInProtectedTx(db, []uint{u.ID})
			return err
		default:
			return fmt.Errorf("unknown op %s", kind)
		}
	}

	for _, sc := range scenarios {
		t.Run(sc.name, func(t *testing.T) {
			// Run multiple iterations per scenario across TWO independent *gorm.DB pools
			// targeting the same SQLite file to verify true database-level serialization.
			for iter := 0; iter < 5; iter++ {
				dbPath := filepath.Join(t.TempDir(), fmt.Sprintf("%s_%d.db", sc.name, iter))
				db1 := openConcurrentAdminSQLite(t, dbPath)
				db2 := openConcurrentAdminSQLite(t, dbPath)

				if err := db1.AutoMigrate(
					&models.User{},
					&models.ItemIcon{},
					&models.ItemIconGroup{},
					&models.ModuleConfig{},
					&models.UserConfig{},
				); err != nil {
					t.Fatal(err)
				}

				a1 := models.User{Username: "admin_one", Password: "h1", Name: "Admin 1", Role: 1, Status: 1, Token: "tok_a1"}
				a2 := models.User{Username: "admin_two", Password: "h2", Name: "Admin 2", Role: 1, Status: 1, Token: "tok_a2"}
				if err := db1.Create(&a1).Error; err != nil {
					t.Fatal(err)
				}
				if err := db1.Create(&a2).Error; err != nil {
					t.Fatal(err)
				}

				start := make(chan struct{})
				errs := make([]error, 2)
				var wg sync.WaitGroup
				wg.Add(2)

				go func() {
					defer wg.Done()
					<-start
					errs[0] = execOp(db1, sc.op1, a1)
				}()
				go func() {
					defer wg.Done()
					<-start
					errs[1] = execOp(db2, sc.op2, a2)
				}()

				close(start)
				wg.Wait()

				var succeeded, keptOne int
				for i, err := range errs {
					switch {
					case err == nil:
						succeeded++
					case errors.Is(err, ErrUsersApiAtLeastKeepOne):
						keptOne++
					default:
						t.Fatalf("iter %d goroutine %d unexpected error: %v", iter, i, err)
					}
				}
				if succeeded != 1 || keptOne != 1 {
					t.Fatalf("iter %d expected 1 success + 1 ErrUsersApiAtLeastKeepOne, got succeeded=%d keptOne=%d errs=%v",
						iter, succeeded, keptOne, errs)
				}

				var activeAdmins int64
				if err := db1.Model(&models.User{}).Where("role = ? AND status = ?", 1, 1).Count(&activeAdmins).Error; err != nil {
					t.Fatal(err)
				}
				if activeAdmins < 1 {
					t.Fatalf("iter %d invariant violated: activeAdmins = %d", iter, activeAdmins)
				}
			}
		})
	}

	// Multi-admin concurrent storm: 3 active admins attacked simultaneously by 6 mixed ops across separate DB connections.
	t.Run("mixed_storm_across_three_admins", func(t *testing.T) {
		dbPath := filepath.Join(t.TempDir(), "storm.db")
		dbSetup := openConcurrentAdminSQLite(t, dbPath)
		if err := dbSetup.AutoMigrate(
			&models.User{},
			&models.ItemIcon{},
			&models.ItemIconGroup{},
			&models.ModuleConfig{},
			&models.UserConfig{},
		); err != nil {
			t.Fatal(err)
		}

		admins := []models.User{
			{Username: "storm_admin_1", Password: "h1", Name: "S1", Role: 1, Status: 1, Token: "st1"},
			{Username: "storm_admin_2", Password: "h2", Name: "S2", Role: 1, Status: 1, Token: "st2"},
			{Username: "storm_admin_3", Password: "h3", Name: "S3", Role: 1, Status: 1, Token: "st3"},
		}
		for i := range admins {
			if err := dbSetup.Create(&admins[i]).Error; err != nil {
				t.Fatal(err)
			}
		}

		type task struct {
			kind  opKind
			admin models.User
		}
		tasks := []task{
			{opDisable, admins[0]},
			{opDemote, admins[1]},
			{opDelete, admins[2]},
			{opDelete, admins[0]},
			{opDisable, admins[1]},
			{opDemote, admins[2]},
		}

		conns := make([]*gorm.DB, len(tasks))
		for i := range tasks {
			conns[i] = openConcurrentAdminSQLite(t, dbPath)
		}

		start := make(chan struct{})
		errs := make([]error, len(tasks))
		var wg sync.WaitGroup
		for i, tk := range tasks {
			wg.Add(1)
			go func(idx int, tsk task) {
				defer wg.Done()
				<-start
				errs[idx] = execOp(conns[idx], tsk.kind, tsk.admin)
			}(i, tk)
		}
		close(start)
		wg.Wait()

		for i, err := range errs {
			if err != nil && !errors.Is(err, ErrUsersApiAtLeastKeepOne) && !errors.Is(err, errUsersApiNotFound) {
				t.Fatalf("task %d unexpected error: %v", i, err)
			}
		}

		var activeAdmins int64
		if err := dbSetup.Model(&models.User{}).Where("role = ? AND status = ?", 1, 1).Count(&activeAdmins).Error; err != nil {
			t.Fatal(err)
		}
		if activeAdmins < 1 {
			t.Fatalf("storm invariant violated: activeAdmins = %d", activeAdmins)
		}
	})
}

type noopMySQLPool struct {
	begun     int
	committed int
	rolled    int
}

type noopMySQLTx struct {
	parent *noopMySQLPool
}

func (p *noopMySQLPool) PrepareContext(context.Context, string) (*sql.Stmt, error) { return nil, nil }
func (p *noopMySQLPool) ExecContext(context.Context, string, ...interface{}) (sql.Result, error) {
	return nil, nil
}
func (p *noopMySQLPool) QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error) {
	return nil, nil
}
func (p *noopMySQLPool) QueryRowContext(context.Context, string, ...interface{}) *sql.Row { return nil }
func (p *noopMySQLPool) BeginTx(context.Context, *sql.TxOptions) (gorm.ConnPool, error) {
	p.begun++
	return &noopMySQLTx{parent: p}, nil
}

func (t *noopMySQLTx) PrepareContext(context.Context, string) (*sql.Stmt, error) { return nil, nil }
func (t *noopMySQLTx) ExecContext(context.Context, string, ...interface{}) (sql.Result, error) {
	return nil, nil
}
func (t *noopMySQLTx) QueryContext(context.Context, string, ...interface{}) (*sql.Rows, error) {
	return nil, nil
}
func (t *noopMySQLTx) QueryRowContext(context.Context, string, ...interface{}) *sql.Row { return nil }
func (t *noopMySQLTx) Commit() error {
	t.parent.committed++
	return nil
}
func (t *noopMySQLTx) Rollback() error {
	t.parent.rolled++
	return nil
}

func TestActiveAdminProtectionUsesForUpdateLockOnMySQLDialect(t *testing.T) {
	pool := &noopMySQLPool{}
	dryDB, err := gorm.Open(mysql.New(mysql.Config{
		Conn:                      pool,
		SkipInitializeWithVersion: true,
	}), &gorm.Config{
		DryRun:         true,
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}

	var queries []string
	if err := dryDB.Callback().Query().After("gorm:query").Register("test:record_query", func(tx *gorm.DB) {
		queries = append(queries, tx.Statement.SQL.String())
	}); err != nil {
		t.Fatal(err)
	}
	if err := dryDB.Callback().Update().After("gorm:update").Register("test:record_update", func(tx *gorm.DB) {
		queries = append(queries, tx.Statement.SQL.String())
	}); err != nil {
		t.Fatal(err)
	}

	// Execute the real runActiveAdminProtectedTx against the mysql dialector.
	// DryRun returns count=0 for Count(), so verifyAtLeastOneActiveAdmin returns ErrUsersApiAtLeastKeepOne after recording SQL.
	txErr := runActiveAdminProtectedTx(dryDB, func(tx *gorm.DB) error {
		return tx.Model(&models.User{}).Where("id = ?", 1).Update("status", 2).Error
	})
	if !errors.Is(txErr, ErrUsersApiAtLeastKeepOne) {
		t.Fatalf("expected ErrUsersApiAtLeastKeepOne under DryRun zero count, got: %v", txErr)
	}
	if pool.begun != 1 || pool.rolled != 1 || pool.committed != 0 {
		t.Fatalf("unexpected tx lifecycle: begun=%d committed=%d rolled=%d", pool.begun, pool.committed, pool.rolled)
	}
	if len(queries) < 3 {
		t.Fatalf("expected lock SELECT, mutation UPDATE, and post-check COUNT queries, got: %#v", queries)
	}

	lockSQL := queries[0]
	mutateSQL := queries[1]
	countSQL := queries[2]

	if !strings.Contains(lockSQL, "FOR UPDATE") ||
		!strings.Contains(lockSQL, "ORDER BY id ASC") ||
		!strings.Contains(lockSQL, "role = ? AND status = ?") {
		t.Fatalf("first query in MySQL tx must lock active admins with FOR UPDATE, got: %q", lockSQL)
	}
	if !strings.Contains(strings.ToUpper(mutateSQL), "UPDATE") {
		t.Fatalf("second query must be target mutation UPDATE, got: %q", mutateSQL)
	}
	if !strings.Contains(strings.ToLower(countSQL), "count(") || !strings.Contains(countSQL, "role = ? AND status = ?") {
		t.Fatalf("third query must be post-mutation active admin COUNT, got: %q", countSQL)
	}
}
