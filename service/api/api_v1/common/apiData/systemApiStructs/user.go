package systemApiStructs

import (
	"leon-panel/models"
	"time"
)

type GetReferralCodeResp struct {
	ReferralCode string `json:"referralCode"`
}

// AdminUserItemResp explicitly projects safe user fields for administrator management endpoints
// (/api/panel/users/getList, /api/panel/users/getPublicVisitUser, /api/panel/users/update).
// Sensitive credentials (password hash, persistent bToken, referralCode) are never included.
type AdminUserItemResp struct {
	ID         uint      `json:"id"`
	CreateTime time.Time `json:"createTime"`
	UpdateTime time.Time `json:"updateTime"`
	Username   string    `json:"username"`
	Name       string    `json:"name"`
	HeadImage  string    `json:"headImage"`
	Status     int       `json:"status"`
	Role       int       `json:"role"`
	Mail       string    `json:"mail"`
}

func ToAdminUserItemResp(u models.User) AdminUserItemResp {
	return AdminUserItemResp{
		ID:         u.ID,
		CreateTime: u.CreatedAt,
		UpdateTime: u.UpdatedAt,
		Username:   u.Username,
		Name:       u.Name,
		HeadImage:  u.HeadImage,
		Status:     u.Status,
		Role:       u.Role,
		Mail:       u.Mail,
	}
}

// AuthProfileUserResp projects the minimal profile fields exposed by /api/user/getAuthInfo
// for both signed-in accounts and public-mode homepage visitors.
type AuthProfileUserResp struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	HeadImage string `json:"headImage"`
	Role      int    `json:"role"`
}

func ToAuthProfileUserResp(u models.User) AuthProfileUserResp {
	return AuthProfileUserResp{
		ID:        u.ID,
		Username:  u.Username,
		Name:      u.Name,
		HeadImage: u.HeadImage,
		Role:      u.Role,
	}
}

// LoginSuccessResp projects the login response payload, exposing only the session cToken.
type LoginSuccessResp struct {
	ID        uint   `json:"id"`
	Username  string `json:"username"`
	Name      string `json:"name"`
	HeadImage string `json:"headImage"`
	Status    int    `json:"status"`
	Role      int    `json:"role"`
	Mail      string `json:"mail"`
	Token     string `json:"token"`
}

func ToLoginSuccessResp(u models.User, cToken string) LoginSuccessResp {
	return LoginSuccessResp{
		ID:        u.ID,
		Username:  u.Username,
		Name:      u.Name,
		HeadImage: u.HeadImage,
		Status:    u.Status,
		Role:      u.Role,
		Mail:      u.Mail,
		Token:     cToken,
	}
}
