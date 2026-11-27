package panel

import (
	"bytes"
	"encoding/json"
	"fmt"
	"leon-panel/global"
	"leon-panel/models"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func setupBookmarkIsolationDB(t *testing.T) *gorm.DB {
	t.Helper()
	db, err := gorm.Open(sqlite.Open(filepath.Join(t.TempDir(), "bookmark_isolation.db")), &gorm.Config{})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.User{}, &models.ItemIconGroup{}, &models.ItemIcon{}); err != nil {
		t.Fatal(err)
	}
	prevGlobal := global.Db
	prevModels := models.Db
	global.Db = db
	models.Db = db
	t.Cleanup(func() {
		global.Db = prevGlobal
		models.Db = prevModels
		if sqlDB, err := db.DB(); err == nil {
			_ = sqlDB.Close()
		}
	})
	return db
}

func invokePanelAsUser(t *testing.T, handler func(*gin.Context), userID uint, role int, body string) (string, map[string]interface{}) {
	t.Helper()
	gin.SetMode(gin.TestMode)
	rec := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(rec)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	if userID != 0 {
		ctx.Set("userInfo", models.User{
			BaseModel: models.BaseModel{ID: userID},
			Role:      role,
			Status:    1,
		})
	}
	handler(ctx)

	var parsed map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &parsed); err != nil {
		t.Fatalf("invalid json %q: %v", rec.Body.String(), err)
	}
	return rec.Body.String(), parsed
}

func TestItemIconEditAndBatchWriteEnforceStrictAccountOwnership(t *testing.T) {
	db := setupBookmarkIsolationDB(t)

	groupA := models.ItemIconGroup{UserId: 1, Title: "Admin Ops", Sort: 1}
	groupB := models.ItemIconGroup{UserId: 2, Title: "Member Links", Sort: 1}
	if err := db.Create(&groupA).Error; err != nil {
		t.Fatal(err)
	}
	if err := db.Create(&groupB).Error; err != nil {
		t.Fatal(err)
	}

	adminIcon := models.ItemIcon{
		UserId:          1,
		ItemIconGroupId: int(groupA.ID),
		Title:           "Proxmox VE",
		Url:             "https://pve.example.com",
		LanUrl:          "https://192.168.10.2:8006",
		Description:     "Cluster node",
		OpenMethod:      2,
		Sort:            1,
		IconJson:        `{"itemType":1,"text":"PVE"}`,
	}
	if err := db.Create(&adminIcon).Error; err != nil {
		t.Fatal(err)
	}

	iconAPI := &ItemIcon{}

	// 1. User 2 tries IDOR hijack of User 1's bookmark into User 2's group.
	hijackBody := fmt.Sprintf(
		`{"id":%d,"itemIconGroupId":%d,"userId":2,"title":"Hijacked","url":"https://evil.example"}`,
		adminIcon.ID, groupB.ID,
	)
	_, hijackResp := invokePanelAsUser(t, iconAPI.Edit, 2, 2, hijackBody)
	if hijackResp["code"] == float64(0) {
		t.Fatalf("cross-account ItemIcon.Edit succeeded: %#v", hijackResp)
	}

	// Verify User 1's bookmark was not modified or transferred to User 2.
	var reloaded models.ItemIcon
	if err := db.First(&reloaded, "id = ?", adminIcon.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.UserId != 1 || reloaded.ItemIconGroupId != int(groupA.ID) || reloaded.Title != "Proxmox VE" || reloaded.Url != "https://pve.example.com" {
		t.Fatalf("admin bookmark mutated after rejected edit: %+v", reloaded)
	}

	// 2. User 2 tries creating a new bookmark inside User 1's group.
	foreignGroupCreate := fmt.Sprintf(
		`{"itemIconGroupId":%d,"title":"Injected","url":"https://injected.example"}`,
		groupA.ID,
	)
	_, createResp := invokePanelAsUser(t, iconAPI.Edit, 2, 2, foreignGroupCreate)
	if createResp["code"] == float64(0) {
		t.Fatalf("creating bookmark in another user's group succeeded: %#v", createResp)
	}

	// 3. User 2 tries AddMultiple with a mixed batch (own group + User 1's group) -> whole batch must reject.
	mixedBatch := fmt.Sprintf(
		`[{"itemIconGroupId":%d,"title":"Own1","url":"https://own.example"},{"itemIconGroupId":%d,"title":"Inject","url":"https://bad.example"}]`,
		groupB.ID, groupA.ID,
	)
	_, batchResp := invokePanelAsUser(t, iconAPI.AddMultiple, 2, 2, mixedBatch)
	if batchResp["code"] == float64(0) {
		t.Fatalf("mixed cross-account AddMultiple succeeded: %#v", batchResp)
	}
	var user2Count int64
	if err := db.Model(&models.ItemIcon{}).Where("user_id = ?", 2).Count(&user2Count).Error; err != nil {
		t.Fatal(err)
	}
	if user2Count != 0 {
		t.Fatalf("partial rows written on rejected batch: count = %d", user2Count)
	}

	// 4. User 2 passes forged ID matching User 1's bookmark in AddMultiple targeting User 2's own group -> must create fresh ID without touching User 1.
	forgedIDBatch := fmt.Sprintf(
		`[{"id":%d,"userId":1,"itemIconGroupId":%d,"title":"Legit Member Link","url":"https://member.example"}]`,
		adminIcon.ID, groupB.ID,
	)
	rawBatchOK, batchOK := invokePanelAsUser(t, iconAPI.AddMultiple, 2, 2, forgedIDBatch)
	if batchOK["code"] != float64(0) {
		t.Fatalf("valid AddMultiple failed: %s", rawBatchOK)
	}
	if strings.Contains(rawBatchOK, `"user":`) || strings.Contains(rawBatchOK, `"password"`) || strings.Contains(rawBatchOK, `"token"`) {
		t.Fatalf("AddMultiple leaked nested user fields: %s", rawBatchOK)
	}
	if err := db.First(&reloaded, "id = ?", adminIcon.ID).Error; err != nil {
		t.Fatal(err)
	}
	if reloaded.UserId != 1 || reloaded.Title != "Proxmox VE" {
		t.Fatalf("admin icon affected by AddMultiple PK injection: %+v", reloaded)
	}

	// 5. Owner User 1 legitimately updates own bookmark (including idempotent repeat save with identical values).
	ownerUpdate := fmt.Sprintf(
		`{"id":%d,"itemIconGroupId":%d,"title":"Proxmox Cluster","url":"https://pve.example.com","lanUrl":"https://192.168.10.2:8006","description":"Cluster node","openMethod":2,"icon":{"itemType":1,"text":"PVE"}}`,
		adminIcon.ID, groupA.ID,
	)
	for attempt := 0; attempt < 2; attempt++ {
		rawOwner, ownerResp := invokePanelAsUser(t, iconAPI.Edit, 1, 1, ownerUpdate)
		if ownerResp["code"] != float64(0) {
			t.Fatalf("owner edit attempt %d failed: %s", attempt+1, rawOwner)
		}
		if strings.Contains(rawOwner, `"user":`) || strings.Contains(rawOwner, `"password"`) || strings.Contains(rawOwner, `"token"`) {
			t.Fatalf("ItemIcon.Edit leaked nested user fields: %s", rawOwner)
		}
	}
}

func TestItemIconGroupDeletesRetainsAtLeastOneOwnedGroupAgainstForgedAndDuplicateIDs(t *testing.T) {
	db := setupBookmarkIsolationDB(t)

	g1 := models.ItemIconGroup{UserId: 2, Title: "G1", Sort: 1}
	g2 := models.ItemIconGroup{UserId: 2, Title: "G2", Sort: 2}
	foreign := models.ItemIconGroup{UserId: 1, Title: "AdminGroup", Sort: 1}
	for _, g := range []*models.ItemIconGroup{&g1, &g2, &foreign} {
		if err := db.Create(g).Error; err != nil {
			t.Fatal(err)
		}
	}

	groupAPI := &ItemIconGroup{}

	// Padding with a foreign/non-existent group ID (len=3 vs owned=2) must NOT bypass "keep at least one".
	bypassAttempt := fmt.Sprintf(`{"ids":[%d,%d,%d]}`, g1.ID, g2.ID, foreign.ID)
	_, bypassResp := invokePanelAsUser(t, groupAPI.Deletes, 2, 2, bypassAttempt)
	if bypassResp["code"] != float64(1201) {
		t.Fatalf("expected 1201 retention guard, got: %#v", bypassResp)
	}

	var remaining int64
	if err := db.Model(&models.ItemIconGroup{}).Where("user_id = ?", 2).Count(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if remaining != 2 {
		t.Fatalf("owned groups deleted on bypass attempt: remaining = %d", remaining)
	}

	// Duplicate IDs for a single group ([g1, g1], len=2 vs owned=2) must delete only g1 and succeed.
	dupAttempt := fmt.Sprintf(`{"ids":[%d,%d]}`, g1.ID, g1.ID)
	_, dupResp := invokePanelAsUser(t, groupAPI.Deletes, 2, 2, dupAttempt)
	if dupResp["code"] != float64(0) {
		t.Fatalf("expected duplicate single-group delete to succeed, got: %#v", dupResp)
	}
	if err := db.Model(&models.ItemIconGroup{}).Where("user_id = ?", 2).Count(&remaining).Error; err != nil {
		t.Fatal(err)
	}
	if remaining != 1 {
		t.Fatalf("expected 1 remaining group, got %d", remaining)
	}

	// Group list response must not serialize nested zero-value "user" objects.
	rawList, listResp := invokePanelAsUser(t, groupAPI.GetList, 2, 2, `{"includeItems":true}`)
	if listResp["code"] != float64(0) {
		t.Fatalf("GetList failed: %s", rawList)
	}
	if strings.Contains(rawList, `"user":`) || strings.Contains(rawList, `"password"`) || strings.Contains(rawList, `"token"`) {
		t.Fatalf("GetList leaked nested user struct: %s", rawList)
	}
}
