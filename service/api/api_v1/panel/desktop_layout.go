package panel

import (
	"encoding/json"
	"errors"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/models"
	"leon-panel/models/datatype"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

const studioConfigModuleName = "module-leonStudioConfig"

type DesktopLayoutItemInput struct {
	ID          uint                      `json:"id"`
	TempID      string                    `json:"tempId"`
	Icon        datatype.ItemIconIconInfo `json:"icon"`
	Title       string                    `json:"title"`
	Url         string                    `json:"url"`
	LanUrl      string                    `json:"lanUrl"`
	Description string                    `json:"description"`
	OpenMethod  int                       `json:"openMethod"`
	Sort        int                       `json:"sort"`
}

type DesktopLayoutGroupInput struct {
	ID          uint                     `json:"id"`
	TempID      string                   `json:"tempId"`
	Title       string                   `json:"title"`
	Icon        string                   `json:"icon"`
	Description string                   `json:"description"`
	IconStyle   *int                     `json:"iconStyle"`
	Sort        int                      `json:"sort"`
	Items       []DesktopLayoutItemInput `json:"items"`
}

type DesktopLayoutSaveRequest struct {
	Groups          []DesktopLayoutGroupInput `json:"groups"`
	DeletedGroupIDs []uint                    `json:"deletedGroupIds"`
	DeletedItemIDs  []uint                    `json:"deletedItemIds"`
	StudioConfig    map[string]interface{}    `json:"studioConfig"`
}

type desktopLayoutValidationError struct {
	code int
	msg  string
}

func (e *desktopLayoutValidationError) Error() string {
	return e.msg
}

func saveDesktopLayoutInTx(
	db *gorm.DB,
	userID uint,
	req DesktopLayoutSaveRequest,
	beforeCommit func(tx *gorm.DB) error,
) error {
	if len(req.Groups) == 0 {
		return &desktopLayoutValidationError{code: 1201, msg: "At least one group must be retained"}
	}

	return db.Transaction(func(tx *gorm.DB) error {
		var existingGroups []models.ItemIconGroup
		if err := tx.Where("user_id = ?", userID).Find(&existingGroups).Error; err != nil {
			return err
		}
		ownedGroups := make(map[uint]models.ItemIconGroup, len(existingGroups))
		for _, g := range existingGroups {
			ownedGroups[g.ID] = g
		}

		var existingItems []models.ItemIcon
		if err := tx.Where("user_id = ?", userID).Find(&existingItems).Error; err != nil {
			return err
		}
		ownedItems := make(map[uint]models.ItemIcon, len(existingItems))
		for _, it := range existingItems {
			ownedItems[it.ID] = it
		}

		deletedGroupSet := make(map[uint]struct{}, len(req.DeletedGroupIDs))
		dedupDeletedGroupIDs := make([]uint, 0, len(req.DeletedGroupIDs))
		for _, gid := range req.DeletedGroupIDs {
			if gid == 0 {
				continue
			}
			if _, ok := ownedGroups[gid]; !ok {
				return &desktopLayoutValidationError{code: 1202, msg: "Group not found or access denied"}
			}
			if _, dup := deletedGroupSet[gid]; !dup {
				deletedGroupSet[gid] = struct{}{}
				dedupDeletedGroupIDs = append(dedupDeletedGroupIDs, gid)
			}
		}

		deletedItemSet := make(map[uint]struct{}, len(req.DeletedItemIDs))
		dedupDeletedItemIDs := make([]uint, 0, len(req.DeletedItemIDs))
		for _, iid := range req.DeletedItemIDs {
			if iid == 0 {
				continue
			}
			if _, ok := ownedItems[iid]; !ok {
				return &desktopLayoutValidationError{code: 1202, msg: "Item not found or access denied"}
			}
			if _, dup := deletedItemSet[iid]; !dup {
				deletedItemSet[iid] = struct{}{}
				dedupDeletedItemIDs = append(dedupDeletedItemIDs, iid)
			}
		}

		seenGroupIDs := make(map[uint]struct{}, len(req.Groups))
		seenItemIDs := make(map[uint]struct{}, len(existingItems))

		for _, g := range req.Groups {
			if strings.TrimSpace(g.Title) == "" {
				return &desktopLayoutValidationError{code: 1400, msg: "Group title is required"}
			}
			if !models.ValidGroupIconStyle(g.IconStyle) {
				return &desktopLayoutValidationError{code: -1, msg: "分组卡片样式只能选择跟随全局、详情图标或小图标"}
			}
			if g.ID != 0 {
				if _, ok := ownedGroups[g.ID]; !ok {
					return &desktopLayoutValidationError{code: 1202, msg: "Group not found or access denied"}
				}
				if _, dup := seenGroupIDs[g.ID]; dup {
					return &desktopLayoutValidationError{code: 1400, msg: "Duplicate group id in layout payload"}
				}
				if _, del := deletedGroupSet[g.ID]; del {
					return &desktopLayoutValidationError{code: 1400, msg: "Group cannot be both updated and deleted"}
				}
				seenGroupIDs[g.ID] = struct{}{}
			}
			for _, it := range g.Items {
				if it.ID != 0 {
					if _, ok := ownedItems[it.ID]; !ok {
						return &desktopLayoutValidationError{code: 1202, msg: "Item not found or access denied"}
					}
					if _, dup := seenItemIDs[it.ID]; dup {
						return &desktopLayoutValidationError{code: 1400, msg: "Duplicate item id in layout payload"}
					}
					if _, del := deletedItemSet[it.ID]; del {
						return &desktopLayoutValidationError{code: 1400, msg: "Item cannot be both updated and deleted"}
					}
					seenItemIDs[it.ID] = struct{}{}
				} else {
					if strings.TrimSpace(it.Title) == "" || strings.TrimSpace(it.Url) == "" {
						return &desktopLayoutValidationError{code: 1400, msg: "New item title and url are required"}
					}
				}
			}
		}

		// Step A: Create or update all surviving groups in their final sort order.
		resolvedGroupIDs := make([]uint, len(req.Groups))
		for gIdx, g := range req.Groups {
			title := strings.TrimSpace(g.Title)
			icon := g.Icon
			if strings.TrimSpace(icon) == "" {
				icon = "lucide:folder-kanban"
			}
			sortVal := gIdx + 1

			if g.ID == 0 {
				created := models.ItemIconGroup{
					UserId:      userID,
					Title:       title,
					Icon:        icon,
					Description: g.Description,
					Sort:        sortVal,
					IconStyle:   g.IconStyle,
				}
				if err := tx.Create(&created).Error; err != nil {
					return err
				}
				resolvedGroupIDs[gIdx] = created.ID
			} else {
				updates := map[string]interface{}{
					"title":       title,
					"icon":        icon,
					"description": g.Description,
					"sort":        sortVal,
				}
				if g.IconStyle == nil {
					updates["icon_style"] = nil
				} else {
					updates["icon_style"] = *g.IconStyle
				}
				if err := tx.Model(&models.ItemIconGroup{}).
					Where("id = ? AND user_id = ?", g.ID, userID).
					Updates(updates).Error; err != nil {
					return err
				}
				resolvedGroupIDs[gIdx] = g.ID
			}
		}

		// Step B: Create, update, and re-parent surviving items BEFORE deleting removed groups/items.
		// This guarantees icons dragged out of a deleted group into a surviving group are preserved.
		for gIdx, g := range req.Groups {
			targetGroupID := int(resolvedGroupIDs[gIdx])
			for iIdx, it := range g.Items {
				itemSort := iIdx + 1
				var iconJson string
				if it.ID != 0 && it.Icon.ItemType == 0 {
					iconJson = ownedItems[it.ID].IconJson
				} else if jb, err := json.Marshal(it.Icon); err == nil {
					iconJson = string(jb)
				}

				if it.ID == 0 {
					openMethod := it.OpenMethod
					if openMethod == 0 {
						openMethod = 2
					}
					createdItem := models.ItemIcon{
						UserId:          userID,
						ItemIconGroupId: targetGroupID,
						IconJson:        iconJson,
						Title:           strings.TrimSpace(it.Title),
						Url:             it.Url,
						LanUrl:          it.LanUrl,
						Description:     it.Description,
						OpenMethod:      openMethod,
						Sort:            itemSort,
					}
					if err := tx.Create(&createdItem).Error; err != nil {
						return err
					}
				} else {
					existing := ownedItems[it.ID]
					title := existing.Title
					if strings.TrimSpace(it.Title) != "" {
						title = strings.TrimSpace(it.Title)
					}
					urlVal := existing.Url
					if it.Url != "" {
						urlVal = it.Url
					}
					openMethod := it.OpenMethod
					if openMethod == 0 {
						openMethod = existing.OpenMethod
					}
					updates := map[string]interface{}{
						"item_icon_group_id": targetGroupID,
						"sort":               itemSort,
						"title":              title,
						"url":                urlVal,
						"lan_url":            it.LanUrl,
						"description":        it.Description,
						"open_method":        openMethod,
						"icon_json":          iconJson,
					}
					if err := tx.Model(&models.ItemIcon{}).
						Where("id = ? AND user_id = ?", it.ID, userID).
						Updates(updates).Error; err != nil {
						return err
					}
				}
			}
		}

		// Step C: Delete explicitly deleted items.
		if len(dedupDeletedItemIDs) > 0 {
			if err := tx.Delete(&models.ItemIcon{}, "id IN ? AND user_id = ?", dedupDeletedItemIDs, userID).Error; err != nil {
				return err
			}
		}

		// Step D: Delete removed groups and any items still assigned to them.
		if len(dedupDeletedGroupIDs) > 0 {
			if err := tx.Delete(&models.ItemIconGroup{}, "id IN ? AND user_id = ?", dedupDeletedGroupIDs, userID).Error; err != nil {
				return err
			}
			if err := (&models.ItemIcon{}).DeleteByItemIconGroupIds(tx, userID, dedupDeletedGroupIDs); err != nil {
				return err
			}
		}

		var remainingCount int64
		if err := tx.Model(&models.ItemIconGroup{}).Where("user_id = ?", userID).Count(&remainingCount).Error; err != nil {
			return err
		}
		if remainingCount < 1 {
			return &desktopLayoutValidationError{code: 1201, msg: "At least one group must be retained"}
		}

		// Step E: Save desktop studioConfig (widgets order/span/deletes) inside the exact same transaction.
		if req.StudioConfig != nil {
			mCfg := models.ModuleConfig{
				UserId: userID,
				Name:   studioConfigModuleName,
				Value:  req.StudioConfig,
			}
			if err := mCfg.Save(tx); err != nil {
				return err
			}
		}

		if beforeCommit != nil {
			if err := beforeCommit(tx); err != nil {
				return err
			}
		}

		return nil
	})
}

// SaveDesktopLayout 在单个数据库事务内原子提交桌面编辑模式的全部改动（分组、图标与桌面小组件配置）。
func (a *ItemIconGroup) SaveDesktopLayout(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}

	req := DesktopLayoutSaveRequest{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if err := saveDesktopLayoutInTx(global.Db, userInfo.ID, req, nil); err != nil {
		var vErr *desktopLayoutValidationError
		if errors.As(err, &vErr) {
			if vErr.code > 0 {
				apiReturn.ErrorCode(c, vErr.code, vErr.msg, nil)
			} else {
				apiReturn.Error(c, vErr.msg)
			}
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.Success(c)
}
