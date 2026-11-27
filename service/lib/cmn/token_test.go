package cmn

import (
	"regexp"
	"sync"
	"testing"
)

func TestBuildCryptoRandTokenGeneratesUniqueHexTokensConcurrently(t *testing.T) {
	if _, err := BuildCryptoRandToken(0); err == nil {
		t.Fatal("expected error for zero length")
	}
	if _, err := BuildCryptoRandToken(-4); err == nil {
		t.Fatal("expected error for negative length")
	}

	hex32 := regexp.MustCompile(`^[0-9a-f]{32}$`)
	const workers = 32
	const perWorker = 8
	results := make(chan string, workers*perWorker)

	var wg sync.WaitGroup
	for w := 0; w < workers; w++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for i := 0; i < perWorker; i++ {
				tok, err := BuildCryptoRandToken(32)
				if err != nil {
					t.Errorf("BuildCryptoRandToken(32): %v", err)
					return
				}
				results <- tok
			}
		}()
	}
	wg.Wait()
	close(results)

	seen := make(map[string]struct{}, workers*perWorker)
	for tok := range results {
		if !hex32.MatchString(tok) {
			t.Fatalf("unexpected token format %q", tok)
		}
		if _, dup := seen[tok]; dup {
			t.Fatalf("duplicate CSPRNG token %q", tok)
		}
		seen[tok] = struct{}{}
	}
}
