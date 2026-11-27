package panel

import (
	"errors"
	"leon-panel/api/api_v1/common/apiData/systemApiStructs"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn"
	"leon-panel/lib/cmn/systemSetting"
	"leon-panel/lib/sessionguard"
	"leon-panel/models"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
	"gorm.io/gorm"
)

type UsersApi struct {
}

var (
	ErrUsersApiAtLeastKeepOne = errors.New("at least keep one")
)

type userCreateReq struct {
	Username  string `json:"username" validate:"required"`
	Password  string `json:"password" validate:"required"`
	Name      string `json:"name"`
	HeadImage string `json:"headImage"`
	Role      int    `json:"role"`
}

type userUpdateReq struct {
	ID        uint   `json:"id" validate:"required"`
	Username  string `json:"username" validate:"required"`
	Password  string `json:"password"`
	Name      string `json:"name"`
	HeadImage string `json:"headImage"`
	Mail      string `json:"mail"`
	Role      int    `json:"role"`
	Status    *int   `json:"status"`
}

func validUserRole(role int) bool {
	return role == 1 || role == 2
}

func validUserStatus(status int) bool {
	return status == 1 || status == 2 || status == 3
}

func (a UsersApi) Create(c *gin.Context) {
	param := userCreateReq{}
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if errMsg, err := base.ValidateInputStruct(param); err != nil {
		apiReturn.ErrorParamFomat(c, errMsg)
		return
	}

	param.Username = strings.TrimSpace(param.Username)
	if len(param.Username) < 5 {
		apiReturn.ErrorParamFomat(c, "The account must be no less than 5 characters long")
		return
	}

	role := param.Role
	if role == 0 {
		role = 2
	}
	if !validUserRole(role) {
		apiReturn.ErrorParamFomat(c, "Invalid user role")
		return
	}

	mUser := models.User{
		Username:  param.Username,
		Password:  cmn.PasswordEncryption(param.Password),
		Name:      param.Name,
		HeadImage: param.HeadImage,
		Status:    1,
		Role:      role,
	}

	if _, err := mUser.CheckUsernameExist(param.Username); err != nil {
		apiReturn.ErrorByCode(c, 1006)
		return
	}

	userInfo, err := mUser.CreateOne()
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	apiReturn.SuccessData(c, gin.H{"id": userInfo.ID, "userId": userInfo.ID})
}

func (a UsersApi) Deletes(c *gin.Context) {
	type UserIds struct {
		UserIds []uint `json:"userIds"`
	}
	param := UserIds{}
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		c.Abort()
		return
	}

	uniqueIDs := make([]uint, 0, len(param.UserIds))
	seen := make(map[uint]struct{}, len(param.UserIds))
	for _, id := range param.UserIds {
		if id == 0 {
			continue
		}
		if _, dup := seen[id]; !dup {
			seen[id] = struct{}{}
			uniqueIDs = append(uniqueIDs, id)
		}
	}
	if len(uniqueIDs) == 0 {
		apiReturn.ErrorParamFomat(c, "userIds is required")
		return
	}

	var tokensToEvict []string

	txErr := global.Db.Transaction(func(tx *gorm.DB) error {
		var targetUsers []models.User
		if err := tx.Where("id IN ?", uniqueIDs).Find(&targetUsers).Error; err != nil {
			return err
		}
		for _, u := range targetUsers {
			if u.Token != "" {
				tokensToEvict = append(tokensToEvict, u.Token)
			}
		}

		mitemIconGroup := models.ItemIconGroup{}
		for _, uid := range uniqueIDs {
			if err := tx.Delete(&models.ItemIcon{}, "user_id = ?", uid).Error; err != nil {
				return err
			}
			if err := mitemIconGroup.DeleteByUserId(tx, uid); err != nil {
				return err
			}
			if err := tx.Delete(&models.ModuleConfig{}, "user_id = ?", uid).Error; err != nil {
				return err
			}
			if err := tx.Delete(&models.UserConfig{}, "user_id = ?", uid).Error; err != nil {
				return err
			}
		}

		if err := tx.Model(&models.User{}).Where("id IN ?", uniqueIDs).Update("token", "").Error; err != nil {
			return err
		}
		if err := tx.Delete(&models.User{}, uniqueIDs).Error; err != nil {
			return err
		}

		// Ensure at least one active administrator remains.
		var activeAdminCount int64
		if err := tx.Model(&models.User{}).Where("role = ? AND status = ?", 1, 1).Count(&activeAdminCount).Error; err != nil {
			return err
		}
		if activeAdminCount == 0 {
			return ErrUsersApiAtLeastKeepOne
		}

		return nil
	})
	if errors.Is(txErr, ErrUsersApiAtLeastKeepOne) {
		apiReturn.ErrorByCode(c, 1201)
		return
	}
	if txErr != nil {
		apiReturn.ErrorDatabase(c, txErr.Error())
		return
	}

	for _, tok := range tokensToEvict {
		sessionguard.EvictUserToken(global.UserToken, tok)
	}

	apiReturn.Success(c)
}

func (a UsersApi) Update(c *gin.Context) {
	param := userUpdateReq{}
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		c.Abort()
		return
	}

	if errMsg, err := base.ValidateInputStruct(param); err != nil {
		apiReturn.ErrorParamFomat(c, errMsg)
		return
	}

	param.Username = strings.TrimSpace(param.Username)
	if len(param.Username) < 3 {
		apiReturn.ErrorParamFomat(c, "The account must be no less than 3 characters long")
		return
	}

	var existing models.User
	if err := global.Db.First(&existing, "id = ?", param.ID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apiReturn.ErrorDataNotFound(c)
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	mUser := models.User{}
	if found, err := mUser.CheckUsernameExist(param.Username); err != nil && found.ID != existing.ID {
		apiReturn.ErrorByCode(c, 1006)
		return
	}

	nextRole := existing.Role
	if param.Role != 0 {
		if !validUserRole(param.Role) {
			apiReturn.ErrorParamFomat(c, "Invalid user role")
			return
		}
		nextRole = param.Role
	}

	nextStatus := existing.Status
	if param.Status != nil {
		if !validUserStatus(*param.Status) {
			apiReturn.ErrorParamFomat(c, "Invalid user status")
			return
		}
		nextStatus = *param.Status
	}

	updates := map[string]interface{}{
		"username": param.Username,
		"name":     param.Name,
		"mail":     param.Mail,
		"role":     nextRole,
		"status":   nextStatus,
		"token":    "",
	}
	if param.HeadImage != "" {
		updates["head_image"] = param.HeadImage
	}
	if param.Password != "" && param.Password != "-" {
		updates["password"] = cmn.PasswordEncryption(param.Password)
	}

	txErr := global.Db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&models.User{}).Where("id = ?", existing.ID).Updates(updates).Error; err != nil {
			return err
		}

		var activeAdminCount int64
		if err := tx.Model(&models.User{}).Where("role = ? AND status = ?", 1, 1).Count(&activeAdminCount).Error; err != nil {
			return err
		}
		if activeAdminCount == 0 {
			return ErrUsersApiAtLeastKeepOne
		}
		return nil
	})
	if errors.Is(txErr, ErrUsersApiAtLeastKeepOne) {
		apiReturn.ErrorByCode(c, 1201)
		return
	}
	if txErr != nil {
		apiReturn.ErrorDatabase(c, txErr.Error())
		return
	}

	sessionguard.EvictUserToken(global.UserToken, existing.Token)

	var updated models.User
	if err := global.Db.First(&updated, "id = ?", existing.ID).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessData(c, systemApiStructs.ToAdminUserItemResp(updated))
}

func (a UsersApi) GetList(c *gin.Context) {
	type ParamsStruct struct {
		Limit   int    `json:"limit"`
		Page    int    `json:"page"`
		Keyword string `json:"keyword"`
	}

	param := ParamsStruct{}
	if err := c.ShouldBindBodyWith(&param, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		c.Abort()
		return
	}

	var (
		list  []models.User
		count int64
	)
	db := global.Db.Model(&models.User{})

	if param.Keyword != "" {
		db = db.Where("name LIKE ? OR username LIKE ?", "%"+param.Keyword+"%", "%"+param.Keyword+"%")
	}

	if err := db.Count(&count).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	query := db
	if param.Limit > 0 {
		page := param.Page
		if page < 1 {
			page = 1
		}
		query = query.Limit(param.Limit).Offset((page - 1) * param.Limit)
	}
	if err := query.Find(&list).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	respList := make([]systemApiStructs.AdminUserItemResp, 0, len(list))
	for _, u := range list {
		respList = append(respList, systemApiStructs.ToAdminUserItemResp(u))
	}

	apiReturn.SuccessListData(c, respList, count)
}

func (a UsersApi) SetPublicVisitUser(c *gin.Context) {
	type Req struct {
		UserId *uint `json:"userId"`
	}

	req := Req{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if req.UserId != nil {
		userInfo := models.User{}
		if err := global.Db.First(&userInfo, "id = ?", req.UserId).Error; err != nil || !sessionguard.IsActiveUser(userInfo) {
			apiReturn.ErrorDataNotFound(c)
			return
		}
	}

	if err := global.SystemSetting.Set(systemSetting.PANEL_PUBLIC_USER_ID, req.UserId); err != nil {
		apiReturn.Error(c, "set fail")
		return
	}
	apiReturn.Success(c)
}

func (a UsersApi) GetPublicVisitUser(c *gin.Context) {
	var userId *uint
	if err := global.SystemSetting.GetValueByInterface(systemSetting.PANEL_PUBLIC_USER_ID, &userId); err == nil && userId != nil {
		userInfo := models.User{}
		if err := global.Db.First(&userInfo, "id = ?", userId).Error; err == nil && userInfo.ID != 0 {
			apiReturn.SuccessData(c, systemApiStructs.ToAdminUserItemResp(userInfo))
			return
		}
	}

	apiReturn.ErrorDataNotFound(c)
}
