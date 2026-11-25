package siteFavicon

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"leon-panel/lib/cmn"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

const (
	defaultUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
	defaultTimeout   = 10 * time.Second
	maxHTMLBytes     = 2 * 1024 * 1024
)

type SavedFavicon struct {
	FilePath string
	Ext      string
	Source   string
	Host     string
}

type scoredCandidate struct {
	url   string
	score int
}

func newHTTPClient() *http.Client {
	return &http.Client{
		Timeout: defaultTimeout,
	}
}

func IsHTTPURL(raw string) bool {
	httpPattern := `^(http://|https://|//)`
	match, err := regexp.MatchString(httpPattern, raw)
	if err != nil {
		return false
	}
	return match
}

// NormalizeSiteURL cleans user input and ensures an http/https scheme.
func NormalizeSiteURL(raw string) (*url.URL, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil, errors.New("网址不能为空")
	}
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "javascript:") || strings.HasPrefix(lower, "data:") || strings.HasPrefix(lower, "file:") {
		return nil, errors.New("仅支持 http 或 https 网址")
	}
	if !strings.HasPrefix(lower, "http://") && !strings.HasPrefix(lower, "https://") {
		if strings.HasPrefix(trimmed, "//") {
			trimmed = "https:" + trimmed
		} else {
			trimmed = "https://" + trimmed
		}
	}
	parsed, err := url.Parse(trimmed)
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return nil, errors.New("网址格式无效")
	}
	return parsed, nil
}

func GetOneFaviconURL(urlStr string) (string, error) {
	candidates, _, err := DiscoverFaviconCandidates(urlStr)
	if err != nil && len(candidates) == 0 {
		return "", err
	}
	if len(candidates) == 0 {
		return "", fmt.Errorf("not found ico")
	}
	return candidates[0], nil
}

// DiscoverFaviconCandidates fetches the page HTML (if reachable) to extract ranked <link> icons
// and always appends standard origin fallback icon paths (/favicon.ico, /favicon.png, /apple-touch-icon.png).
func DiscoverFaviconCandidates(rawURL string) ([]string, *url.URL, error) {
	parsed, err := NormalizeSiteURL(rawURL)
	if err != nil {
		return nil, nil, err
	}

	client := newHTTPClient()
	candidates := make([]scoredCandidate, 0, 12)
	pageURL := parsed
	var fetchErr error

	req, err := http.NewRequest(http.MethodGet, parsed.String(), nil)
	if err == nil {
		req.Header.Set("User-Agent", defaultUserAgent)
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.5")
		resp, doErr := client.Do(req)
		if doErr != nil && parsed.Scheme == "https" && !strings.HasPrefix(strings.ToLower(strings.TrimSpace(rawURL)), "https://") {
			// If user omitted scheme and https failed (e.g. HTTP-only LAN/test server), retry http://
			httpFallback := *parsed
			httpFallback.Scheme = "http"
			req2, reqErr2 := http.NewRequest(http.MethodGet, httpFallback.String(), nil)
			if reqErr2 == nil {
				req2.Header.Set("User-Agent", defaultUserAgent)
				req2.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/*;q=0.8,*/*;q=0.5")
				resp2, doErr2 := client.Do(req2)
				if doErr2 == nil {
					resp = resp2
					doErr = nil
					parsed = &httpFallback
					pageURL = &httpFallback
				}
			}
		}

		if doErr != nil {
			fetchErr = doErr
		} else {
			defer resp.Body.Close()
			if resp.Request != nil && resp.Request.URL != nil {
				pageURL = resp.Request.URL
			}
			ct := strings.ToLower(resp.Header.Get("Content-Type"))
			if resp.StatusCode == http.StatusOK && strings.HasPrefix(ct, "image/") {
				candidates = append(candidates, scoredCandidate{url: pageURL.String(), score: 100})
			} else if resp.StatusCode == http.StatusOK {
				limited := io.LimitReader(resp.Body, maxHTMLBytes)
				if doc, parseErr := goquery.NewDocumentFromReader(limited); parseErr == nil {
					doc.Find("link").Each(func(_ int, s *goquery.Selection) {
						relRaw, _ := s.Attr("rel")
						hrefRaw, _ := s.Attr("href")
						href := strings.TrimSpace(hrefRaw)
						if href == "" {
							return
						}
						rel := strings.ToLower(strings.TrimSpace(relRaw))
						if !strings.Contains(rel, "icon") {
							return
						}
						// Skip Safari monochrome mask-icon unless nothing else exists
						if strings.Contains(rel, "mask-icon") {
							return
						}
						resolved := resolveIconHref(pageURL, href)
						if resolved == "" {
							return
						}
						typeAttr, _ := s.Attr("type")
						sizesAttr, _ := s.Attr("sizes")
						candidates = append(candidates, scoredCandidate{
							url:   resolved,
							score: scoreIconLink(rel, strings.ToLower(typeAttr), strings.ToLower(sizesAttr), resolved),
						})
					})
				}
			}
		}
	}

	// Sort discovered <link> icons by descending score (stable insertion sort for small slice)
	for i := 1; i < len(candidates); i++ {
		cur := candidates[i]
		j := i - 1
		for j >= 0 && candidates[j].score < cur.score {
			candidates[j+1] = candidates[j]
			j--
		}
		candidates[j+1] = cur
	}

	// Always add standard root fallbacks on the final redirected origin (and original origin if different)
	appendOriginFallbacks := func(u *url.URL) {
		if u == nil || u.Scheme == "" || u.Host == "" {
			return
		}
		origin := u.Scheme + "://" + u.Host
		candidates = append(candidates,
			scoredCandidate{url: origin + "/apple-touch-icon.png", score: 25},
			scoredCandidate{url: origin + "/favicon.png", score: 24},
			scoredCandidate{url: origin + "/favicon.svg", score: 23},
			scoredCandidate{url: origin + "/favicon.ico", score: 20},
		)
	}
	appendOriginFallbacks(pageURL)
	if pageURL.Host != parsed.Host || pageURL.Scheme != parsed.Scheme {
		appendOriginFallbacks(parsed)
	}

	seen := make(map[string]struct{}, len(candidates))
	result := make([]string, 0, len(candidates))
	for _, c := range candidates {
		if c.url == "" {
			continue
		}
		if _, dup := seen[c.url]; dup {
			continue
		}
		seen[c.url] = struct{}{}
		result = append(result, c.url)
	}

	return result, pageURL, fetchErr
}

func resolveIconHref(baseURL *url.URL, href string) string {
	trimmed := strings.TrimSpace(href)
	if trimmed == "" {
		return ""
	}
	if strings.HasPrefix(strings.ToLower(trimmed), "data:image/") {
		return trimmed
	}
	if strings.HasPrefix(trimmed, "//") {
		scheme := "https"
		if baseURL != nil && baseURL.Scheme != "" {
			scheme = baseURL.Scheme
		}
		return scheme + ":" + trimmed
	}
	ref, err := url.Parse(trimmed)
	if err != nil {
		return ""
	}
	if ref.IsAbs() {
		if ref.Scheme == "http" || ref.Scheme == "https" {
			return ref.String()
		}
		return ""
	}
	if baseURL == nil {
		return ""
	}
	resolved := baseURL.ResolveReference(ref)
	if resolved.Scheme != "http" && resolved.Scheme != "https" {
		return ""
	}
	return resolved.String()
}

func scoreIconLink(rel, typeAttr, sizesAttr, resolvedURL string) int {
	score := 50
	lowerURL := strings.ToLower(resolvedURL)
	if strings.Contains(rel, "apple-touch-icon") {
		score += 20
	} else if strings.Contains(rel, "fluid-icon") {
		score += 18
	} else if rel == "icon" || strings.Contains(rel, "shortcut icon") {
		score += 15
	}
	if strings.Contains(typeAttr, "png") || strings.HasSuffix(lowerURL, ".png") {
		score += 12
	} else if strings.Contains(typeAttr, "svg") || strings.HasSuffix(lowerURL, ".svg") {
		score += 10
	} else if strings.Contains(typeAttr, "webp") || strings.HasSuffix(lowerURL, ".webp") {
		score += 9
	} else if strings.HasSuffix(lowerURL, ".ico") {
		score += 4
	}
	if sizesAttr != "" && sizesAttr != "any" {
		parts := strings.Split(strings.Fields(sizesAttr)[0], "x")
		if len(parts) == 2 {
			if px, err := strconv.Atoi(parts[0]); err == nil {
				if px >= 128 {
					score += 15
				} else if px >= 64 {
					score += 10
				} else if px >= 32 {
					score += 5
				}
			}
		}
	}
	return score
}

// FetchAndSaveBestFavicon discovers candidate icons for rawURL, downloads the first valid image
// into saveDir (without double slashes), validates it is genuinely an image, and saves it locally.
func FetchAndSaveBestFavicon(rawURL, saveDir string, maxSize int64) (*SavedFavicon, error) {
	candidates, pageURL, discoverErr := DiscoverFaviconCandidates(rawURL)
	if pageURL == nil {
		return nil, discoverErr
	}
	if len(candidates) == 0 {
		if discoverErr != nil {
			return nil, fmt.Errorf("无法访问目标站点: %w", discoverErr)
		}
		return nil, errors.New("未在目标站点找到可用图标")
	}

	referer := pageURL.Scheme + "://" + pageURL.Host + "/"
	cleanDir := strings.TrimRight(saveDir, "/")
	if err := os.MkdirAll(cleanDir, os.ModePerm); err != nil {
		return nil, fmt.Errorf("创建图标目录失败: %w", err)
	}

	var lastErr error
	for _, candidate := range candidates {
		data, ext, err := fetchCandidateImage(candidate, referer, maxSize)
		if err != nil {
			lastErr = err
			continue
		}
		fileName := cmn.Md5(fmt.Sprintf("%s%d", candidate, time.Now().UnixNano())) + ext
		filePath := cleanDir + "/" + fileName
		if err := os.WriteFile(filePath, data, 0o644); err != nil {
			return nil, fmt.Errorf("保存图标文件失败: %w", err)
		}
		return &SavedFavicon{
			FilePath: filePath,
			Ext:      ext,
			Source:   candidate,
			Host:     pageURL.Host,
		}, nil
	}

	if discoverErr != nil {
		return nil, fmt.Errorf("无法访问目标站点且未获取到图标（%v）", discoverErr)
	}
	if lastErr != nil {
		return nil, fmt.Errorf("未获取到有效网站图标（%v）", lastErr)
	}
	return nil, errors.New("未获取到有效网站图标")
}

func fetchCandidateImage(candidateURL, referer string, maxSize int64) ([]byte, string, error) {
	if strings.HasPrefix(strings.ToLower(candidateURL), "data:image/") {
		return decodeDataImageURI(candidateURL, maxSize)
	}

	client := newHTTPClient()
	req, err := http.NewRequest(http.MethodGet, candidateURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	req.Header.Set("Accept", "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8")
	if referer != "" {
		req.Header.Set("Referer", referer)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	if resp.ContentLength > maxSize {
		return nil, "", fmt.Errorf("图标文件过大（%d 字节）", resp.ContentLength)
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxSize+1))
	if err != nil {
		return nil, "", err
	}
	if int64(len(data)) > maxSize {
		return nil, "", fmt.Errorf("图标文件超过限制大小")
	}
	if len(data) == 0 {
		return nil, "", errors.New("图标内容为空")
	}

	ext, ok := detectValidImageExt(data, resp.Header.Get("Content-Type"), candidateURL)
	if !ok {
		return nil, "", errors.New("返回内容不是有效图片格式")
	}
	return data, ext, nil
}

func decodeDataImageURI(dataURI string, maxSize int64) ([]byte, string, error) {
	comma := strings.IndexByte(dataURI, ',')
	if comma <= 5 {
		return nil, "", errors.New("无效的 data URI 图标")
	}
	meta := dataURI[5:comma]
	payload := dataURI[comma+1:]
	isBase64 := strings.Contains(strings.ToLower(meta), ";base64")
	contentType := strings.Split(meta, ";")[0]

	var decoded []byte
	var err error
	if isBase64 {
		decoded, err = base64.StdEncoding.DecodeString(payload)
		if err != nil {
			decoded, err = base64.RawStdEncoding.DecodeString(payload)
		}
	} else {
		unescaped, uErr := url.PathUnescape(payload)
		if uErr != nil {
			unescaped = payload
		}
		decoded = []byte(unescaped)
	}
	if err != nil || len(decoded) == 0 {
		return nil, "", errors.New("解码 data URI 图标失败")
	}
	if int64(len(decoded)) > maxSize {
		return nil, "", errors.New("图标文件超过限制大小")
	}
	ext, ok := detectValidImageExt(decoded, contentType, "")
	if !ok {
		return nil, "", errors.New("不支持的 data URI 图片格式")
	}
	return decoded, ext, nil
}

func detectValidImageExt(data []byte, contentTypeHeader, rawURL string) (string, bool) {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) == 0 {
		return "", false
	}

	// Reject obvious HTML/JSON error pages even if server misconfigured Content-Type
	lowerHead := strings.ToLower(string(trimmed[:minInt(len(trimmed), 256)]))
	if strings.HasPrefix(lowerHead, "<!doctype html") || strings.HasPrefix(lowerHead, "<html") || strings.Contains(lowerHead, "<head>") {
		return "", false
	}

	// Check binary magic bytes first
	if len(data) >= 8 && bytes.Equal(data[:8], []byte{0x89, 'P', 'N', 'G', 0x0d, 0x0a, 0x1a, 0x0a}) {
		return ".png", true
	}
	if len(data) >= 3 && data[0] == 0xff && data[1] == 0xd8 && data[2] == 0xff {
		return ".jpg", true
	}
	if len(data) >= 6 && (bytes.HasPrefix(data, []byte("GIF87a")) || bytes.HasPrefix(data, []byte("GIF89a"))) {
		return ".gif", true
	}
	if len(data) >= 12 && bytes.Equal(data[:4], []byte("RIFF")) && bytes.Equal(data[8:12], []byte("WEBP")) {
		return ".webp", true
	}
	// ICO (00 00 01 00) or CUR (00 00 02 00)
	if len(data) >= 4 && data[0] == 0x00 && data[1] == 0x00 && (data[2] == 0x01 || data[2] == 0x02) && data[3] == 0x00 {
		return ".ico", true
	}
	// SVG XML
	if strings.Contains(lowerHead, "<svg") {
		return ".svg", true
	}

	// Fallback to Content-Type header if it explicitly declares a supported image MIME
	mediaType, _, _ := mime.ParseMediaType(contentTypeHeader)
	switch strings.ToLower(mediaType) {
	case "image/png":
		return ".png", true
	case "image/jpeg", "image/jpg":
		return ".jpg", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	case "image/svg+xml":
		return ".svg", true
	case "image/x-icon", "image/vnd.microsoft.icon", "image/ico":
		return ".ico", true
	}

	// Final fallback: Go's built-in content sniffer
	sniffed := strings.ToLower(http.DetectContentType(data))
	switch sniffed {
	case "image/png":
		return ".png", true
	case "image/jpeg":
		return ".jpg", true
	case "image/gif":
		return ".gif", true
	case "image/webp":
		return ".webp", true
	case "image/x-icon":
		return ".ico", true
	}

	// Accept .ico only if URL ends with .ico and content isn't text/html
	if rawURL != "" && !strings.HasPrefix(sniffed, "text/") {
		if u, err := url.Parse(rawURL); err == nil {
			ext := strings.ToLower(path.Ext(u.Path))
			switch ext {
			case ".ico", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg":
				return ext, true
			}
		}
	}
	return "", false
}

func minInt(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// 获取远程文件的大小（保留兼容导出函数）
func GetRemoteFileSize(rawURL string) (int64, error) {
	client := newHTTPClient()
	req, err := http.NewRequest(http.MethodHead, rawURL, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("User-Agent", defaultUserAgent)
	resp, err := client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("HTTP request failed, status code: %d", resp.StatusCode)
	}
	return resp.ContentLength, nil
}

// 下载图片（保留兼容导出函数，改为单次带 UA 的 GET 并安全限流，不依赖 HEAD）
func DownloadImage(rawURL, savePath string, maxSize int64) (*os.File, error) {
	data, ext, err := fetchCandidateImage(rawURL, "", maxSize)
	if err != nil {
		return nil, err
	}
	cleanDir := strings.TrimRight(savePath, "/")
	if err := os.MkdirAll(cleanDir, os.ModePerm); err != nil {
		return nil, err
	}
	fileName := cmn.Md5(fmt.Sprintf("%s%d", rawURL, time.Now().UnixNano())) + ext
	destination := cleanDir + "/" + fileName

	file, err := os.Create(destination)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	if _, err := file.Write(data); err != nil {
		return nil, err
	}
	return file, nil
}

func GetOneFaviconURLAndUpload(urlStr string) (string, bool) {
	u, err := GetOneFaviconURL(urlStr)
	if err != nil || u == "" {
		return "", false
	}
	return u, true
}
