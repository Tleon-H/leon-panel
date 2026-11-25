package panel

import (
	"leon-panel/api/api_v1"
	"leon-panel/api/api_v1/middleware"

	"github.com/gin-gonic/gin"
)

func InitItemIconGroup(router *gin.RouterGroup) {
	itemIconGroup := api_v1.ApiGroupApp.ApiPanel.ItemIconGroup
	r := router.Group("", middleware.LoginInterceptor)
	{
		r.POST("/panel/itemIconGroup/edit", itemIconGroup.Edit)
		r.POST("/panel/itemIconGroup/deletes", itemIconGroup.Deletes)
		r.POST("/panel/itemIconGroup/saveSort", itemIconGroup.SaveSort)
		r.POST("/panel/itemIconGroup/saveDesktopLayout", itemIconGroup.SaveDesktopLayout)
	}

	// 公开模式
	rPublic := router.Group("", middleware.PublicModeInterceptor)
	{
		rPublic.POST("/panel/itemIconGroup/getList", itemIconGroup.GetList)
	}
}
