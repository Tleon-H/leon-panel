package backup

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestBackupRoundTripKeepsGroupIconStyle(t *testing.T) {
	base, db := restoreFixture(t)
	if _, err := db.Exec(`create table item_icon_group(id integer primary key, title text, icon_style integer)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title, icon_style) values (1, 'HOME', 0), (2, '常用网站', 1), (3, '未设置', NULL)`); err != nil {
		t.Fatal(err)
	}
	raw := buildPackage(t, base, db, "0.1.0")
	if _, err := db.Exec(`update item_icon_group set title = 'changed', icon_style = 1`); err != nil {
		t.Fatal(err)
	}
	if err := Restore(context.Background(), restoreOpt(base, db, ""), bytes.NewReader(raw)); err != nil {
		t.Fatal(err)
	}
	assertGroupStyle(t, db, 1, "HOME", sql.NullInt64{Int64: 0, Valid: true})
	assertGroupStyle(t, db, 2, "常用网站", sql.NullInt64{Int64: 1, Valid: true})
	assertGroupStyle(t, db, 3, "未设置", sql.NullInt64{})
}

func TestLegacyBackupWithoutGroupIconStyleStillRestores(t *testing.T) {
	base, db := restoreFixture(t)
	if _, err := db.Exec(`create table item_icon_group(id integer primary key, title text)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title) values (1, 'HOME')`); err != nil {
		t.Fatal(err)
	}
	raw := buildPackage(t, base, db, "0.0.9")
	if _, err := db.Exec(`alter table item_icon_group add column icon_style integer`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`update item_icon_group set title = 'changed', icon_style = 1`); err != nil {
		t.Fatal(err)
	}
	if err := Restore(context.Background(), restoreOpt(base, db, ""), bytes.NewReader(raw)); err != nil {
		t.Fatal(err)
	}
	assertGroupStyle(t, db, 1, "HOME", sql.NullInt64{})
}

func TestRestoreRejectsWhenTheStyleColumnCannotBeAdded(t *testing.T) {
	base, db := restoreFixture(t)
	createWideGroupTable(t, db)
	raw := buildPackage(t, base, db, "0.0.9")
	if _, err := db.Exec(`update item_icon_group set title = 'LIVE-SENTINEL' where id = 1`); err != nil {
		t.Fatal(err)
	}
	mutateLive(t, base, db)

	err := Restore(context.Background(), restoreOpt(base, db, t.TempDir()), bytes.NewReader(raw))
	if !errors.Is(err, ErrMigrate) || !strings.Contains(strings.ToLower(err.Error()), "too many columns") {
		t.Fatalf("err = %v", err)
	}
	assertLive(t, base, db, true)
	assertLiveSentinel(t, db)
	if leftovers(t, base) != 0 {
		t.Fatal("failed migration left temporary files in the application directory")
	}
}

func TestRestoreFaultAfterGroupStyleMigrationLeavesLiveUntouched(t *testing.T) {
	base, db := restoreFixture(t)
	if _, err := db.Exec(`create table item_icon_group(id integer primary key, title text)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title) values (1, 'HOME')`); err != nil {
		t.Fatal(err)
	}
	raw := buildPackage(t, base, db, "0.0.9")
	if _, err := db.Exec(`alter table item_icon_group add column icon_style integer`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`update item_icon_group set title = 'LIVE-SENTINEL', icon_style = 1 where id = 1`); err != nil {
		t.Fatal(err)
	}
	mutateLive(t, base, db)
	opt := restoreOpt(base, db, t.TempDir())
	opt.FaultAfter = "migrate"
	err := Restore(context.Background(), opt, bytes.NewReader(raw))
	if !errors.Is(err, ErrApply) || errors.Is(err, ErrRollback) || errors.Is(err, ErrMigrate) {
		t.Fatalf("err = %v", err)
	}
	assertLive(t, base, db, true)
	assertGroupStyle(t, db, 1, "LIVE-SENTINEL", sql.NullInt64{Int64: 1, Valid: true})
	if leftovers(t, base) != 0 {
		t.Fatal("injected failure left temporary files in the application directory")
	}
}

func TestRestoreCanceledContextLeavesLiveUntouched(t *testing.T) {
	base, db := restoreFixture(t)
	if _, err := db.Exec(`create table item_icon_group(id integer primary key, title text)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title) values (1, 'HOME')`); err != nil {
		t.Fatal(err)
	}
	raw := buildPackage(t, base, db, "0.0.9")
	if _, err := db.Exec(`update item_icon_group set title = 'LIVE-SENTINEL' where id = 1`); err != nil {
		t.Fatal(err)
	}
	mutateLive(t, base, db)
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	err := Restore(ctx, restoreOpt(base, db, t.TempDir()), bytes.NewReader(raw))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("err = %v", err)
	}
	assertLive(t, base, db, true)
	assertLiveSentinel(t, db)
}

func TestMigrateGroupIconStyleStopsWhenCanceled(t *testing.T) {
	path := filepath.Join(t.TempDir(), "extracted.sqlite")
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`create table item_icon_group(id integer primary key, title text)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title) values (1, 'HOME')`); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	changed, err := migrateGroupIconStyle(ctx, path)
	if changed || !errors.Is(err, context.Canceled) {
		t.Fatalf("changed=%v err=%v", changed, err)
	}
	check, err := sql.Open("sqlite3", path)
	if err != nil {
		t.Fatal(err)
	}
	defer check.Close()
	if _, err := check.Exec(`select icon_style from item_icon_group`); err == nil {
		t.Fatal("canceled migration added icon_style")
	}
	info, err := os.Stat(path)
	if err != nil || info.Size() == 0 {
		t.Fatalf("extracted database missing: %v", err)
	}
}

func createWideGroupTable(t *testing.T, db *sql.DB) {
	t.Helper()
	var ddl strings.Builder
	ddl.WriteString(`create table item_icon_group(id integer primary key, title text`)
	for i := 0; i < 1998; i++ {
		fmt.Fprintf(&ddl, ", c%d integer", i)
	}
	ddl.WriteString(`)`)
	if _, err := db.Exec(ddl.String()); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`insert into item_icon_group(id, title) values (1, 'BACKUP')`); err != nil {
		t.Fatal(err)
	}
	var columns int
	if err := db.QueryRow(`select count(*) from pragma_table_info('item_icon_group')`).Scan(&columns); err != nil {
		t.Fatal(err)
	}
	if columns != 2000 {
		t.Fatalf("column count = %d", columns)
	}
}

func assertLiveSentinel(t *testing.T, db *sql.DB) {
	t.Helper()
	var title string
	if err := db.QueryRow(`select title from item_icon_group where id = 1`).Scan(&title); err != nil || title != "LIVE-SENTINEL" {
		t.Fatalf("title = %s %v", title, err)
	}
	if _, err := db.Exec(`select icon_style from item_icon_group`); err == nil {
		t.Fatal("live database gained icon_style despite a failed restore")
	}
}

func assertGroupStyle(t *testing.T, db *sql.DB, id int, title string, style sql.NullInt64) {
	t.Helper()
	var gotTitle string
	var got sql.NullInt64
	if err := db.QueryRow(`select title, icon_style from item_icon_group where id = ?`, id).Scan(&gotTitle, &got); err != nil {
		t.Fatal(err)
	}
	if gotTitle != title || got.Valid != style.Valid || got.Int64 != style.Int64 {
		t.Fatalf("id %d got title %s style %#v", id, gotTitle, got)
	}
}
