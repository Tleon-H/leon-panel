package siteFavicon

import (
	"bytes"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
)

// Minimal valid 1x1 PNG bytes
var samplePNG, _ = base64.StdEncoding.DecodeString(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
)

// Minimal valid 1x1 ICO header + payload
var sampleICO = []byte{
	0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x18, 0x00, 0x16, 0x00,
	0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
}

func TestFetchAndSaveBestFavicon_Head405QueryParamAndNoExt(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/":
			w.Header().Set("Content-Type", "text/html; charset=utf-8")
			_, _ = w.Write([]byte(`<!doctype html><html><head>
				<link rel="mask-icon" href="/mask.svg">
				<link rel="icon" href="/broken.png">
				<link rel="icon" sizes="192x192" href="/api/icon?token=valid123">
			</head><body>ok</body></html>`))
		case "/api/icon":
			if r.Method == http.MethodHead {
				w.WriteHeader(http.StatusMethodNotAllowed)
				return
			}
			if r.URL.Query().Get("token") != "valid123" {
				w.WriteHeader(http.StatusForbidden)
				return
			}
			w.Header().Set("Content-Type", "image/png")
			_, _ = w.Write(samplePNG)
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()

	saveDir := t.TempDir() + "/icons/"
	saved, err := FetchAndSaveBestFavicon(srv.URL, saveDir, 1024*1024)
	if err != nil {
		t.Fatalf("FetchAndSaveBestFavicon failed: %v", err)
	}
	if saved.Ext != ".png" {
		t.Fatalf("expected inferred .png extension, got %q", saved.Ext)
	}
	if strings.Contains(saved.FilePath, "//") {
		t.Fatalf("saved path must not contain double slash: %q", saved.FilePath)
	}
	raw, err := os.ReadFile(saved.FilePath)
	if err != nil || !bytes.Equal(raw, samplePNG) {
		t.Fatalf("saved PNG bytes mismatch: err=%v len=%d", err, len(raw))
	}
}

func TestFetchAndSaveBestFavicon_RootFallbackWhenHomeReturns403(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/favicon.ico" {
			w.Header().Set("Content-Type", "image/x-icon")
			_, _ = w.Write(sampleICO)
			return
		}
		w.WriteHeader(http.StatusForbidden)
	}))
	defer srv.Close()

	// Also test bare host:port without http:// scheme (falls back from https -> http)
	bareHost := strings.TrimPrefix(srv.URL, "http://")
	saved, err := FetchAndSaveBestFavicon(bareHost, t.TempDir(), 1024*1024)
	if err != nil {
		t.Fatalf("expected /favicon.ico fallback to succeed even when homepage is 403, got: %v", err)
	}
	if saved.Ext != ".ico" {
		t.Fatalf("expected .ico extension, got %q", saved.Ext)
	}
}

func TestFetchAndSaveBestFavicon_InlineDataURISVG(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte(`<html><head><link rel="icon" type="image/svg+xml" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Ccircle cx='8' cy='8' r='6'/%3E%3C/svg%3E"></head></html>`))
			return
		}
		w.WriteHeader(http.StatusNotFound)
	}))
	defer srv.Close()

	saved, err := FetchAndSaveBestFavicon(srv.URL, t.TempDir(), 1024*1024)
	if err != nil {
		t.Fatalf("expected inline data:image/svg+xml to succeed, got: %v", err)
	}
	if saved.Ext != ".svg" {
		t.Fatalf("expected .svg extension, got %q", saved.Ext)
	}
	raw, err := os.ReadFile(saved.FilePath)
	if err != nil || !strings.Contains(string(raw), "<svg") {
		t.Fatalf("unexpected saved svg content: %q err=%v", string(raw), err)
	}
}

func TestFetchAndSaveBestFavicon_RejectsHTMLFakeIconAndUnsafeSchemes(t *testing.T) {
	// Server returns 200 OK HTML error page for every path including /favicon.ico
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write([]byte(`<!DOCTYPE html><html><head><title>Not Found</title></head><body>404</body></html>`))
	}))
	defer srv.Close()

	dir := t.TempDir()
	if _, err := FetchAndSaveBestFavicon(srv.URL, dir, 1024*1024); err == nil {
		t.Fatal("expected HTML response to be rejected as invalid favicon")
	}
	entries, _ := os.ReadDir(dir)
	if len(entries) != 0 {
		t.Fatalf("expected no files saved on failure, found %d", len(entries))
	}

	if _, err := FetchAndSaveBestFavicon("javascript:alert(1)", dir, 1024*1024); err == nil {
		t.Fatal("expected javascript: URL to be rejected")
	}
}
