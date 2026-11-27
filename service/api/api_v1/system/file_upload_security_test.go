package system

import (
	"bytes"
	"encoding/json"
	"fmt"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"leon-panel/models"

	"github.com/gin-gonic/gin"
)

func uploadSingleRaw(t *testing.T, api *FileApi, fileName string, content []byte, category string, userID uint) map[string]interface{} {
	t.Helper()
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, err := writer.CreateFormFile("imgfile", fileName)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatal(err)
	}
	if category != "" {
		if err := writer.WriteField("category", category); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	ctx, _ := gin.CreateTestContext(recorder)
	ctx.Request = httptest.NewRequest(http.MethodPost, "/api/file/uploadImg", body)
	ctx.Request.Header.Set("Content-Type", writer.FormDataContentType())
	if userID != 0 {
		ctx.Set("userInfo", models.User{BaseModel: models.BaseModel{ID: userID}, Role: 2})
	}
	api.UploadImg(ctx)
	var payload map[string]interface{}
	if err := json.Unmarshal(recorder.Body.Bytes(), &payload); err != nil {
		t.Fatalf("response %s: %v", recorder.Body.String(), err)
	}
	return payload
}

func TestUploadImgAcceptsValidMagicBytesAndRejectsSpoofedOrOversized(t *testing.T) {
	db := openFileDB(t)
	uploadRoot := filepath.Join(t.TempDir(), "uploads")
	restore := useConfig(t, "[base]\nsource_path="+uploadRoot+"\n")
	defer restore()

	api := FileApi{}
	png := tinyPNG(t)
	jpg := []byte{0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 'J', 'F', 'I', 'F', 0x00}
	gif := []byte("GIF89a\x01\x00\x01\x00\x00\x00\x00;")
	webp := []byte("RIFF\x10\x00\x00\x00WEBPVP8 \x00\x00\x00\x00")
	ico := []byte{0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x10, 0x10}
	svg := []byte(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/></svg>`)

	for name, content := range map[string][]byte{
		"ok.png":  png,
		"ok.jpg":  jpg,
		"ok.gif":  gif,
		"ok.webp": webp,
		"ok.ico":  ico,
		"ok.svg":  svg,
	} {
		resp := uploadSingleRaw(t, &api, name, content, "icon", 11)
		if resp["code"] != float64(0) {
			t.Fatalf("valid %s rejected: %#v", name, resp)
		}
	}

	spoofed := map[string][]byte{
		"html-as.png":   []byte("<html><script>alert(1)</script></html>"),
		"html-as.jpg":   []byte("<!doctype html><script>alert(1)</script>"),
		"text-as.gif":   []byte("plain text pretending to be gif"),
		"riff-bad.webp": []byte("RIFF\x10\x00\x00\x00WAVEfmt "),
		"html-as.ico":   []byte("<svg></svg>"),
		"html-as.svg":   []byte("<html><body><script>alert(1)</script></body></html>"),
		"xxe-as.svg":    []byte(`<!DOCTYPE svg [<!ENTITY xxe "boom">]><svg>&xxe;</svg>`),
		"empty.png":     {},
	}
	for name, content := range spoofed {
		resp := uploadSingleRaw(t, &api, name, content, "icon", 11)
		if resp["code"] != float64(1301) {
			t.Fatalf("spoofed %s expected code 1301, got %#v", name, resp)
		}
		if countNamed(t, db, name) != 0 {
			t.Fatalf("spoofed %s wrote DB row", name)
		}
	}

	// Oversized file limit check.
	prevLimit := maxUploadFileBytes
	maxUploadFileBytes = 64
	t.Cleanup(func() { maxUploadFileBytes = prevLimit })

	oversizedPNG := append(append([]byte{}, png...), bytes.Repeat([]byte("A"), 128)...)
	overResp := uploadSingleRaw(t, &api, "too-big.png", oversizedPNG, "icon", 11)
	if overResp["code"] != float64(1300) {
		t.Fatalf("oversized upload expected code 1300, got %#v", overResp)
	}
	if countNamed(t, db, "too-big.png") != 0 {
		t.Fatal("oversized upload persisted DB row")
	}
}

func TestUploadImgReturnsErrorOnSaveOrDBFailureWithoutOrphanFile(t *testing.T) {
	// 1) Save failure when source_path points to a non-directory file.
	_ = openFileDB(t)
	dir := t.TempDir()
	blockingFile := filepath.Join(dir, "not-a-dir")
	if err := os.WriteFile(blockingFile, []byte("x"), 0o644); err != nil {
		t.Fatal(err)
	}
	restoreBlocking := useConfig(t, "[base]\nsource_path="+blockingFile+"\n")
	api := FileApi{}
	saveErrResp := uploadSingleRaw(t, &api, "fail-save.png", tinyPNG(t), "icon", 12)
	restoreBlocking()
	if saveErrResp["code"] != float64(1300) {
		t.Fatalf("expected code 1300 on mkdir/save failure, got %#v", saveErrResp)
	}

	// 2) DB failure must return an error and remove the orphan file from disk.
	db := openFileDB(t)
	uploadRoot := filepath.Join(t.TempDir(), "uploads")
	restoreGood := useConfig(t, "[base]\nsource_path="+uploadRoot+"\n")
	defer restoreGood()

	if err := db.Migrator().DropTable(&models.File{}); err != nil {
		t.Fatal(err)
	}
	dbErrResp := uploadSingleRaw(t, &api, "fail-db.png", tinyPNG(t), "icon", 12)
	if dbErrResp["code"] == float64(0) {
		t.Fatalf("expected non-zero error on DB insert failure, got %#v", dbErrResp)
	}
	var leftover []string
	_ = filepath.Walk(uploadRoot, func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			leftover = append(leftover, p)
		}
		return nil
	})
	if len(leftover) != 0 {
		t.Fatalf("orphan uploaded files left after DB failure: %v", leftover)
	}
}

func TestUploadFilesEnforcesMagicBytesSizeAndBatchLimits(t *testing.T) {
	db := openFileDB(t)
	uploadRoot := filepath.Join(t.TempDir(), "uploads")
	restore := useConfig(t, "[base]\nsource_path="+uploadRoot+"\n")
	defer restore()

	prevFileLimit := maxUploadFileBytes
	prevBatchLimit := maxUploadBatchBytes
	prevMaxCount := maxUploadBatchFiles
	maxUploadFileBytes = 256
	maxUploadBatchBytes = 4096
	maxUploadBatchFiles = 3
	t.Cleanup(func() {
		maxUploadFileBytes = prevFileLimit
		maxUploadBatchBytes = prevBatchLimit
		maxUploadBatchFiles = prevMaxCount
	})

	api := FileApi{}
	png := tinyPNG(t)
	svg := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>`)
	bigPNG := append(append([]byte{}, png...), bytes.Repeat([]byte("Z"), 300)...)

	mixed := uploadBatch(t, &api, 15, "icon", nil, map[string][]byte{
		"good.png":      png,
		"good.svg":      svg,
		"fake-html.png": []byte("<html>not png</html>"),
	})
	if mixed["code"] != float64(0) {
		t.Fatalf("mixed batch unexpected error: %#v", mixed)
	}
	data, _ := mixed["data"].(map[string]interface{})
	saved, _ := data["saved"].([]interface{})
	errFiles, _ := data["errFiles"].([]interface{})
	if len(saved) != 2 || len(errFiles) != 1 || errFiles[0] != "fake-html.png" {
		t.Fatalf("unexpected mixed batch result: %#v", mixed)
	}
	if countNamed(t, db, "fake-html.png") != 0 || countNamed(t, db, "good.png") != 1 || countNamed(t, db, "good.svg") != 1 {
		t.Fatal("unexpected DB persistence after mixed batch")
	}

	// Oversized individual file in batch is rejected into errFiles.
	overItem := uploadBatch(t, &api, 15, "icon", nil, map[string][]byte{
		"oversized.png": bigPNG,
	})
	overData, _ := overItem["data"].(map[string]interface{})
	overErrFiles, _ := overData["errFiles"].([]interface{})
	if len(overErrFiles) != 1 || overErrFiles[0] != "oversized.png" || countNamed(t, db, "oversized.png") != 0 {
		t.Fatalf("oversized batch item should be rejected: %#v", overItem)
	}

	// Exceeding maxUploadBatchFiles rejects the whole request.
	tooMany := uploadBatch(t, &api, 15, "icon", nil, map[string][]byte{
		"a.png": png,
		"b.png": png,
		"c.png": png,
		"d.png": png,
	})
	if tooMany["code"] != float64(1300) {
		t.Fatalf("expected code 1300 for too many files, got %#v", tooMany)
	}

	// Exceeding maxUploadBatchBytes triggers http.MaxBytesReader rejection.
	hugeBody := uploadBatch(t, &api, 15, "icon", nil, map[string][]byte{
		"huge.png": append(append([]byte{}, png...), bytes.Repeat([]byte("X"), 5000)...),
	})
	if hugeBody["code"] != float64(1300) {
		t.Fatalf("expected code 1300 when request exceeds MaxBytesReader, got %#v", hugeBody)
	}
	if countNamed(t, db, "huge.png") != 0 {
		t.Fatal("oversized request persisted DB row")
	}

	// Sanity check error messages remain clean.
	if fmt.Sprint(hugeBody["msg"]) == "" {
		t.Fatal("expected non-empty error message")
	}
}
