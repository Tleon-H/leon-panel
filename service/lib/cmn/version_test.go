package cmn

import "testing"

func TestSysVersionInfoTrimsTheVersionFileNewline(t *testing.T) {
	info := GetSysVersionInfo()
	if info.Version_code != 1 || info.Version != "0.4.0" {
		t.Fatalf("version = %d %q", info.Version_code, info.Version)
	}
}
