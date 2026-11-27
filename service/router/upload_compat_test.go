package router

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"leon-panel/global"
	"leon-panel/lib/cache"
	"leon-panel/lib/cmn"
	"leon-panel/lib/cmn/systemSetting"
	"leon-panel/lib/iniConfig"
	"leon-panel/lib/language"
	"leon-panel/models"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

func TestUploadEndToEndURLConsistencyAndLegacyPrefixSecurityHeaders(t *testing.T) {
	pngBytes, err := base64.StdEncoding.DecodeString("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
	if err != nil {
		t.Fatal(err)
	}
	svgBytes := []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>`)
	legacySVGBytes := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>`)

	cases := []struct {
		name             string
		sourcePath       string
		dirName          string
		wantPublicPrefix string
		wantLegacyPath   string
	}{
		{
			name:             "default_dot_slash_uploads",
			sourcePath:       "./uploads",
			dirName:          "uploads",
			wantPublicPrefix: "/uploads/",
			wantLegacyPath:   "/uploads/legacy-asset.svg",
		},
		{
			name:             "bare_relative_uploads",
			sourcePath:       "uploads",
			dirName:          "uploads",
			wantPublicPrefix: "/uploads/",
			wantLegacyPath:   "/ploads/legacy-asset.svg",
		},
		{
			name:             "bare_relative_reserved_assets",
			sourcePath:       "assets",
			dirName:          "assets",
			wantPublicPrefix: "/ssets/",
			wantLegacyPath:   "/ssets/legacy-asset.svg",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			root := t.TempDir()
			webPath := filepath.Join(root, "web")
			uploadDir := filepath.Join(root, tc.dirName)
			writeFile(t, filepath.Join(webPath, "index.html"), "LEON_PANEL_SHELL")
			writeFile(t, filepath.Join(webPath, "assets", "app.js"), "frontend-bundle-js")
			writeFile(t, filepath.Join(uploadDir, "legacy-asset.svg"), string(legacySVGBytes))

			confPath := filepath.Join(root, "conf.ini")
			writeFile(t, confPath, "[base]\nsource_path="+tc.sourcePath+"\n")

			wd, err := os.Getwd()
			if err != nil {
				t.Fatal(err)
			}
			if err := os.Chdir(root); err != nil {
				t.Fatal(err)
			}
			t.Cleanup(func() {
				if err := os.Chdir(wd); err != nil {
					t.Error(err)
				}
			})

			db, err := gorm.Open(sqlite.Open(filepath.Join(root, "upload_compat.db")), &gorm.Config{
				NamingStrategy: schema.NamingStrategy{SingularTable: true},
			})
			if err != nil {
				t.Fatal(err)
			}
			if err := db.AutoMigrate(&models.User{}, &models.File{}, &models.SystemSetting{}); err != nil {
				t.Fatal(err)
			}

			prevDb := global.Db
			prevModelsDb := models.Db
			prevConfig := global.Config
			prevUserToken := global.UserToken
			prevCUserToken := global.CUserToken
			prevSysSetting := global.SystemSetting
			prevLogger := global.Logger
			prevLang := global.Lang

			global.Db = db
			models.Db = db
			global.Config = iniConfig.NewIniConfig(confPath)
			global.UserToken = cache.NewGoCache[models.User](time.Minute, time.Hour)
			global.CUserToken = cache.NewGoCache[string](72*time.Hour, 48*time.Hour)
			global.SystemSetting = &systemSetting.SystemSettingCache{
				Cache: cache.NewGoCache[interface{}](5*time.Hour, 0),
			}
			encCfg := zap.NewDevelopmentEncoderConfig()
			global.Logger = zap.New(zapcore.NewCore(zapcore.NewConsoleEncoder(encCfg), zapcore.AddSync(&bytes.Buffer{}), zapcore.ErrorLevel)).Sugar()
			langFile := filepath.Join(root, "zh-cn.ini")
			if err := cmn.AssetsTakeFileToPath("lang/zh-cn.ini", langFile); err != nil {
				t.Fatal(err)
			}
			global.Lang = language.NewLang(langFile)

			t.Cleanup(func() {
				global.Db = prevDb
				models.Db = prevModelsDb
				global.Config = prevConfig
				global.UserToken = prevUserToken
				global.CUserToken = prevCUserToken
				global.SystemSetting = prevSysSetting
				global.Logger = prevLogger
				global.Lang = prevLang
				if sqlDB, err := db.DB(); err == nil {
					_ = sqlDB.Close()
				}
			})

			admin := models.User{
				Username: "admin@example.com",
				Mail:     "admin@example.com",
				Name:     "Admin",
				Password: cmn.PasswordEncryption("12345678"),
				Status:   1,
				Role:     1,
				Token:    "btoken_upload_compat_0001",
			}
			if err := db.Create(&admin).Error; err != nil {
				t.Fatal(err)
			}
			cToken := "ctoken_upload_compat_0001"
			global.CUserToken.SetDefault(cToken, admin.Token)
			global.UserToken.SetDefault(admin.Token, admin)

			engine := NewEngine(webPath, tc.sourcePath)

			// Built-in frontend /assets static route must keep serving web assets without upload sandbox CSP.
			assetRec := get(engine, "/assets/app.js")
			if assetRec.Code != http.StatusOK || assetRec.Body.String() != "frontend-bundle-js" {
				t.Fatalf("GET /assets/app.js = %d %q", assetRec.Code, assetRec.Body.String())
			}
			if got := assetRec.Header().Get("Content-Security-Policy"); got != "" {
				t.Fatalf("unexpected upload CSP on /assets/app.js: %q", got)
			}

			assertUploadServedWithHeaders := func(method, urlPath string, wantBody []byte) {
				t.Helper()
				rec := httptest.NewRecorder()
				req := httptest.NewRequest(method, urlPath, nil)
				engine.ServeHTTP(rec, req)
				if rec.Code != http.StatusOK {
					t.Fatalf("%s %s = %d body=%q", method, urlPath, rec.Code, rec.Body.String())
				}
				if got := rec.Header().Get("Content-Security-Policy"); got != UploadContentSecurityPolicy {
					t.Fatalf("%s %s CSP = %q, want %q", method, urlPath, got, UploadContentSecurityPolicy)
				}
				if got := rec.Header().Get("X-Content-Type-Options"); got != UploadContentTypeOptions {
					t.Fatalf("%s %s X-Content-Type-Options = %q, want %q", method, urlPath, got, UploadContentTypeOptions)
				}
				if method == http.MethodGet && !bytes.Equal(rec.Body.Bytes(), wantBody) {
					t.Fatalf("%s %s body mismatch: got %q, want %q", method, urlPath, rec.Body.Bytes(), wantBody)
				}
			}

			// 1) Single-file upload via /api/file/uploadImg and read back returned imageUrl.
			singleBody := &bytes.Buffer{}
			singleWriter := multipart.NewWriter(singleBody)
			part, err := singleWriter.CreateFormFile("imgfile", "single.png")
			if err != nil {
				t.Fatal(err)
			}
			_, _ = part.Write(pngBytes)
			_ = singleWriter.WriteField("category", "icon")
			_ = singleWriter.Close()

			rec := httptest.NewRecorder()
			req := httptest.NewRequest(http.MethodPost, "/api/file/uploadImg", singleBody)
			req.Header.Set("Content-Type", singleWriter.FormDataContentType())
			req.Header.Set("token", cToken)
			engine.ServeHTTP(rec, req)
			var singleResp struct {
				Code int `json:"code"`
				Data struct {
					ImageURL string `json:"imageUrl"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &singleResp); err != nil || singleResp.Code != 0 {
				t.Fatalf("uploadImg failed: %s (%v)", rec.Body.String(), err)
			}
			if !strings.HasPrefix(singleResp.Data.ImageURL, tc.wantPublicPrefix) {
				t.Fatalf("uploadImg returned imageUrl = %q, want prefix %q", singleResp.Data.ImageURL, tc.wantPublicPrefix)
			}
			assertUploadServedWithHeaders(http.MethodGet, singleResp.Data.ImageURL, pngBytes)

			// 2) Batch upload via /api/file/uploadFiles (SVG + PNG) and read back returned URLs.
			batchBody := &bytes.Buffer{}
			batchWriter := multipart.NewWriter(batchBody)
			svgPart, _ := batchWriter.CreateFormFile("files[]", "batch.svg")
			_, _ = svgPart.Write(svgBytes)
			pngPart, _ := batchWriter.CreateFormFile("files[]", "batch.png")
			_, _ = pngPart.Write(pngBytes)
			_ = batchWriter.WriteField("category", "icon")
			_ = batchWriter.Close()

			rec = httptest.NewRecorder()
			req = httptest.NewRequest(http.MethodPost, "/api/file/uploadFiles", batchBody)
			req.Header.Set("Content-Type", batchWriter.FormDataContentType())
			req.Header.Set("token", cToken)
			engine.ServeHTTP(rec, req)
			var batchResp struct {
				Code int `json:"code"`
				Data struct {
					SuccMap map[string]string `json:"succMap"`
					Saved   []struct {
						FileName string `json:"fileName"`
						ImageURL string `json:"imageUrl"`
					} `json:"saved"`
					ErrFiles []string `json:"errFiles"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &batchResp); err != nil || batchResp.Code != 0 || len(batchResp.Data.ErrFiles) != 0 {
				t.Fatalf("uploadFiles failed: %s (%v)", rec.Body.String(), err)
			}
			batchSVGURL := batchResp.Data.SuccMap["batch.svg"]
			if !strings.HasPrefix(batchSVGURL, tc.wantPublicPrefix) {
				t.Fatalf("uploadFiles returned SVG URL = %q, want prefix %q", batchSVGURL, tc.wantPublicPrefix)
			}
			assertUploadServedWithHeaders(http.MethodGet, batchSVGURL, svgBytes)
			assertUploadServedWithHeaders(http.MethodHead, batchSVGURL, nil)

			// 3) Verify /api/file/getList and /api/file/publicList return matching URLs readable with security headers.
			rec = httptest.NewRecorder()
			req = httptest.NewRequest(http.MethodPost, "/api/file/getList", strings.NewReader(`{"page":1,"limit":10}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("token", cToken)
			engine.ServeHTTP(rec, req)
			var listResp struct {
				Code int `json:"code"`
				Data struct {
					List []struct {
						ID       uint   `json:"id"`
						FileName string `json:"fileName"`
						Src      string `json:"src"`
					} `json:"list"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &listResp); err != nil || listResp.Code != 0 || len(listResp.Data.List) != 3 {
				t.Fatalf("getList failed: %s (%v)", rec.Body.String(), err)
			}
			var batchSVGFileID uint
			for _, item := range listResp.Data.List {
				if !strings.HasPrefix(item.Src, tc.wantPublicPrefix) {
					t.Fatalf("getList returned src %q for %s, want prefix %q", item.Src, item.FileName, tc.wantPublicPrefix)
				}
				if item.FileName == "batch.svg" {
					batchSVGFileID = item.ID
					assertUploadServedWithHeaders(http.MethodGet, item.Src, svgBytes)
				}
			}
			if batchSVGFileID == 0 {
				t.Fatal("batch.svg not found in getList")
			}

			rec = httptest.NewRecorder()
			req = httptest.NewRequest(http.MethodPost, "/api/file/setPublic", strings.NewReader(fmt.Sprintf(`{"id":%d,"public":true}`, batchSVGFileID)))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("token", cToken)
			engine.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK || !strings.Contains(rec.Body.String(), `"code":0`) {
				t.Fatalf("setPublic failed: %s", rec.Body.String())
			}

			rec = httptest.NewRecorder()
			req = httptest.NewRequest(http.MethodPost, "/api/file/publicList", strings.NewReader(`{"page":1,"limit":10}`))
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("token", cToken)
			engine.ServeHTTP(rec, req)
			var pubResp struct {
				Code int `json:"code"`
				Data struct {
					List []struct {
						FileName string `json:"fileName"`
						Src      string `json:"src"`
					} `json:"list"`
				} `json:"data"`
			}
			if err := json.Unmarshal(rec.Body.Bytes(), &pubResp); err != nil || pubResp.Code != 0 || len(pubResp.Data.List) != 1 {
				t.Fatalf("publicList failed: %s (%v)", rec.Body.String(), err)
			}
			if !strings.HasPrefix(pubResp.Data.List[0].Src, tc.wantPublicPrefix) {
				t.Fatalf("publicList returned src %q, want prefix %q", pubResp.Data.List[0].Src, tc.wantPublicPrefix)
			}
			assertUploadServedWithHeaders(http.MethodGet, pubResp.Data.List[0].Src, svgBytes)

			// 4) Pre-existing asset stays readable via both current public prefix and legacy prefix,
			//    and every upload route enforces CSP sandbox + X-Content-Type-Options: nosniff.
			assertUploadServedWithHeaders(http.MethodGet, tc.wantPublicPrefix+"legacy-asset.svg", legacySVGBytes)
			assertUploadServedWithHeaders(http.MethodGet, tc.wantLegacyPath, legacySVGBytes)
			assertUploadServedWithHeaders(http.MethodHead, tc.wantLegacyPath, nil)
			if tc.sourcePath == "uploads" {
				legacyNewURL := strings.Replace(batchSVGURL, "/uploads/", "/ploads/", 1)
				assertUploadServedWithHeaders(http.MethodGet, legacyNewURL, svgBytes)
			}
		})
	}
}
