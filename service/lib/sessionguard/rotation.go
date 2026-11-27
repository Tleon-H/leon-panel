package sessionguard

import (
	"errors"
	"fmt"
	"leon-panel/lib/cache"
	"leon-panel/models"
	"sync"
	"time"

	"gorm.io/gorm"
)

const (
	// LegacyBTokenRotationV1Key records in system_setting that pre-PR-1A persistent bTokens
	// have been rotated and the current instance's session caches have been cleanly flushed.
	LegacyBTokenRotationV1Key = "auth_btoken_rotation_v1"

	// ConfigDisableStartupSessionRotation allows operators to disable automatic startup rotation
	// while keeping DTO field filtering, bookmark ownership checks, and log redaction active.
	ConfigDisableStartupSessionRotation = "disable_startup_session_rotation"

	revokedTokenFenceTTL = 10 * time.Minute
	maxRevokedFenceSize  = 10000
)

type tokenBackfillFence struct {
	mu            sync.Mutex
	globalEpoch   uint64
	tokenEpoch    map[string]uint64
	revokedAt     map[string]time.Time
	afterDBLookup func(bToken string)
}

var defaultFence = &tokenBackfillFence{
	tokenEpoch: make(map[string]uint64),
	revokedAt:  make(map[string]time.Time),
}

// SetAfterDBLookupHookForTest registers a synchronization hook invoked immediately after a DB
// token lookup completes and before fenced cache backfill is attempted. Returns a restore func.
func SetAfterDBLookupHookForTest(hook func(bToken string)) func() {
	defaultFence.mu.Lock()
	prev := defaultFence.afterDBLookup
	defaultFence.afterDBLookup = hook
	defaultFence.mu.Unlock()
	return func() {
		defaultFence.mu.Lock()
		defaultFence.afterDBLookup = prev
		defaultFence.mu.Unlock()
	}
}

func (f *tokenBackfillFence) pruneLocked(now time.Time) {
	if len(f.revokedAt) == 0 {
		return
	}
	for tok, ts := range f.revokedAt {
		if now.Sub(ts) > revokedTokenFenceTTL {
			delete(f.revokedAt, tok)
			delete(f.tokenEpoch, tok)
		}
	}
	if len(f.revokedAt) > maxRevokedFenceSize {
		f.globalEpoch++
		f.revokedAt = make(map[string]time.Time)
		f.tokenEpoch = make(map[string]uint64)
	}
}

func (f *tokenBackfillFence) isRevokedLocked(bToken string, now time.Time) bool {
	ts, ok := f.revokedAt[bToken]
	if !ok {
		return false
	}
	if now.Sub(ts) > revokedTokenFenceTTL {
		delete(f.revokedAt, bToken)
		delete(f.tokenEpoch, bToken)
		return false
	}
	return true
}

// IsActiveUser verifies that a cached or database-loaded user record is valid and enabled.
func IsActiveUser(u models.User) bool {
	return u.ID != 0 && u.Status == 1
}

// IsActiveTokenUser verifies that a token-authenticated user record has a non-empty token and Status == 1.
func IsActiveTokenUser(u models.User) bool {
	return u.ID != 0 && u.Token != "" && u.Status == 1
}

// RevokeToken permanently fences a revoked persistent bToken against late cache backfill
// and removes any existing entry from the hot UserToken cache under the same lock.
func RevokeToken(userTokenCache cache.Cacher[models.User], bToken string) {
	if bToken == "" {
		return
	}
	now := time.Now()
	defaultFence.mu.Lock()
	defer defaultFence.mu.Unlock()
	defaultFence.pruneLocked(now)
	defaultFence.tokenEpoch[bToken]++
	defaultFence.revokedAt[bToken] = now
	if userTokenCache != nil {
		userTokenCache.Delete(bToken)
	}
}

// InvalidateTokenCache invalidates a cached user profile (e.g., nickname/avatar edit) without
// permanently revoking the underlying bToken, preventing concurrent stale writes from overwriting cache.
func InvalidateTokenCache(userTokenCache cache.Cacher[models.User], bToken string) {
	if bToken == "" {
		return
	}
	defaultFence.mu.Lock()
	defer defaultFence.mu.Unlock()
	defaultFence.tokenEpoch[bToken]++
	if userTokenCache != nil {
		userTokenCache.Delete(bToken)
	}
}

// EvictUserToken revokes a single persistent bToken from the hot UserToken cache.
func EvictUserToken(userTokenCache cache.Cacher[models.User], bToken string) {
	RevokeToken(userTokenCache, bToken)
}

// EvictSessionMapping fences and removes both the client cToken mapping and persistent bToken cache entry.
func EvictSessionMapping(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
) {
	now := time.Now()
	defaultFence.mu.Lock()
	defer defaultFence.mu.Unlock()
	if bToken != "" {
		defaultFence.pruneLocked(now)
		defaultFence.tokenEpoch[bToken]++
		defaultFence.revokedAt[bToken] = now
		if userTokenCache != nil {
			userTokenCache.Delete(bToken)
		}
	}
	if cUserTokenCache != nil && cToken != "" {
		cUserTokenCache.Delete(cToken)
	}
}

// ResolveTokenUser resolves a bToken into an active models.User from hot cache or DB while enforcing
// fenced backfill: if the token is revoked or invalidated concurrently between DB load and cache write,
// the stale snapshot is never written back into UserToken cache.
func ResolveTokenUser(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
	loadFromDB func(string) (models.User, error),
) (models.User, bool) {
	if bToken == "" || userTokenCache == nil || cUserTokenCache == nil || loadFromDB == nil {
		return models.User{}, false
	}

	now := time.Now()
	defaultFence.mu.Lock()
	if defaultFence.isRevokedLocked(bToken, now) {
		userTokenCache.Delete(bToken)
		if cToken != "" {
			cUserTokenCache.Delete(cToken)
		}
		defaultFence.mu.Unlock()
		return models.User{}, false
	}
	startGlobal := defaultFence.globalEpoch
	startToken := defaultFence.tokenEpoch[bToken]
	defaultFence.mu.Unlock()

	if cached, hit := userTokenCache.Get(bToken); hit {
		defaultFence.mu.Lock()
		revoked := defaultFence.isRevokedLocked(bToken, time.Now()) ||
			defaultFence.globalEpoch != startGlobal ||
			defaultFence.tokenEpoch[bToken] != startToken
		if revoked || !IsActiveTokenUser(cached) {
			userTokenCache.Delete(bToken)
			if cToken != "" && (revoked || !IsActiveTokenUser(cached)) {
				cUserTokenCache.Delete(cToken)
			}
			defaultFence.mu.Unlock()
			return models.User{}, false
		}
		defaultFence.mu.Unlock()
		return cached, true
	}

	info, err := loadFromDB(bToken)

	defaultFence.mu.Lock()
	hook := defaultFence.afterDBLookup
	defaultFence.mu.Unlock()
	if hook != nil {
		hook(bToken)
	}

	if err != nil || !IsActiveTokenUser(info) {
		EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
		return models.User{}, false
	}

	defaultFence.mu.Lock()
	revokedNow := defaultFence.isRevokedLocked(bToken, time.Now())
	staleEpoch := defaultFence.globalEpoch != startGlobal || defaultFence.tokenEpoch[bToken] != startToken
	if !revokedNow && !staleEpoch {
		userTokenCache.SetDefault(info.Token, info)
		if cToken != "" {
			cUserTokenCache.SetDefault(cToken, bToken)
		}
		defaultFence.mu.Unlock()
		return info, true
	}
	// A concurrent revocation or invalidation occurred while our DB query was in flight.
	// Never backfill the pre-revocation snapshot into UserToken cache.
	userTokenCache.Delete(bToken)
	if revokedNow && cToken != "" {
		cUserTokenCache.Delete(cToken)
	}
	defaultFence.mu.Unlock()

	if revokedNow {
		return models.User{}, false
	}

	// Non-revoking invalidation (e.g., profile update): re-verify against DB without backfilling stale data.
	fresh, freshErr := loadFromDB(bToken)
	if freshErr != nil || !IsActiveTokenUser(fresh) {
		EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
		return models.User{}, false
	}
	return fresh, true
}

// FlushInstanceSessionNamespace clears only the current instance's UserToken and CUserToken caches
// and advances the global backfill fence epoch so in-flight lookups cannot repopulate stale sessions.
// Under the Redis driver, Cacher.Flush() deletes solely <redis.prefix>UserToken and <redis.prefix>CUserToken.
func FlushInstanceSessionNamespace(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
) error {
	defaultFence.mu.Lock()
	defaultFence.globalEpoch++
	defaultFence.mu.Unlock()

	var errs []error
	if userTokenCache != nil {
		if err := userTokenCache.Flush(); err != nil {
			errs = append(errs, fmt.Errorf("flush UserToken cache: %w", err))
		}
	}
	if cUserTokenCache != nil {
		if err := cUserTokenCache.Flush(); err != nil {
			errs = append(errs, fmt.Errorf("flush CUserToken cache: %w", err))
		}
	}
	if len(errs) > 0 {
		return errors.Join(errs...)
	}

	defaultFence.mu.Lock()
	defaultFence.globalEpoch++
	defaultFence.mu.Unlock()
	return nil
}

// EnsureLegacySessionRotation performs an idempotent, retryable one-time rotation of existing persistent bTokens
// and flushes only the current instance's session cache namespace.
// The completion marker is persisted ONLY AFTER both the DB token clear and all cache flushes succeed;
// if cache cleanup fails (including partially), rotation returns (false, err) so the next restart retries.
func EnsureLegacySessionRotation(
	db *gorm.DB,
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	skip bool,
) (rotated bool, err error) {
	if skip || db == nil {
		return false, nil
	}

	var marker models.SystemSetting
	findErr := db.Where("config_name = ?", LegacyBTokenRotationV1Key).First(&marker).Error
	if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
		return false, findErr
	}
	if findErr == nil && marker.ConfigValue == "1" {
		return false, nil
	}

	// Step 1: Clear persistent bTokens in DB (idempotent across retries).
	if err := db.Model(&models.User{}).
		Where("token <> '' AND token IS NOT NULL").
		Update("token", "").Error; err != nil {
		return false, err
	}

	// Step 2: Flush only this instance's session cache namespace and verify zero errors before marking complete.
	if err := FlushInstanceSessionNamespace(userTokenCache, cUserTokenCache); err != nil {
		return false, err
	}

	// Step 3: Persist completion marker ONLY after DB update and ALL cache flushes have succeeded.
	err = db.Transaction(func(tx *gorm.DB) error {
		var current models.SystemSetting
		txFindErr := tx.Where("config_name = ?", LegacyBTokenRotationV1Key).First(&current).Error
		if txFindErr != nil && !errors.Is(txFindErr, gorm.ErrRecordNotFound) {
			return txFindErr
		}
		if errors.Is(txFindErr, gorm.ErrRecordNotFound) {
			return tx.Create(&models.SystemSetting{
				ConfigName:  LegacyBTokenRotationV1Key,
				ConfigValue: "1",
			}).Error
		}
		return tx.Model(&models.SystemSetting{}).
			Where("id = ?", current.ID).
			Update("config_value", "1").Error
	})
	if err != nil {
		return false, err
	}
	return true, nil
}
