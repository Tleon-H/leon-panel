package cmn

import (
	"reflect"
	"testing"
)

func TestUploadRoutePrefixesAndPublicURL(t *testing.T) {
	prefixCases := []struct {
		sourcePath string
		wantPublic string
		wantLegacy string
		wantRoutes []string
	}{
		{"./uploads", "/uploads", "", []string{"/uploads"}},
		{"./uploads/", "/uploads", "", []string{"/uploads"}},
		{"uploads", "/uploads", "/ploads", []string{"/uploads", "/ploads"}},
		{"uploads/", "/uploads", "/ploads", []string{"/uploads", "/ploads"}},
		{"/uploads", "/uploads", "", []string{"/uploads"}},
		{"data/uploads", "/data/uploads", "/ata/uploads", []string{"/data/uploads", "/ata/uploads"}},
		{"./custom/uploads", "/custom/uploads", "", []string{"/custom/uploads"}},
	}

	for _, tc := range prefixCases {
		if got := UploadPublicPrefix(tc.sourcePath); got != tc.wantPublic {
			t.Fatalf("UploadPublicPrefix(%q) = %q, want %q", tc.sourcePath, got, tc.wantPublic)
		}
		if got := UploadLegacyPrefix(tc.sourcePath); got != tc.wantLegacy {
			t.Fatalf("UploadLegacyPrefix(%q) = %q, want %q", tc.sourcePath, got, tc.wantLegacy)
		}
		if got := UploadRoutePrefixes(tc.sourcePath); !reflect.DeepEqual(got, tc.wantRoutes) {
			t.Fatalf("UploadRoutePrefixes(%q) = %v, want %v", tc.sourcePath, got, tc.wantRoutes)
		}
	}

	urlCases := []struct {
		stored string
		want   string
	}{
		{"./uploads/2026/11/27/icon.png", "/uploads/2026/11/27/icon.png"},
		{"uploads/2026/11/27/icon.png", "/uploads/2026/11/27/icon.png"},
		{"/uploads/2026/11/27/icon.png", "/uploads/2026/11/27/icon.png"},
		{"./uploads//2026/11/27/icon.svg", "/uploads/2026/11/27/icon.svg"},
		{"uploads//2026/11/27/icon.svg", "/uploads/2026/11/27/icon.svg"},
		{"", ""},
	}
	for _, tc := range urlCases {
		if got := UploadPublicURL(tc.stored); got != tc.want {
			t.Fatalf("UploadPublicURL(%q) = %q, want %q", tc.stored, got, tc.want)
		}
	}
}
