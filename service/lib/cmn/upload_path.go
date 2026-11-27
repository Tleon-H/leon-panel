package cmn

import (
	"path"
	"path/filepath"
	"strings"
)

var reservedUploadPrefixes = map[string]struct{}{
	"/":       {},
	"/api":    {},
	"/assets": {},
	"/custom": {},
	"/login":  {},
	"/404":    {},
	"/500":    {},
	"/test":   {},
	"/clear":  {},
}

// UploadPublicPrefix 将配置的 source_path 归一化为统一的公开 URL 前缀（始终以 "/" 开头、无尾斜杠）。
// 例如 "./uploads"、"uploads"、"/uploads" 均归一化为 "/uploads"。
func UploadPublicPrefix(sourcePath string) string {
	trimmed := strings.TrimSpace(filepath.ToSlash(sourcePath))
	for strings.HasPrefix(trimmed, "./") {
		trimmed = strings.TrimPrefix(trimmed, "./")
	}
	trimmed = strings.TrimRight(trimmed, "/")
	if trimmed == "" || trimmed == "." {
		return "/uploads"
	}
	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}
	cleaned := path.Clean(trimmed)
	if cleaned == "/" || cleaned == "." {
		return "/uploads"
	}
	return cleaned
}

// UploadLegacyPrefix 计算旧版 sourcePath[1:] 规则在无 "./" 前缀的相对路径（如 "uploads" -> "/ploads"）下
// 曾经暴露过的历史 URL 前缀，用于兼容已保存在数据库中的旧素材地址；若与规范前缀一致则返回空字符串。
func UploadLegacyPrefix(sourcePath string) string {
	trimmed := strings.TrimSpace(filepath.ToSlash(sourcePath))
	if len(trimmed) <= 1 {
		return ""
	}
	legacy := strings.Trim(trimmed[1:], "/")
	if legacy == "" {
		return ""
	}
	legacy = path.Clean("/" + legacy)
	if legacy == UploadPublicPrefix(sourcePath) {
		return ""
	}
	if _, reserved := reservedUploadPrefixes[legacy]; reserved {
		return ""
	}
	return legacy
}

// UploadRoutePrefixes 返回静态上传目录需要挂载的全部 URL 前缀：
// 首位始终为规范公开前缀，若存在历史兼容前缀（如裸 "uploads" 对应的 "/ploads"）则一并返回。
func UploadRoutePrefixes(sourcePath string) []string {
	canonical := UploadPublicPrefix(sourcePath)
	legacy := UploadLegacyPrefix(sourcePath)
	if legacy == "" || legacy == canonical {
		return []string{canonical}
	}
	return []string{canonical, legacy}
}

// UploadPublicURL 将数据库/磁盘保存的上传路径统一转换为与静态路由一致的公开 URL。
func UploadPublicURL(storedPath string) string {
	trimmed := strings.TrimSpace(filepath.ToSlash(storedPath))
	if trimmed == "" {
		return ""
	}
	for strings.HasPrefix(trimmed, "./") {
		trimmed = strings.TrimPrefix(trimmed, "./")
	}
	if trimmed == "" || trimmed == "." {
		return ""
	}
	if !strings.HasPrefix(trimmed, "/") {
		trimmed = "/" + trimmed
	}
	return path.Clean(trimmed)
}
