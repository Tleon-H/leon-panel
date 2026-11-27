package middleware

import (
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/global"
	"leon-panel/lib/sessionguard"
	"leon-panel/models"

	"github.com/gin-gonic/gin"
)

func LoginInterceptor(c *gin.Context) {
	cToken := c.GetHeader("token")
	if cToken == "" {
		apiReturn.ErrorByCode(c, 1000)
		c.Abort()
		return
	}

	if global.CUserToken == nil || global.UserToken == nil || global.Db == nil {
		apiReturn.ErrorByCode(c, 1001)
		c.Abort()
		return
	}

	token, ok := global.CUserToken.Get(cToken)
	if !ok || token == "" {
		apiReturn.ErrorByCode(c, 1001)
		c.Abort()
		return
	}

	// Hot-cache hit branch must also enforce active account status (Status == 1).
	if userInfo, success := global.UserToken.Get(token); success {
		if !sessionguard.IsActiveTokenUser(userInfo) {
			sessionguard.EvictSessionMapping(global.UserToken, global.CUserToken, cToken, token)
			apiReturn.ErrorCode(c, 1001, expireMsg(), nil)
			c.Abort()
			return
		}
		c.Set("userInfo", userInfo)
		return
	}

	mUser := models.User{}
	info, err := mUser.GetUserInfoByToken(token)
	if err != nil || !sessionguard.IsActiveTokenUser(info) {
		sessionguard.EvictSessionMapping(global.UserToken, global.CUserToken, cToken, token)
		apiReturn.ErrorCode(c, 1001, expireMsg(), nil)
		c.Abort()
		return
	}

	global.UserToken.SetDefault(info.Token, info)
	global.CUserToken.SetDefault(cToken, token)
	c.Set("userInfo", info)
}

func expireMsg() string {
	if global.Lang != nil {
		return global.Lang.Get("login.err_token_expire")
	}
	return "Login expired"
}
