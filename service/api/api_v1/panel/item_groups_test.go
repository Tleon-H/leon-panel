package panel

import (
	"bytes"
	"encoding/json"
	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"net/http/httptest"
	"path/filepath"
	"sun-panel/global"
	"sun-panel/models"
	"testing"
)

func TestGroupListIncludesOnlyOwnedSortedItems(t *testing.T) {
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "test.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.ItemIconGroup{}, &models.ItemIcon{}); err != nil {
		t.Fatal(err)
	}
	previous := global.Db
	global.Db = db
	t.Cleanup(func() { global.Db = previous; sqlDB, _ := db.DB(); sqlDB.Close() })
	group := models.ItemIconGroup{UserId: 1, Title: "Owned"}
	other := models.ItemIconGroup{UserId: 2, Title: "Other"}
	for _, value := range []*models.ItemIconGroup{&group, &other} {
		if err := db.Create(value).Error; err != nil {
			t.Fatal(err)
		}
	}
	icons := []models.ItemIcon{
		{UserId: 1, ItemIconGroupId: int(group.ID), Title: "Second", Sort: 2},
		{UserId: 1, ItemIconGroupId: int(group.ID), Title: "First", Sort: 1, IconJson: `{"itemType":1,"text":"F"}`},
		{UserId: 2, ItemIconGroupId: int(group.ID), Title: "Foreign"},
	}
	if err := db.Create(&icons).Error; err != nil {
		t.Fatal(err)
	}
	call := func(user uint, body string) []map[string]json.RawMessage {
		t.Helper()
		engine := gin.New()
		engine.POST("/groups", func(c *gin.Context) {
			c.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: user}})
			(&ItemIconGroup{}).GetList(c)
		})
		request := httptest.NewRequest("POST", "/groups", bytes.NewBufferString(body))
		request.Header.Set("Content-Type", "application/json")
		recorder := httptest.NewRecorder()
		engine.ServeHTTP(recorder, request)
		var result struct {
			Code int `json:"code"`
			Data struct {
				List []map[string]json.RawMessage `json:"list"`
			} `json:"data"`
		}
		if err := json.Unmarshal(recorder.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result.Code != 0 {
			t.Fatalf("request failed: %s", recorder.Body.String())
		}
		return result.Data.List
	}
	legacy := call(1, "")
	if len(legacy) != 1 || legacy[0]["items"] != nil {
		t.Fatalf("legacy response changed: %v", legacy)
	}
	loaded := call(1, `{"includeItems":true,"userId":2}`)
	if len(loaded) != 1 {
		t.Fatalf("unexpected groups: %v", loaded)
	}
	var got []models.ItemIcon
	if err := json.Unmarshal(loaded[0]["items"], &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0].Title != "First" || got[1].Title != "Second" || got[0].Icon.Text != "F" {
		t.Fatalf("wrong items or ordering: %+v", got)
	}
	// A first visit still creates APP and attaches the account's historical ungrouped items.
	orphan := models.ItemIcon{UserId: 3, Title: "Legacy"}
	if err := db.Create(&orphan).Error; err != nil {
		t.Fatal(err)
	}
	fresh := call(3, `{"includeItems":true}`)
	if len(fresh) != 1 {
		t.Fatalf("missing default group: %v", fresh)
	}
	if err := json.Unmarshal(fresh[0]["items"], &got); err != nil {
		t.Fatal(err)
	}
	if len(got) != 1 || got[0].Title != "Legacy" {
		t.Fatalf("legacy item missing: %+v", got)
	}
	empty := call(4, `{"includeItems":true}`)
	if string(empty[0]["items"]) != "[]" {
		t.Fatalf("empty items must be an array: %v", empty)
	}
}
