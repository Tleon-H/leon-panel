package cmn

import (
	"path"
	"path/filepath"
	"strings"
)

var reservedUploadExactPrefixes = map[string]struct{}{
	"/":                     {},
	"/login":                {},
	"/404":                  {},
	"/500":                  {},
	"/test":                 {},
	"/clear":                {},
	"/favicon.ico":          {},
	"/favicon.svg":          {},
	"/favicon-black.svg":    {},
	"/apple-touch-icon.png": {},
	"/pwa-192x192.png":      {},
	"/pwa-512x512.png":      {},
}

var reservedUploadTreePrefixes = []string{
	"/api",
	"/assets",
	"/custom",
}

func isReservedUploadPrefix(prefix string) bool {
	cleaned := path.Clean(prefix)
	if _, ok := reservedUploadExactPrefixes[cleaned]; ok {
		return true
	}
	for _, tree := range reservedUploadTreePrefixes {
		if cleaned == tree || strings.HasPrefix(cleaned, tree+"/") {
			return true
		}
	}
	return false
}

func rawCanonicalUploadPrefix(sourcePath string) string {
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

func rawLegacyUploadPrefix(sourcePath string) string {
	trimmed := strings.TrimSpace(filepath.ToSlash(sourcePath))
	if len(trimmed) <= 1 {
		return ""
	}
	legacy := strings.Trim(trimmed[1:], "/")
	if legacy == "" {
		return ""
	}
	legacy = path.Clean("/" + legacy)
	if legacy == "/" || legacy == "." || isReservedUploadPrefix(legacy) {
		return ""
	}
	return legacy
}

// UploadPublicPrefix 将配置的 source_path 归一化为统一的公开 URL 前缀（始终以 "/" 开头、无尾斜杠）。
// 若规范前缀与内置路由（如 /assets、/custom、/api）冲突，则优先回退到不冲突的历史前缀（例如裸 "assets" -> "/ssets"），
// 以保证旧配置平滑启动且与历史 URL 兼容；若历史前缀也冲突则回退到 "/uploads"。
func UploadPublicPrefix(sourcePath string) string {
	canonical := rawCanonicalUploadPrefix(sourcePath)
	if !isReservedUploadPrefix(canonical) {
		return canonical
	}
	if legacy := rawLegacyUploadPrefix(sourcePath); legacy != "" {
		return legacy
	}
	return "/uploads"
}

// UploadLegacyPrefix 计算旧版 sourcePath[1:] 规则在无 "./" 前缀的相对路径（如 "uploads" -> "/ploads"）下
// 曾经暴露过的历史 URL 前缀，用于兼容已保存在数据库中的旧素材地址；若与当前公开前缀一致或冲突则返回空字符串。
func UploadLegacyPrefix(sourcePath string) string {
	legacy := rawLegacyUploadPrefix(sourcePath)
	if legacy == "" || legacy == UploadPublicPrefix(sourcePath) {
		return ""
	}
	return legacy
}

// UploadRoutePrefixes 返回静态上传目录需要挂载的全部 URL 前缀：
// 首位始终为当前不冲突的公开前缀，若还存在与公开前缀不同的合法历史兼容前缀（如裸 "uploads" 对应的 "/ploads"）则一并返回。
func UploadRoutePrefixes(sourcePath string) []string {
	publicPrefix := UploadPublicPrefix(sourcePath)
	legacy := UploadLegacyPrefix(sourcePath)
	if legacy == "" || legacy == publicPrefix {
		return []string{publicPrefix}
	}
	return []string{publicPrefix, legacy}
}

// UploadPublicURL 将数据库/磁盘保存的上传路径转换为以 "/" 开头的公开 URL（用于无 source_path 上下文的回退场景）。
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

func normalizeSourceMatchPath(p string) string {
	trimmed := strings.TrimSpace(filepath.ToSlash(p))
	for strings.HasPrefix(trimmed, "./") {
		trimmed = strings.TrimPrefix(trimmed, "./")
	}
	trimmed = strings.TrimRight(trimmed, "/")
	if trimmed == "" {
		return ""
	}
	return path.Clean(trimmed)
}

// UploadPublicURLWithSource 结合当前配置的 source_path，将磁盘/数据库保存的路径转换为与静态挂载路由一致的公开 URL。
// 当 source_path 的规范前缀与内置路由冲突（如裸 "assets" 回退到 "/ssets"）时，返回的 URL 也会一致使用 "/ssets/..."。
func UploadPublicURLWithSource(sourcePath, storedPath string) string {
	trimmedStored := strings.TrimSpace(filepath.ToSlash(storedPath))
	if trimmedStored == "" {
		return ""
	}
	if strings.TrimSpace(sourcePath) != "" {
		normRoot := normalizeSourceMatchPath(sourcePath)
		normStored := normalizeSourceMatchPath(trimmedStored)
		if normRoot != "" && normRoot != "." && normRoot != "/" {
			if strings.HasPrefix(normStored, normRoot+"/") {
				rel := strings.TrimPrefix(normStored, normRoot+"/")
				return path.Clean(UploadPublicPrefix(sourcePath) + "/" + rel)
			}
		}
	}
	return UploadPublicURL(trimmedStored)
}
