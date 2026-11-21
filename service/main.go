package main

import (
	"log"
	"leon-panel/global"
	"leon-panel/initialize"
	"leon-panel/router"
)

func main() {
	err := initialize.InitApp()
	if err != nil {
		log.Println("初始化错误:", err.Error())
		panic(err)
	}
	httpPort := global.Config.GetValueStringOrDefault("base", "http_port")

	if err := router.InitRouters(":" + httpPort); err != nil {
		panic(err)
	}
}
