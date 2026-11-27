package system

import (
	"leon-panel/api/api_v1/common/apiData/systemApiStructs"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn"
	"leon-panel/lib/cmn/systemSetting"
	"leon-panel/models"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"
)

type LoginApi struct {
}

// 登录输入验证
type LoginLoginVerify struct {
	Username string `json:"username" validate:"required"`
	Password string `json:"password" validate:"required,max=50"`
	VCode    string `json:"vcode" validate:"max=6"`
	Email    string `json:"email"`
}

// @Summary 登录账号
// @Accept application/json
// @Produce application/json
// @Param LoginLoginVerify body LoginLoginVerify true "登陆验证信息"
// @Tags user
// @Router /login [post]
func (l LoginApi) Login(c *gin.Context) {
	param := LoginLoginVerify{}
	if err := c.ShouldBindJSON(&param); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if errMsg, err := base.ValidateInputStruct(param); err != nil {
		apiReturn.ErrorParamFomat(c, errMsg)
		return
	}

	if global.SystemSetting != nil {
		settings := systemSetting.ApplicationSetting{}
		_ = global.SystemSetting.GetValueByInterface("system_application", &settings)
	}

	mUser := models.User{}
	var (
		err  error
		info models.User
	)
	param.Username = strings.TrimSpace(param.Username)
	if info, err = mUser.GetUserInfoByUsernameAndPassword(param.Username, cmn.PasswordEncryption(param.Password)); err != nil {
		if err == gorm.ErrRecordNotFound {
			apiReturn.ErrorByCode(c, 1003)
			return
		}
		apiReturn.Error(c, err.Error())
		return
	}

	// 停用或未激活
	if info.Status != 1 {
		apiReturn.ErrorByCode(c, 1004)
		return
	}

	bToken := info.Token
	if bToken == "" {
		for {
			candidate, randErr := cmn.BuildCryptoRandToken(32)
			if randErr != nil {
				apiReturn.Error(c, "Failed to generate session credential")
				return
			}
			if _, lookupErr := mUser.GetUserInfoByToken(candidate); lookupErr != nil {
				if updateErr := mUser.UpdateUserInfoByUserId(info.ID, map[string]interface{}{
					"token": candidate,
				}); updateErr != nil {
					apiReturn.ErrorDatabase(c, updateErr.Error())
					return
				}
				bToken = candidate
				break
			}
		}
		info.Token = bToken
	}

	cToken := uuid.NewString() + "-" + cmn.Md5(cmn.Md5("userId"+strconv.Itoa(int(info.ID))))
	global.CUserToken.SetDefault(cToken, bToken)

	c.Set("userInfo", info)
	apiReturn.SuccessData(c, systemApiStructs.ToLoginSuccessResp(info, cToken))
}

// 安全退出
func (l *LoginApi) Logout(c *gin.Context) {
	cToken := c.GetHeader("token")
	if cToken != "" && global.CUserToken != nil {
		global.CUserToken.Delete(cToken)
	}
	apiReturn.Success(c)
}
