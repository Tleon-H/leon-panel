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
	case sessionguard.TokenResolveTransientError:
		apiReturn.ErrorDatabase(c, err.Error())
		c.Abort()
	default:
		apiReturn.ErrorCode(c, 1001, expireMsg(), nil)
		c.Abort()
	}
}

func expireMsg() string {
	if global.Lang != nil {
		return global.Lang.Get("login.err_token_expire")
	}
	return "Login expired"
}
