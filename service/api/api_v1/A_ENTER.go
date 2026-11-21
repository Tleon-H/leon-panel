package api_v1

import (
	"leon-panel/api/api_v1/openness"
	"leon-panel/api/api_v1/panel"
	"leon-panel/api/api_v1/system"
)

type ApiGroup struct {
	ApiSystem system.ApiSystem // 系统功能api
	ApiOpen   openness.ApiPpenness
	ApiPanel  panel.ApiPanel
}

var ApiGroupApp = new(ApiGroup)
