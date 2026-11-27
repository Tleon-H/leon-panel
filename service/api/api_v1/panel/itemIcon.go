package panel

import (
	"encoding/json"
	"errors"
	"fmt"
	"leon-panel/api/api_v1/common/apiData/commonApiStructs"
	"leon-panel/api/api_v1/common/apiData/panelApiStructs"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn"
	"leon-panel/lib/siteFavicon"
	"leon-panel/models"
	"os"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type ItemIcon struct {
}

func verifyOwnedGroup(db *gorm.DB, userID uint, groupID int) error {
	if groupID <= 0 {
		return gorm.ErrRecordNotFound
	}
	var group models.ItemIconGroup
	return db.Where("id = ? AND user_id = ?", groupID, userID).First(&group).Error
}

func (a *ItemIcon) Edit(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := models.ItemIcon{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if req.ItemIconGroupId <= 0 {
		apiReturn.ErrorParamFomat(c, "Group is mandatory")
		return
	}

	if err := verifyOwnedGroup(global.Db, userInfo.ID, req.ItemIconGroupId); err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apiReturn.ErrorDataNotFound(c)
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	if j, err := json.Marshal(req.Icon); err == nil {
		req.IconJson = string(j)
	}

	if req.ID != 0 {
		var existing models.ItemIcon
		if err := global.Db.Where("id = ? AND user_id = ?", req.ID, userInfo.ID).First(&existing).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				apiReturn.ErrorDataNotFound(c)
				return
			}
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}

		updates := map[string]interface{}{
			"icon_json":          req.IconJson,
			"title":              req.Title,
			"url":                req.Url,
			"lan_url":            req.LanUrl,
			"description":        req.Description,
			"open_method":        req.OpenMethod,
			"item_icon_group_id": req.ItemIconGroupId,
		}
		if req.Sort != 0 {
			updates["sort"] = req.Sort
		}
		if err := global.Db.Model(&models.ItemIcon{}).
			Where("id = ? AND user_id = ?", req.ID, userInfo.ID).
			Updates(updates).Error; err != nil {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}

		var saved models.ItemIcon
		if err := global.Db.Where("id = ? AND user_id = ?", req.ID, userInfo.ID).First(&saved).Error; err != nil {
			apiReturn.ErrorDatabase(c, err.Error())
			return
		}
		_ = json.Unmarshal([]byte(saved.IconJson), &saved.Icon)
		apiReturn.SuccessData(c, saved)
		return
	}

	req.UserId = userInfo.ID
	req.Sort = 9999
	if err := global.Db.Create(&req).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.SuccessData(c, req)
}

// 添加多个图标
func (a *ItemIcon) AddMultiple(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := []models.ItemIcon{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if len(req) == 0 {
		apiReturn.SuccessData(c, []models.ItemIcon{})
		return
	}

	uniqueGroupIDs := make([]int, 0, len(req))
	seenGroups := make(map[int]struct{}, len(req))
	for i := 0; i < len(req); i++ {
		if req[i].ItemIconGroupId <= 0 {
			apiReturn.ErrorParamFomat(c, "Group is mandatory")
			return
		}
		if _, exists := seenGroups[req[i].ItemIconGroupId]; !exists {
			seenGroups[req[i].ItemIconGroupId] = struct{}{}
			uniqueGroupIDs = append(uniqueGroupIDs, req[i].ItemIconGroupId)
		}
		req[i].ID = 0
		req[i].UserId = userInfo.ID
		if j, err := json.Marshal(req[i].Icon); err == nil {
			req[i].IconJson = string(j)
		}
	}

	var ownedGroupCount int64
	if err := global.Db.Model(&models.ItemIconGroup{}).
		Where("id IN ? AND user_id = ?", uniqueGroupIDs, userInfo.ID).
		Count(&ownedGroupCount).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	if int(ownedGroupCount) != len(uniqueGroupIDs) {
		apiReturn.ErrorDataNotFound(c)
		return
	}

	if err := global.Db.Create(&req).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.SuccessData(c, req)
}

// // 获取详情
// func (a *ItemIcon) GetInfo(c *gin.Context) {
// 	req := systemApiStructs.AiDrawGetInfoReq{}

// 	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
// 		apiReturn.ErrorParamFomat(c, err.Error())
// 		return
// 	}

// 	userInfo, _ := base.GetCurrentUserInfo(c)

// 	aiDraw := models.AiDraw{}
// 	aiDraw.ID = req.ID
// 	if err := aiDraw.GetInfo(global.Db); err != nil {
// 		if err == gorm.ErrRecordNotFound {
// 			apiReturn.Error(c, "不存在记录")
// 			return
// 		}
// 		apiReturn.ErrorDatabase(c, err.Error())
// 		return
// 	}

// 	if userInfo.ID != aiDraw.UserID {
// 		apiReturn.ErrorNoAccess(c)
// 		return
// 	}

// 	apiReturn.SuccessData(c, aiDraw)
// }

func (a *ItemIcon) GetListByGroupId(c *gin.Context) {
	req := models.ItemIcon{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	userInfo, _ := base.GetCurrentUserInfo(c)
	itemIcons := []models.ItemIcon{}

	if err := global.Db.Order("sort ,created_at").Find(&itemIcons, "item_icon_group_id = ? AND user_id=?", req.ItemIconGroupId, userInfo.ID).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	for k, v := range itemIcons {
		json.Unmarshal([]byte(v.IconJson), &itemIcons[k].Icon)
	}

	apiReturn.SuccessListData(c, itemIcons, 0)
}

func (a *ItemIcon) Deletes(c *gin.Context) {
	req := commonApiStructs.RequestDeleteIds[uint]{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	userInfo, _ := base.GetCurrentUserInfo(c)
	if err := global.Db.Delete(&models.ItemIcon{}, "id in ? AND user_id=?", req.Ids, userInfo.ID).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.Success(c)
}

// 保存排序（同时支持桌面编辑模式下的跨分组拖拽归属更新）
func (a *ItemIcon) SaveSort(c *gin.Context) {
	req := panelApiStructs.ItemIconSaveSortRequest{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	userInfo, _ := base.GetCurrentUserInfo(c)

	var targetGroup models.ItemIconGroup
	if err := global.Db.Where("id = ? AND user_id = ?", req.ItemIconGroupId, userInfo.ID).First(&targetGroup).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			apiReturn.ErrorDataNotFound(c)
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	transactionErr := global.Db.Transaction(func(tx *gorm.DB) error {
		// 在事务中执行一些 db 操作（从这里开始，您应该使用 'tx' 而不是 'db'）
		for _, v := range req.SortItems {
			if err := tx.Model(&models.ItemIcon{}).
				Where("user_id=? AND id=?", userInfo.ID, v.Id).
				Updates(map[string]interface{}{
					"sort":               v.Sort,
					"item_icon_group_id": req.ItemIconGroupId,
				}).Error; err != nil {
				// 返回任何错误都会回滚事务
				return err
			}
		}

		// 返回 nil 提交事务
		return nil
	})

	if transactionErr != nil {
		apiReturn.ErrorDatabase(c, transactionErr.Error())
		return
	}

	apiReturn.Success(c)
}

// 支持获取并直接下载对方网站图标到服务器
func (a *ItemIcon) GetSiteFavicon(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := panelApiStructs.ItemIconGetSiteFaviconReq{}

	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	configUpload := "./uploads"
	if global.Config != nil {
		if configured := strings.TrimSpace(global.Config.GetValueString("base", "source_path")); configured != "" {
			configUpload = configured
		}
	}
	now := time.Now()
	saveDir := fmt.Sprintf("%s/%d/%d/%d", strings.TrimRight(configUpload, "/"), now.Year(), now.Month(), now.Day())

	saved, err := siteFavicon.FetchAndSaveBestFavicon(req.Url, saveDir, 2*1024*1024)
	if err != nil {
		apiReturn.Error(c, err.Error())
		return
	}

	// 保存到数据库
	mFile := models.File{}
	if _, err := mFile.AddFile(userInfo.ID, saved.Host, saved.Ext, saved.FilePath, models.FileCategoryIcon); err != nil {
		_ = os.Remove(saved.FilePath)
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	iconURL := cmn.UploadPublicURL(saved.FilePath)
	resp := panelApiStructs.ItemIconGetSiteFaviconResp{
		IconUrl: iconURL,
	}
	apiReturn.SuccessData(c, resp)
}
