package middleware

import (
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn/systemSetting"
	"leon-panel/lib/sessionguard"
	"leon-panel/models"

	"github.com/gin-gonic/gin"
)

// 公开访问模式（访客模式）
// [有有效且启用态 token 将自动登录；无 token、过期或对应账号已停用/删除将回退至公开账号判定，不可以与 LoginInterceptor 一起使用]
func PublicModeInterceptor(c *gin.Context) {
	cToken := c.GetHeader("token")

	if cToken != "" && global.CUserToken != nil && global.UserToken != nil && global.Db != nil {
		token, ok := global.CUserToken.Get(cToken)
		if ok && token != "" {
			mUser := models.User{}
			userInfo, status, err := sessionguard.ResolveTokenUser(
				global.UserToken,
				global.CUserToken,
				cToken,
				token,
				mUser.GetUserInfoByToken,
			)
			switch status {
			case sessionguard.TokenResolveActive:
				c.Set("userInfo", userInfo)
				return
			case sessionguard.TokenResolveTransientError:
				apiReturn.ErrorDatabase(c, err.Error())
				c.Abort()
				return
			}
		}
	}

	// 获取公开账号的信息（必须存在且处于启用状态 Status == 1）
	if global.SystemSetting != nil && global.Db != nil {
		var userId *uint
		if err := global.SystemSetting.GetValueByInterface(systemSetting.PANEL_PUBLIC_USER_ID, &userId); err == nil && userId != nil {
			userInfo := models.User{}
			if err := global.Db.First(&userInfo, "id = ?", userId).Error; err != nil || !sessionguard.IsActiveUser(userInfo) {
				apiReturn.ErrorCode(c, 1001, expireMsg(), nil)
				c.Abort()
				return
			}
			c.Set("userInfo", userInfo)
			c.Set(base.GIN_GET_VISIT_MODE, base.VISIT_MODE_PUBLIC)
			return
		}
	}

	apiReturn.ErrorCode(c, 1001, expireMsg(), nil)
	c.Abort()
}
