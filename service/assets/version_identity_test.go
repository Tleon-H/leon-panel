package assets

import (
	"os"
	"strconv"
	"strings"
	"testing"
)

func TestVersionFileFormat(t *testing.T) {
	raw, err := os.ReadFile("version")
	if err != nil {
		t.Fatal(err)
	}
	parts := strings.Split(strings.TrimSpace(string(raw)), "|")
	if len(parts) != 2 {
		t.Fatalf("version file must stay code|name, got %q", raw)
	}
	code, err := strconv.Atoi(parts[0])
	if err != nil {
		t.Fatal(err)
	}
	if code != 1 {
		t.Fatalf("numeric version code = %d, want 1", code)
	}
	if parts[1] != "0.1.0" {
		t.Fatalf("display version = %s, want 0.1.0", parts[1])
	}
}
