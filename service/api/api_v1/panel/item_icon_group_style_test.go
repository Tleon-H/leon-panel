package panel

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"leon-panel/global"
	"leon-panel/models"

	"github.com/gin-gonic/gin"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func openPanelGroupDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:panel-group-%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NamingStrategy: schema.NamingStrategy{SingularTable: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if err := db.AutoMigrate(&models.ItemIconGroup{}, &models.ItemIcon{}); err != nil {
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

func performGroup(t *testing.T, method func(*gin.Context), body string, userID uint) map[string]interface{} {
	t.Helper()
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/", bytes.NewBufferString(body))
	ctx.Request.Header.Set("Content-Type", "application/json")
	if userID != 0 {
		ctx.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: userID}})
	}
	method(ctx)
	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response %s: %v", recorder.Body.String(), err)
	}
	return payload
}

func groupList(t *testing.T, userID uint) []map[string]interface{} {
	t.Helper()
	payload := performGroup(t, (&ItemIconGroup{}).GetList, "", userID)
	if payload["code"] != float64(0) {
		t.Fatalf("list = %#v", payload)
	}
	data, _ := payload["data"].(map[string]interface{})
	raw, _ := data["list"].([]interface{})
	rows := make([]map[string]interface{}, 0, len(raw))
	for _, item := range raw {
		row, _ := item.(map[string]interface{})
		rows = append(rows, row)
	}
	return rows
}

func storedIconStyle(t *testing.T, db *gorm.DB, id uint) (bool, int) {
	t.Helper()
	var row models.ItemIconGroup
	if err := db.First(&row, id).Error; err != nil {
		t.Fatal(err)
	}
	if row.IconStyle == nil {
		return false, 0
	}
	return true, *row.IconStyle
}

func TestGroupIconStyleIsOptionalAndScopedToTheAccount(t *testing.T) {
	db := openPanelGroupDB(t)
	api := ItemIconGroup{}

	created := performGroup(t, api.Edit, `{"title":"HOME","icon":"material-symbols:folder-outline","sort":1}`, 7)
	if created["code"] != float64(0) {
		t.Fatalf("create = %#v", created)
	}
	data, _ := created["data"].(map[string]interface{})
	if _, ok := data["iconStyle"]; data["iconStyle"] != nil || !ok {
		t.Fatalf("missing style was not returned as null: %#v", data)
	}
	homeID := uint(data["id"].(float64))
	if present, value := storedIconStyle(t, db, homeID); present {
		t.Fatalf("new group without a style was stored as %d", value)
	}

	detail := performGroup(t, api.Edit, `{"title":"详情","sort":2,"iconStyle":0}`, 7)
	if detail["code"] != float64(0) {
		t.Fatalf("detail create = %#v", detail)
	}
	detailData, _ := detail["data"].(map[string]interface{})
	detailID := uint(detailData["id"].(float64))
	if present, value := storedIconStyle(t, db, detailID); !present || value != 0 {
		t.Fatalf("detail style present=%v value=%d", present, value)
	}
	if detailData["iconStyle"] != float64(0) {
		t.Fatalf("detail response = %#v", detailData["iconStyle"])
	}

	small := performGroup(t, api.Edit, `{"title":"常用网站","sort":3,"iconStyle":1}`, 7)
	if small["code"] != float64(0) {
		t.Fatalf("small create = %#v", small)
	}
	smallData, _ := small["data"].(map[string]interface{})
	smallID := uint(smallData["id"].(float64))
	if present, value := storedIconStyle(t, db, smallID); !present || value != 1 {
		t.Fatalf("small style present=%v value=%d", present, value)
	}

	rejected := performGroup(t, api.Edit, fmt.Sprintf(`{"id":%d,"title":"HOME","iconStyle":2}`, homeID), 7)
	if rejected["code"] == float64(0) {
		t.Fatal("invalid style was saved")
	}
	if present, _ := storedIconStyle(t, db, homeID); present {
		t.Fatal("invalid style changed the stored value")
	}

	renamed := performGroup(t, api.Edit, fmt.Sprintf(`{"id":%d,"title":"家庭","icon":"material-symbols:folder-outline","sort":1}`, detailID), 7)
	if renamed["code"] != float64(0) {
		t.Fatalf("rename = %#v", renamed)
	}
	if present, value := storedIconStyle(t, db, detailID); !present || value != 0 {
		t.Fatalf("rename cleared the style present=%v value=%d", present, value)
	}
	renamedData, _ := renamed["data"].(map[string]interface{})
	if renamedData["title"] != "家庭" || renamedData["iconStyle"] != float64(0) {
		t.Fatalf("rename response = %#v", renamedData)
	}

	cleared := performGroup(t, api.Edit, fmt.Sprintf(`{"id":%d,"title":"家庭","iconStyle":null}`, detailID), 7)
	if cleared["code"] != float64(0) {
		t.Fatalf("clear = %#v", cleared)
	}
	if present, value := storedIconStyle(t, db, detailID); present {
		t.Fatalf("explicit null stored %d", value)
	}

	restored := performGroup(t, api.Edit, fmt.Sprintf(`{"id":%d,"title":"家庭","iconStyle":0}`, detailID), 7)
	if restored["code"] != float64(0) {
		t.Fatalf("restore style = %#v", restored)
	}
	if present, value := storedIconStyle(t, db, detailID); !present || value != 0 {
		t.Fatalf("zero style was not stored present=%v value=%d", present, value)
	}

	stolen := performGroup(t, api.Edit, fmt.Sprintf(`{"id":%d,"title":"被改","iconStyle":1}`, smallID), 8)
	if stolen["code"] == float64(0) {
		t.Fatal("another account changed the group")
	}
	var owner models.ItemIconGroup
	if err := db.First(&owner, smallID).Error; err != nil {
		t.Fatal(err)
	}
	if owner.UserId != 7 || owner.Title != "常用网站" || owner.IconStyle == nil || *owner.IconStyle != 1 {
		t.Fatalf("owner row changed: %#v", owner)
	}

	sorted := performGroup(t, api.SaveSort, fmt.Sprintf(`{"sortItems":[{"id":%d,"sort":9}]}`, smallID), 7)
	if sorted["code"] != float64(0) {
		t.Fatalf("sort = %#v", sorted)
	}
	if err := db.First(&owner, smallID).Error; err != nil {
		t.Fatal(err)
	}
	if owner.Sort != 9 || owner.IconStyle == nil || *owner.IconStyle != 1 {
		t.Fatalf("sort changed the style: %#v", owner)
	}

	rows := groupList(t, 7)
	if len(rows) != 3 {
		t.Fatalf("list = %#v", rows)
	}
	found := map[string]interface{}{}
	for _, row := range rows {
		found[row["title"].(string)] = row["iconStyle"]
	}
	if found["HOME"] != nil || found["家庭"] != float64(0) || found["常用网站"] != float64(1) {
		t.Fatalf("styles = %#v", found)
	}

	empty := groupList(t, 9)
	if len(empty) != 1 || empty[0]["title"] != "APP" || empty[0]["iconStyle"] != nil {
		t.Fatalf("default group = %#v", empty)
	}
}

// 访客和已登录用户走同一个 GetList。中间件先把访客解析成公开账号，所以这里用两个账号分别请求。
func TestIncludeItemsReturnsOwnedStylesAndSortedCards(t *testing.T) {
	db := openPanelGroupDB(t)
	info := 0
	small := 1
	home := models.ItemIconGroup{UserId: 7, Title: "HOME", Sort: 1, IconStyle: &info}
	sites := models.ItemIconGroup{UserId: 7, Title: "常用网站", Sort: 2, IconStyle: &small}
	plain := models.ItemIconGroup{UserId: 7, Title: "未设置", Sort: 3}
	guest := models.ItemIconGroup{UserId: 9, Title: "访客首页", Sort: 1, IconStyle: &info}
	for _, group := range []*models.ItemIconGroup{&home, &sites, &plain, &guest} {
		if err := db.Create(group).Error; err != nil {
			t.Fatal(err)
		}
	}
	icons := []models.ItemIcon{
		{UserId: 7, ItemIconGroupId: int(home.ID), Title: "相册", Sort: 2, IconJson: `{"itemType":1,"text":"相册"}`},
		{UserId: 7, ItemIconGroupId: int(home.ID), Title: "路由", Sort: 1, IconJson: `{"itemType":1,"text":"路由"}`},
		{UserId: 9, ItemIconGroupId: int(home.ID), Title: "别人的卡片", Sort: 1, IconJson: `{"itemType":1,"text":"别人"}`},
		{UserId: 7, ItemIconGroupId: int(sites.ID), Title: "百度", Sort: 1, IconJson: `{"itemType":1,"text":"百度"}`},
		{UserId: 7, ItemIconGroupId: int(plain.ID), Title: "笔记", Sort: 1, IconJson: `{"itemType":1,"text":"笔记"}`},
		{UserId: 9, ItemIconGroupId: int(guest.ID), Title: "公开", Sort: 1, IconJson: `{"itemType":1,"text":"公开"}`},
	}
	if err := db.Create(&icons).Error; err != nil {
		t.Fatal(err)
	}

	legacy := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{}`, 7))
	if len(legacy) != 3 {
		t.Fatalf("legacy groups = %#v", legacy)
	}
	for _, row := range legacy {
		if _, ok := row["items"]; ok {
			t.Fatalf("old client received items: %#v", row)
		}
	}
	if legacy[0]["title"] != "HOME" || legacy[0]["iconStyle"] != float64(0) || legacy[1]["title"] != "常用网站" || legacy[1]["iconStyle"] != float64(1) || legacy[2]["title"] != "未设置" || legacy[2]["iconStyle"] != nil {
		t.Fatalf("legacy styles = %#v", legacy)
	}

	loaded := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true,"userId":9}`, 7))
	assertStyledCards(t, loaded, "HOME", float64(0), []string{"路由", "相册"})
	assertStyledCards(t, loaded, "常用网站", float64(1), []string{"百度"})
	assertStyledCards(t, loaded, "未设置", nil, []string{"笔记"})
	if len(loaded) != 3 {
		t.Fatalf("logged-in groups = %#v", loaded)
	}

	guestRows := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 9))
	assertStyledCards(t, guestRows, "访客首页", float64(0), []string{"公开"})
	if len(guestRows) != 1 {
		t.Fatalf("guest groups = %#v", guestRows)
	}

	albumID := iconID(t, loaded, "HOME", "相册")
	routeID := iconID(t, loaded, "HOME", "路由")
	sorted := performGroup(t, (&ItemIcon{}).SaveSort, fmt.Sprintf(`{"itemIconGroupId":%d,"sortItems":[{"id":%d,"sort":1},{"id":%d,"sort":2}]}`, home.ID, albumID, routeID), 7)
	if sorted["code"] != float64(0) {
		t.Fatalf("sort = %#v", sorted)
	}
	refreshed := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 7))
	assertStyledCards(t, refreshed, "HOME", float64(0), []string{"相册", "路由"})

	cleared := performGroup(t, (&ItemIconGroup{}).Edit, fmt.Sprintf(`{"id":%d,"title":"HOME","iconStyle":null}`, home.ID), 7)
	if cleared["code"] != float64(0) {
		t.Fatalf("clear style = %#v", cleared)
	}
	detail := performGroup(t, (&ItemIconGroup{}).Edit, fmt.Sprintf(`{"id":%d,"title":"未设置","iconStyle":0}`, plain.ID), 7)
	if detail["code"] != float64(0) {
		t.Fatalf("save style = %#v", detail)
	}
	afterEdit := groupRows(t, performGroup(t, (&ItemIconGroup{}).GetList, `{"includeItems":true}`, 7))
	assertStyledCards(t, afterEdit, "HOME", nil, []string{"相册", "路由"})
	assertStyledCards(t, afterEdit, "未设置", float64(0), []string{"笔记"})
	assertStyledCards(t, afterEdit, "常用网站", float64(1), []string{"百度"})
}

func groupRows(t *testing.T, payload map[string]interface{}) []map[string]interface{} {
	t.Helper()
	if payload["code"] != float64(0) {
		t.Fatalf("list = %#v", payload)
	}
	data, _ := payload["data"].(map[string]interface{})
	raw, _ := data["list"].([]interface{})
	rows := make([]map[string]interface{}, 0, len(raw))
	for _, item := range raw {
		row, _ := item.(map[string]interface{})
		rows = append(rows, row)
	}
	return rows
}

func assertStyledCards(t *testing.T, rows []map[string]interface{}, title string, style interface{}, cards []string) {
	t.Helper()
	for _, row := range rows {
		if row["title"] != title {
			continue
		}
		got, ok := row["iconStyle"]
		if !ok || got != style {
			t.Fatalf("%s style present=%v value=%#v", title, ok, got)
		}
		raw, _ := row["items"].([]interface{})
		if len(raw) != len(cards) {
			t.Fatalf("%s cards = %#v", title, raw)
		}
		for i, card := range cards {
			item, _ := raw[i].(map[string]interface{})
			if item["title"] != card {
				t.Fatalf("%s order = %#v", title, raw)
			}
			icon, _ := item["icon"].(map[string]interface{})
			if icon["text"] != card {
				t.Fatalf("%s icon = %#v", title, item["icon"])
			}
		}
		return
	}
	t.Fatalf("missing group %s in %#v", title, rows)
}

func iconID(t *testing.T, rows []map[string]interface{}, groupTitle, cardTitle string) uint {
	t.Helper()
	for _, row := range rows {
		if row["title"] != groupTitle {
			continue
		}
		raw, _ := row["items"].([]interface{})
		for _, item := range raw {
			card, _ := item.(map[string]interface{})
			if card["title"] == cardTitle {
				return uint(card["id"].(float64))
			}
		}
	}
	t.Fatalf("missing card %s/%s", groupTitle, cardTitle)
	return 0
}
