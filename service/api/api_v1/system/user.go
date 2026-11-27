package system

import (
	"leon-panel/api/api_v1/common/apiData/systemApiStructs"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn"
	"leon-panel/lib/sessionguard"
	"leon-panel/models"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

type UserApi struct{}

func (a *UserApi) GetInfo(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	apiReturn.SuccessData(c, gin.H{
		"userId":    userInfo.ID,
		"id":        userInfo.ID,
		"headImage": userInfo.HeadImage,
		"name":      userInfo.Name,
		"role":      userInfo.Role,
	})
}

func (a *UserApi) GetAuthInfo(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	visitMode := base.GetCurrentVisitMode(c)
	apiReturn.SuccessData(c, gin.H{
		"user":      systemApiStructs.ToAuthProfileUserResp(userInfo),
		"visitMode": visitMode,
	})
}

// 修改资料
func (a *UserApi) UpdateInfo(c *gin.Context) {
	userInfo, _ := base.GetCurrentUserInfo(c)
	type UpdateUserInfoStruct struct {
		HeadImage string `json:"headImage"`
		Name      string `json:"name" validate:"max=15,min=3,required"`
	}
	params := UpdateUserInfoStruct{}

	if err := c.ShouldBindBodyWith(&params, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}

	if errMsg, err := base.ValidateInputStruct(&params); err != nil {
		apiReturn.ErrorParamFomat(c, errMsg)
		return
	}

	mUser := models.User{}
	err := mUser.UpdateUserInfoByUserId(userInfo.ID, map[string]interface{}{
		"head_image": params.HeadImage,
		"name":       params.Name,
	})
	sessionguard.EvictUserToken(global.UserToken, userInfo.Token)
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.Success(c)
}

// 修改密码
func (a *UserApi) UpdatePasssword(c *gin.Context) {
	type UpdatePasssStruct struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}

	params := UpdatePasssStruct{}
	if err := c.ShouldBindBodyWith(&params, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	userInfo, _ := base.GetCurrentUserInfo(c)
	mUser := models.User{}
	v, err := mUser.GetUserInfoByUid(userInfo.ID)
	if err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	if v.Password != cmn.PasswordEncryption(params.OldPassword) {
		apiReturn.ErrorByCode(c, 1007)
		return
	}
	res := global.Db.Model(&models.User{}).Where("id = ?", userInfo.ID).Updates(map[string]interface{}{
		"password": cmn.PasswordEncryption(params.NewPassword),
		"token":    "",
	})
	if res.Error != nil {
		apiReturn.ErrorDatabase(c, res.Error.Error())
		return
	}
	sessionguard.EvictSessionMapping(global.UserToken, global.CUserToken, c.GetHeader("token"), v.Token)
	sessionguard.EvictUserToken(global.UserToken, userInfo.Token)
	apiReturn.Success(c)
}

// 获取推荐码
func (a *UserApi) GetReferralCode(c *gin.Context) {
	currentUserInfo, _ := base.GetCurrentUserInfo(c)
	mUser := models.User{}
	userInfo, err := mUser.GetUserInfoByUid(currentUserInfo.ID)
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	if userInfo.ReferralCode == "" {
		for {
			referralCode, randErr := cmn.BuildCryptoRandToken(8)
			if randErr != nil {
				apiReturn.Error(c, "Failed to generate referral code")
				return
			}

			var existing models.User
			if row := global.Db.Find(&existing, "referral_code = ?", referralCode).RowsAffected; row != 0 {
				continue
			}

			if err := global.Db.Model(&models.User{}).Where("id = ?", userInfo.ID).Update("referral_code", referralCode).Error; err != nil {
				apiReturn.ErrorDatabase(c, err.Error())
				return
			}
			userInfo.ReferralCode = referralCode
			break
		}
	}

	apiReturn.SuccessData(c, systemApiStructs.GetReferralCodeResp{ReferralCode: userInfo.ReferralCode})
}
