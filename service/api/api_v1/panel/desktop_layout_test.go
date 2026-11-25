package panel

import (
	"encoding/json"
	"errors"
	"fmt"
	"leon-panel/global"
	"leon-panel/models"
	"leon-panel/models/datatype"
	"testing"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func openDesktopLayoutDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:desktop-layout-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.ItemIconGroup{}, &models.ItemIcon{}, &models.ModuleConfig{}); err != nil {
		t.Fatal(err)
	}
	sqlDB, err := db.DB()
	if err != nil {
		t.Fatal(err)
	}
	sqlDB.SetMaxOpenConns(1)
	previous := global.Db
	global.Db = db
	t.Cleanup(func() {
		global.Db = previous
		_ = sqlDB.Close()
	})
	return db
}

func seedDesktopLayoutFixture(t *testing.T, db *gorm.DB) (models.ItemIconGroup, models.ItemIconGroup, models.ItemIconGroup, []models.ItemIcon) {
	t.Helper()
	infoStyle := models.GroupIconStyleInfo
	iconStyle := models.GroupIconStyleIcon
	g1 := models.ItemIconGroup{UserId: 7, Title: "HomeLab", Icon: "lucide:server", Sort: 1, IconStyle: &infoStyle}
	g2 := models.ItemIconGroup{UserId: 7, Title: "Media", Icon: "lucide:film", Sort: 2, IconStyle: &iconStyle}
	g3 := models.ItemIconGroup{UserId: 7, Title: "Temporary", Icon: "lucide:folder-kanban", Sort: 3}
	for _, g := range []*models.ItemIconGroup{&g1, &g2, &g3} {
		if err := db.Create(g).Error; err != nil {
			t.Fatal(err)
		}
	}

	items := []models.ItemIcon{
		{UserId: 7, ItemIconGroupId: int(g1.ID), Title: "Docker", Url: "https://docker.local", OpenMethod: 2, Sort: 1, IconJson: `{"itemType":1,"text":"Docker"}`},
		{UserId: 7, ItemIconGroupId: int(g1.ID), Title: "Proxmox", Url: "https://pve.local", OpenMethod: 2, Sort: 2, IconJson: `{"itemType":1,"text":"Proxmox"}`},
		{UserId: 7, ItemIconGroupId: int(g2.ID), Title: "Jellyfin", Url: "https://jellyfin.local", OpenMethod: 2, Sort: 1, IconJson: `{"itemType":1,"text":"Jellyfin"}`},
		{UserId: 7, ItemIconGroupId: int(g3.ID), Title: "Rescued", Url: "https://rescued.local", OpenMethod: 2, Sort: 1, IconJson: `{"itemType":1,"text":"Rescued"}`},
		{UserId: 7, ItemIconGroupId: int(g3.ID), Title: "GoneWithGroup", Url: "https://gone.local", OpenMethod: 2, Sort: 2, IconJson: `{"itemType":1,"text":"GoneWithGroup"}`},
	}
	for i := range items {
		if err := db.Create(&items[i]).Error; err != nil {
			t.Fatal(err)
		}
	}

	initialStudio := models.ModuleConfig{
		UserId: 7,
		Name:   studioConfigModuleName,
		Value: map[string]interface{}{
			"widgets": []interface{}{
				map[string]interface{}{"id": "w-clock", "type": "clock", "title": "CLOCK", "enabled": true, "colSpan": 1},
				map[string]interface{}{"id": "w-todo", "type": "todo", "title": "TODO", "enabled": true, "colSpan": 1},
			},
		},
	}
	if err := initialStudio.Save(db); err != nil {
		t.Fatal(err)
	}
	return g1, g2, g3, items
}

func readWidgetOrder(t *testing.T, db *gorm.DB, userID uint) []string {
	t.Helper()
	cfg, err := (&models.ModuleConfig{}).GetConfigByUserIdAndName(db, userID, studioConfigModuleName)
	if err != nil {
		t.Fatal(err)
	}
	raw, _ := cfg["widgets"].([]interface{})
	ids := make([]string, 0, len(raw))
	for _, entry := range raw {
		obj, _ := entry.(map[string]interface{})
		if id, ok := obj["id"].(string); ok {
			ids = append(ids, id)
		}
	}
	return ids
}

func TestSaveDesktopLayoutAtomicRollbackAndCleanRetry(t *testing.T) {
	db := openDesktopLayoutDB(t)
	g1, g2, g3, items := seedDesktopLayoutFixture(t, db)
	docker, proxmox, jellyfin, rescued := items[0], items[1], items[2], items[3]

	infoStyle := models.GroupIconStyleInfo
	iconStyle := models.GroupIconStyleIcon

	// Combined edit: reorder groups (Media first, renamed HomeLab second, new group AI third),
	// delete g3 (Temporary), rescue "Rescued" into Media, move Proxmox into Media,
	// delete Docker, create a new item "OpenWebUI" in new group, and swap widget order.
	req := DesktopLayoutSaveRequest{
		Groups: []DesktopLayoutGroupInput{
			{
				ID:        g2.ID,
				Title:     "Media Hub",
				Icon:      g2.Icon,
				IconStyle: &infoStyle,
				Items: []DesktopLayoutItemInput{
					{ID: proxmox.ID, Title: "Proxmox", Url: proxmox.Url, OpenMethod: 2, Icon: datatype.ItemIconIconInfo{ItemType: 1, Text: "Proxmox"}},
					{ID: jellyfin.ID, Title: "Jellyfin", Url: jellyfin.Url, OpenMethod: 2, Icon: datatype.ItemIconIconInfo{ItemType: 1, Text: "Jellyfin"}},
					{ID: rescued.ID, Title: "Rescued", Url: rescued.Url, OpenMethod: 2, Icon: datatype.ItemIconIconInfo{ItemType: 1, Text: "Rescued"}},
				},
			},
			{
				ID:        g1.ID,
				Title:     "Core Infra",
				Icon:      g1.Icon,
				IconStyle: &iconStyle,
				Items:     []DesktopLayoutItemInput{},
			},
			{
				ID:        0,
				TempID:    "tmp-group-1",
				Title:     "AI Lab",
				Icon:      "lucide:bot",
				IconStyle: nil,
				Items: []DesktopLayoutItemInput{
					{ID: 0, TempID: "tmp-item-1", Title: "OpenWebUI", Url: "https://ai.local", OpenMethod: 2, Icon: datatype.ItemIconIconInfo{ItemType: 1, Text: "OpenWebUI"}},
				},
			},
		},
		DeletedGroupIDs: []uint{g3.ID},
		DeletedItemIDs:  []uint{docker.ID},
		StudioConfig: map[string]interface{}{
			"widgets": []interface{}{
				map[string]interface{}{"id": "w-todo", "type": "todo", "title": "TODO", "enabled": true, "colSpan": 2},
				map[string]interface{}{"id": "w-clock", "type": "clock", "title": "CLOCK", "enabled": true, "colSpan": 1},
			},
		},
	}

	// 1. Simulate a mid-transaction failure right after all DB writes (groups, items, deletes, module_config).
	err := saveDesktopLayoutInTx(db, 7, req, func(tx *gorm.DB) error {
		return errors.New("simulated mid-save failure")
	})
	if err == nil {
		t.Fatal("expected simulated mid-save failure")
	}

	// Verify 100% rollback: original groups, styles, items, and widget order are completely untouched.
	afterFail := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 7))
	if len(afterFail) != 3 {
		t.Fatalf("expected 3 original groups after rollback, got %#v", afterFail)
	}
	assertStyledCards(t, afterFail, "HomeLab", float64(0), []string{"Docker", "Proxmox"})
	assertStyledCards(t, afterFail, "Media", float64(1), []string{"Jellyfin"})
	assertStyledCards(t, afterFail, "Temporary", nil, []string{"Rescued", "GoneWithGroup"})
	if got := readWidgetOrder(t, db, 7); fmt.Sprint(got) != "[w-clock w-todo]" {
		t.Fatalf("widget order mutated despite rollback: %#v", got)
	}

	// 2. Also simulate a real SQLite write error during module_config update via trigger.
	if err := db.Exec(`CREATE TRIGGER fail_module_config BEFORE UPDATE ON module_config BEGIN SELECT RAISE(ABORT, 'simulated sqlite studio config write error'); END;`).Error; err != nil {
		t.Fatal(err)
	}
	rawBody, _ := json.Marshal(req)
	failedHTTP := performGroup(t, (&ItemIconGroup{}).SaveDesktopLayout, string(rawBody), 7)
	if failedHTTP["code"] == float64(0) {
		t.Fatalf("expected HTTP save failure under trigger, got %#v", failedHTTP)
	}
	if err := db.Exec(`DROP TRIGGER fail_module_config`).Error; err != nil {
		t.Fatal(err)
	}

	// Still completely untouched!
	afterTriggerFail := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 7))
	if len(afterTriggerFail) != 3 {
		t.Fatalf("expected 3 original groups after trigger rollback, got %#v", afterTriggerFail)
	}
	assertStyledCards(t, afterTriggerFail, "HomeLab", float64(0), []string{"Docker", "Proxmox"})
	assertStyledCards(t, afterTriggerFail, "Media", float64(1), []string{"Jellyfin"})
	assertStyledCards(t, afterTriggerFail, "Temporary", nil, []string{"Rescued", "GoneWithGroup"})
	if got := readWidgetOrder(t, db, 7); fmt.Sprint(got) != "[w-clock w-todo]" {
		t.Fatalf("widget order mutated despite trigger rollback: %#v", got)
	}

	// 3. Retry with the exact same draft payload: succeeds cleanly without duplicate creations or deletes!
	okHTTP := performGroup(t, (&ItemIconGroup{}).SaveDesktopLayout, string(rawBody), 7)
	if okHTTP["code"] != float64(0) {
		t.Fatalf("expected retry save to succeed, got %#v", okHTTP)
	}

	afterRetry := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 7))
	if len(afterRetry) != 3 {
		t.Fatalf("expected 3 final groups after retry, got %#v", afterRetry)
	}
	if afterRetry[0]["title"] != "Media Hub" || afterRetry[1]["title"] != "Core Infra" || afterRetry[2]["title"] != "AI Lab" {
		t.Fatalf("unexpected group order/names: %#v", afterRetry)
	}
	assertStyledCards(t, afterRetry, "Media Hub", float64(0), []string{"Proxmox", "Jellyfin", "Rescued"})
	assertStyledCards(t, afterRetry, "Core Infra", float64(1), []string{})
	assertStyledCards(t, afterRetry, "AI Lab", nil, []string{"OpenWebUI"})
	if got := readWidgetOrder(t, db, 7); fmt.Sprint(got) != "[w-todo w-clock]" {
		t.Fatalf("unexpected widget order after retry: %#v", got)
	}

	// Confirm GoneWithGroup and Docker were deleted cleanly (no orphans).
	var totalItems int64
	db.Model(&models.ItemIcon{}).Where("user_id = ?", 7).Count(&totalItems)
	if totalItems != 4 {
		t.Fatalf("expected 4 surviving items (Proxmox, Jellyfin, Rescued, OpenWebUI), got %d", totalItems)
	}
}

func TestSaveDesktopLayoutEnforcesAccountOwnershipAndRetention(t *testing.T) {
	db := openDesktopLayoutDB(t)
	g1, _, _, items := seedDesktopLayoutFixture(t, db)
	foreignGroup := models.ItemIconGroup{UserId: 9, Title: "OtherUser", Sort: 1}
	if err := db.Create(&foreignGroup).Error; err != nil {
		t.Fatal(err)
	}
	foreignItem := models.ItemIcon{UserId: 9, ItemIconGroupId: int(foreignGroup.ID), Title: "Secret", Url: "https://secret.local", OpenMethod: 2, Sort: 1, IconJson: `{"itemType":1,"text":"S"}`}
	if err := db.Create(&foreignItem).Error; err != nil {
		t.Fatal(err)
	}

	// Attempt to include another user's item inside user 7's layout save
	badItemReq, _ := json.Marshal(DesktopLayoutSaveRequest{
		Groups: []DesktopLayoutGroupInput{
			{
				ID:    g1.ID,
				Title: "Hijacked",
				Items: []DesktopLayoutItemInput{
					{ID: foreignItem.ID, Title: "Stolen", Url: "https://evil.local"},
				},
			},
		},
	})
	resp := performGroup(t, (&ItemIconGroup{}).SaveDesktopLayout, string(badItemReq), 7)
	if resp["code"] == float64(0) {
		t.Fatalf("expected foreign item reference to be rejected, got %#v", resp)
	}

	// Attempt to delete another user's group while modifying own group
	badDeleteReq, _ := json.Marshal(DesktopLayoutSaveRequest{
		Groups: []DesktopLayoutGroupInput{
			{
				ID:    g1.ID,
				Title: "Renamed",
				Items: []DesktopLayoutItemInput{
					{ID: items[0].ID, Title: items[0].Title, Url: items[0].Url},
				},
			},
		},
		DeletedGroupIDs: []uint{foreignGroup.ID},
	})
	resp2 := performGroup(t, (&ItemIconGroup{}).SaveDesktopLayout, string(badDeleteReq), 7)
	if resp2["code"] == float64(0) {
		t.Fatalf("expected foreign group delete to be rejected, got %#v", resp2)
	}

	// Attempt to submit zero groups
	emptyReq, _ := json.Marshal(DesktopLayoutSaveRequest{Groups: []DesktopLayoutGroupInput{}})
	resp3 := performGroup(t, (&ItemIconGroup{}).SaveDesktopLayout, string(emptyReq), 7)
	if resp3["code"] != float64(1201) {
		t.Fatalf("expected code 1201 for empty groups, got %#v", resp3)
	}

	// Verify neither user 7's group title nor user 9's data was touched
	var checkG1 models.ItemIconGroup
	db.First(&checkG1, g1.ID)
	if checkG1.Title != "HomeLab" {
		t.Fatalf("user 7 group should remain HomeLab after rejected tx, got %q", checkG1.Title)
	}
	var checkForeign models.ItemIconGroup
	if err := db.First(&checkForeign, foreignGroup.ID).Error; err != nil {
		t.Fatalf("foreign group should remain intact: %v", err)
	}
}
