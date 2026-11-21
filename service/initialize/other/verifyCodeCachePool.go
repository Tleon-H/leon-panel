package other

import (
	"leon-panel/global"
	"leon-panel/lib/cache"
	"time"
)

func InitVerifyCodeCachePool() cache.Cacher[string] {
	return global.NewCache[string](10*time.Minute, 10*time.Minute, "VerifyCodeCachePool")

}
