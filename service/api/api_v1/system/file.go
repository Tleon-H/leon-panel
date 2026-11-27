package system

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path"
	"strings"
	"leon-panel/api/api_v1/common/apiReturn"
	"leon-panel/api/api_v1/common/base"
	"leon-panel/global"
	"leon-panel/lib/cmn"
	"leon-panel/models"
	"time"
	"unicode/utf8"

	"github.com/gin-gonic/gin"
	"github.com/gin-gonic/gin/binding"
)

const (
	DefaultMaxUploadFileBytes  int64 = 20 << 20 // 20 MiB per image
	DefaultMaxUploadBatchBytes int64 = 64 << 20 // 64 MiB total per batch request
	DefaultMaxUploadBatchFiles       = 50
	uploadMultipartOverhead    int64 = 1 << 20
)

var (
	maxUploadFileBytes  int64 = DefaultMaxUploadFileBytes
	maxUploadBatchBytes int64 = DefaultMaxUploadBatchBytes
	maxUploadBatchFiles       = DefaultMaxUploadBatchFiles

	errUploadTooLarge      = errors.New("upload file exceeds size limit")
	errUploadInvalidFormat = errors.New("upload file content does not match allowed image format")
)

type FileApi struct{}

func (a *FileApi) UploadImg(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadFileBytes+uploadMultipartOverhead)
	if err := c.Request.ParseMultipartForm(minInt64(maxUploadFileBytes, 32<<20)); err != nil {
		if isMaxBytesError(err) {
			apiReturn.ErrorCode(c, 1300, "File size exceeds limit", nil)
			return
		}
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	category, valid := uploadCategory(c.PostForm("category"))
	if !valid {
		apiReturn.ErrorByCode(c, 1400)
		return
	}
	configUpload := global.Config.GetValueString("base", "source_path")
	f, err := c.FormFile("imgfile")
	if err != nil {
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	if !allowedImageExt(f.Filename) {
		apiReturn.ErrorByCode(c, 1301)
		return
	}
	fileExt := strings.ToLower(path.Ext(f.Filename))
	if err := validateUploadedImage(f, fileExt); err != nil {
		switch {
		case errors.Is(err, errUploadTooLarge):
			apiReturn.ErrorCode(c, 1300, "File size exceeds limit", nil)
		case errors.Is(err, errUploadInvalidFormat):
			apiReturn.ErrorByCode(c, 1301)
		default:
			apiReturn.ErrorByCode(c, 1300)
		}
		return
	}

	fileName := cmn.Md5(fmt.Sprintf("%s%s", f.Filename, time.Now().String()))
	fildDir := fmt.Sprintf("%s/%d/%d/%d/", strings.TrimRight(configUpload, "/"), time.Now().Year(), time.Now().Month(), time.Now().Day())
	isExist, err := cmn.PathExists(fildDir)
	if err != nil {
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	if !isExist {
		if err := os.MkdirAll(fildDir, 0o755); err != nil {
			apiReturn.ErrorByCode(c, 1300)
			return
		}
	}
	dstPath := fmt.Sprintf("%s%s%s", fildDir, fileName, fileExt)
	if err := c.SaveUploadedFile(f, dstPath); err != nil {
		apiReturn.ErrorByCode(c, 1300)
		return
	}

	// 像数据库添加记录
	mFile := models.File{}
	if _, err := mFile.AddFile(userInfo.ID, f.Filename, fileExt, dstPath, category); err != nil {
		_ = os.Remove(dstPath)
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	apiReturn.SuccessData(c, gin.H{
		"imageUrl": cmn.UploadPublicURLWithSource(configUpload, dstPath),
	})
}

func (a *FileApi) UploadFiles(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadBatchBytes)
	form, err := c.MultipartForm()
	if err != nil {
		if isMaxBytesError(err) {
			apiReturn.ErrorCode(c, 1300, "File size exceeds limit", nil)
			return
		}
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	category, valid := uploadCategory(c.PostForm("category"))
	if !valid {
		apiReturn.ErrorByCode(c, 1400)
		return
	}
	// A user id in the form cannot assign these files to another account or mark them public.
	_ = c.PostForm("userId")
	configUpload := global.Config.GetValueString("base", "source_path")

	files := form.File["files[]"]
	if len(files) == 0 {
		apiReturn.ErrorByCode(c, 1300)
		return
	}
	if len(files) > maxUploadBatchFiles {
		apiReturn.ErrorCode(c, 1300, "Too many files in one upload", nil)
		return
	}
	errFiles := []string{}
	succMap := map[string]string{}
	saved := []map[string]string{}
	for i, f := range files {
		if !allowedImageExt(f.Filename) {
			errFiles = append(errFiles, f.Filename)
			continue
		}
		fileExt := strings.ToLower(path.Ext(f.Filename))
		if err := validateUploadedImage(f, fileExt); err != nil {
			errFiles = append(errFiles, f.Filename)
			continue
		}
		fileName := cmn.Md5(fmt.Sprintf("%s%s%d", f.Filename, time.Now().String(), i))
		fildDir := fmt.Sprintf("%s/%d/%d/%d/", strings.TrimRight(configUpload, "/"), time.Now().Year(), time.Now().Month(), time.Now().Day())
		isExist, err := cmn.PathExists(fildDir)
		if err != nil {
			errFiles = append(errFiles, f.Filename)
			continue
		}
		if !isExist {
			if err := os.MkdirAll(fildDir, 0o755); err != nil {
				errFiles = append(errFiles, f.Filename)
				continue
			}
		}
		dstPath := fmt.Sprintf("%s%s%s", fildDir, fileName, fileExt)
		if c.SaveUploadedFile(f, dstPath) != nil {
			errFiles = append(errFiles, f.Filename)
			continue
		}
		if _, err := (&models.File{}).AddFile(userInfo.ID, f.Filename, fileExt, dstPath, category); err != nil {
			_ = os.Remove(dstPath)
			errFiles = append(errFiles, f.Filename)
			continue
		}
		imageURL := cmn.UploadPublicURLWithSource(configUpload, dstPath)
		succMap[f.Filename] = imageURL
		saved = append(saved, map[string]string{
			"fileName": f.Filename,
			"imageUrl": imageURL,
			"category": category,
		})
	}

	apiReturn.SuccessData(c, gin.H{
		"succMap":  succMap,
		"saved":    saved,
		"errFiles": errFiles,
	})
}

func configuredUploadSourcePath() string {
	if global.Config == nil {
		return ""
	}
	return global.Config.GetValueString("base", "source_path")
}

func (a *FileApi) GetList(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := models.FileListQuery{}
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
			apiReturn.ErrorParamFomat(c, err.Error())
			return
		}
	}
	// An account id in the body cannot list another account, including that account's public images.
	query, err := models.NormalizeFileListQuery(req.Page, req.Limit, req.Category, req.Keyword)
	if err != nil {
		apiReturn.ErrorByCode(c, 1400)
		return
	}

	var count int64
	if err := models.FileListScope(global.Db, userInfo.ID, query).Count(&count).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	list := []models.File{}
	offset := (query.Page - 1) * query.Limit
	if err := models.FileListScope(global.Db, userInfo.ID, query).Order("created_at desc").Offset(offset).Limit(query.Limit).Find(&list).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}

	sourcePath := configuredUploadSourcePath()
	data := []map[string]interface{}{}
	for _, v := range list {
		data = append(data, map[string]interface{}{
			"src":        cmn.UploadPublicURLWithSource(sourcePath, v.Src),
			"fileName":   v.FileName,
			"id":         v.ID,
			"createTime": v.CreatedAt,
			"updateTime": v.UpdatedAt,
			"path":       v.Src,
			"category":   models.DisplayFileCategory(v.Category),
			"public":     v.IsPublic,
		})
	}
	apiReturn.SuccessListData(c, data, count)
}

func (a *FileApi) PublicList(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := struct {
		Page     int    `json:"page"`
		Limit    int    `json:"limit"`
		Category string `json:"category"`
		Keyword  string `json:"keyword"`
		UserId   uint   `json:"userId"`
	}{}
	if c.Request.ContentLength != 0 {
		if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
			apiReturn.ErrorParamFomat(c, err.Error())
			return
		}
	}
	// userId in the body cannot choose another account. The list is every public image.
	_ = req.UserId
	query, err := models.NormalizeFileListQuery(req.Page, req.Limit, req.Category, req.Keyword)
	if err != nil {
		apiReturn.ErrorByCode(c, 1400)
		return
	}

	var count int64
	if err := models.PublicFileListScope(global.Db, query).Count(&count).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	list := []models.File{}
	offset := (query.Page - 1) * query.Limit
	if err := models.PublicFileListScope(global.Db, query).Order("created_at desc").Offset(offset).Limit(query.Limit).Find(&list).Error; err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	sourcePath := configuredUploadSourcePath()
	data := []map[string]interface{}{}
	for _, v := range list {
		data = append(data, map[string]interface{}{
			"src":        cmn.UploadPublicURLWithSource(sourcePath, v.Src),
			"fileName":   v.FileName,
			"id":         v.ID,
			"createTime": v.CreatedAt,
			"category":   models.DisplayFileCategory(v.Category),
			"public":     true,
		})
	}
	apiReturn.SuccessListData(c, data, count)
}

func (a *FileApi) SetPublic(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	if userInfo.Role != 1 {
		apiReturn.ErrorByCode(c, 1005)
		return
	}
	req := struct {
		ID     uint `json:"id"`
		Public bool `json:"public"`
		UserId uint `json:"userId"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	// userId in the body cannot publish another account's file or change the owner.
	_ = req.UserId
	updated, err := (&models.File{}).SetOwnPublic(global.Db, userInfo.ID, req.ID, req.Public)
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	if !updated {
		apiReturn.ErrorDataNotFound(c)
		return
	}
	apiReturn.Success(c)
}

func (a *FileApi) UpdateCategory(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := struct {
		ID       uint   `json:"id"`
		Category string `json:"category"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorParamFomat(c, err.Error())
		return
	}
	updated, err := (&models.File{}).UpdateOwnCategory(global.Db, userInfo.ID, req.ID, req.Category)
	if err != nil {
		if err == models.ErrFileCategory {
			apiReturn.ErrorByCode(c, 1400)
			return
		}
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	if !updated {
		apiReturn.ErrorDataNotFound(c)
		return
	}
	apiReturn.Success(c)
}

func (a *FileApi) Deletes(c *gin.Context) {
	userInfo, ok := base.GetCurrentUserInfo(c)
	if !ok || userInfo.ID == 0 {
		apiReturn.ErrorByCode(c, 1000)
		return
	}
	req := struct {
		Ids     []uint `json:"ids"`
		Confirm string `json:"confirm"`
		UserId  uint   `json:"userId"`
	}{}
	if err := c.ShouldBindBodyWith(&req, binding.JSON); err != nil {
		apiReturn.ErrorByCode(c, 1400)
		return
	}
	// An account id in the body cannot delete another account's files, even for an administrator.
	_ = req.UserId
	if strings.TrimSpace(req.Confirm) != DeleteOwnFilesConfirm {
		apiReturn.Error(c, "删除图片需要再次确认。这次没有删除任何内容。")
		return
	}
	if len(req.Ids) == 0 {
		apiReturn.ErrorByCode(c, 1400)
		return
	}
	if len(req.Ids) > DeleteOwnFilesMaxIDs {
		apiReturn.Error(c, "一次最多删除 100 张图片。这次没有删除任何内容。")
		return
	}
	root := ""
	if global.Config != nil {
		root = global.Config.GetValueString("base", "source_path")
	}
	result, err := deleteOwnFiles(global.Db, userInfo.ID, root, req.Ids)
	if err != nil {
		apiReturn.ErrorDatabase(c, err.Error())
		return
	}
	if len(result.Failed) > 0 {
		apiReturn.ErrorCode(c, -1, "有图片没有删除。", result)
		return
	}
	apiReturn.SuccessData(c, result)
}

func uploadCategory(raw string) (string, bool) {
	if strings.TrimSpace(raw) == "" {
		return models.FileCategoryUncategorized, true
	}
	return models.NormalizeFileCategory(raw)
}

func allowedImageExt(name string) bool {
	switch strings.ToLower(path.Ext(name)) {
	case ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico":
		return true
	default:
		return false
	}
}

func minInt64(a, b int64) int64 {
	if a < b {
		return a
	}
	return b
}

func isMaxBytesError(err error) bool {
	var maxErr *http.MaxBytesError
	return errors.As(err, &maxErr)
}

func validateUploadedImage(f *multipart.FileHeader, fileExt string) error {
	if f == nil || f.Size <= 0 {
		return errUploadInvalidFormat
	}
	if f.Size > maxUploadFileBytes {
		return errUploadTooLarge
	}
	src, err := f.Open()
	if err != nil {
		return err
	}
	defer src.Close()

	if fileExt == ".svg" {
		data, err := io.ReadAll(io.LimitReader(src, maxUploadFileBytes+1))
		if err != nil {
			return err
		}
		if int64(len(data)) == 0 {
			return errUploadInvalidFormat
		}
		if int64(len(data)) > maxUploadFileBytes {
			return errUploadTooLarge
		}
		return validateSVGPayload(data)
	}

	var head [16]byte
	n, err := io.ReadFull(src, head[:])
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return err
	}
	if n == 0 {
		return errUploadInvalidFormat
	}
	if !matchesRasterMagic(fileExt, head[:n]) {
		return errUploadInvalidFormat
	}
	// Guard against spoofed FileHeader.Size by bounding actual readable bytes.
	remaining, err := io.Copy(io.Discard, io.LimitReader(src, maxUploadFileBytes-int64(n)+1))
	if err != nil {
		return err
	}
	if int64(n)+remaining > maxUploadFileBytes {
		return errUploadTooLarge
	}
	return nil
}

func matchesRasterMagic(fileExt string, head []byte) bool {
	switch fileExt {
	case ".png":
		return bytes.HasPrefix(head, []byte{0x89, 'P', 'N', 'G', '\r', '\n', 0x1a, '\n'})
	case ".jpg", ".jpeg":
		return len(head) >= 3 && head[0] == 0xff && head[1] == 0xd8 && head[2] == 0xff
	case ".gif":
		return bytes.HasPrefix(head, []byte("GIF87a")) || bytes.HasPrefix(head, []byte("GIF89a"))
	case ".webp":
		return len(head) >= 12 && bytes.Equal(head[0:4], []byte("RIFF")) && bytes.Equal(head[8:12], []byte("WEBP"))
	case ".ico":
		return len(head) >= 4 && (bytes.Equal(head[0:4], []byte{0x00, 0x00, 0x01, 0x00}) || bytes.Equal(head[0:4], []byte{0x00, 0x00, 0x02, 0x00}))
	default:
		return false
	}
}

func validateSVGPayload(data []byte) error {
	if bytes.IndexByte(data, 0) >= 0 || !utf8.Valid(data) {
		return errUploadInvalidFormat
	}
	trimmed := bytes.TrimPrefix(data, []byte{0xef, 0xbb, 0xbf})
	lower := strings.ToLower(string(trimmed))
	if strings.Contains(lower, "<!entity") {
		return errUploadInvalidFormat
	}
	dec := xml.NewDecoder(bytes.NewReader(trimmed))
	dec.Strict = true
	dec.Entity = map[string]string{}
	for {
		tok, err := dec.Token()
		if err != nil {
			return errUploadInvalidFormat
		}
		if start, ok := tok.(xml.StartElement); ok {
			if strings.EqualFold(start.Name.Local, "svg") {
				return nil
			}
			return errUploadInvalidFormat
		}
	}
}
