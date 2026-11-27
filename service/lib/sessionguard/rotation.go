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

	revokedTokenFenceTTL   = 10 * time.Minute
	maxRevokedFenceSize    = 10000
	revokedTombstoneStatus = -1
)

// TokenResolveStatus distinguishes an active session, an explicitly invalid/revoked credential,
// and a transient dependency error (which must never poison or revoke the credential).
type TokenResolveStatus int

const (
	TokenResolveActive TokenResolveStatus = iota
	TokenResolveInvalid
	TokenResolveTransientError
)

// TokenGuard encapsulates per-process backfill fencing state while coordinating cross-process
// revocation via shared-cache tombstones and atomic SetIfAbsent (Redis HSETNX / go-cache Add).
type TokenGuard struct {
	mu            sync.Mutex
	globalEpoch   uint64
	tokenEpoch    map[string]uint64
	revokedAt     map[string]time.Time
	afterDBLookup func(bToken string)
}

// NewTokenGuard constructs an isolated TokenGuard instance (useful for modeling independent processes in tests).
func NewTokenGuard() *TokenGuard {
	return &TokenGuard{
		tokenEpoch: make(map[string]uint64),
		revokedAt:  make(map[string]time.Time),
	}
}

var defaultGuard = NewTokenGuard()

func revokedTombstoneUser() models.User {
	return models.User{Status: revokedTombstoneStatus}
}

// IsRevokedTombstone reports whether a cached User record is an explicit cross-process revocation tombstone.
func IsRevokedTombstone(u models.User) bool {
	return u.ID == 0 && u.Status == revokedTombstoneStatus
}

// IsActiveUser verifies that a cached or database-loaded user record is valid and enabled.
func IsActiveUser(u models.User) bool {
	return u.ID != 0 && u.Status == 1
}

// IsActiveTokenUser verifies that a token-authenticated user record has a non-empty token and Status == 1.
func IsActiveTokenUser(u models.User) bool {
	return u.ID != 0 && u.Token != "" && u.Status == 1
}

// SetAfterDBLookupHookForTest registers a synchronization hook on this guard invoked right after
// a DB token lookup completes and before fenced cache backfill. Returns a restore func.
func (g *TokenGuard) SetAfterDBLookupHookForTest(hook func(bToken string)) func() {
	g.mu.Lock()
	prev := g.afterDBLookup
	g.afterDBLookup = hook
	g.mu.Unlock()
	return func() {
		g.mu.Lock()
		g.afterDBLookup = prev
		g.mu.Unlock()
	}
}

// SetAfterDBLookupHookForTest registers the test synchronization hook on the default process guard.
func SetAfterDBLookupHookForTest(hook func(bToken string)) func() {
	return defaultGuard.SetAfterDBLookupHookForTest(hook)
}

func (g *TokenGuard) pruneLocked(now time.Time) {
	if len(g.revokedAt) == 0 {
		return
	}
	for tok, ts := range g.revokedAt {
		if now.Sub(ts) > revokedTokenFenceTTL {
			delete(g.revokedAt, tok)
			delete(g.tokenEpoch, tok)
		}
	}
	if len(g.revokedAt) > maxRevokedFenceSize {
		g.globalEpoch++
		g.revokedAt = make(map[string]time.Time)
		g.tokenEpoch = make(map[string]uint64)
	}
}

func (g *TokenGuard) isRevokedLocked(bToken string, now time.Time) bool {
	ts, ok := g.revokedAt[bToken]
	if !ok {
		return false
	}
	if now.Sub(ts) > revokedTokenFenceTTL {
		delete(g.revokedAt, bToken)
		delete(g.tokenEpoch, bToken)
		return false
	}
	return true
}

func (g *TokenGuard) markRevokedLocalLocked(bToken string, now time.Time) {
	if bToken == "" {
		return
	}
	g.pruneLocked(now)
	g.tokenEpoch[bToken]++
	g.revokedAt[bToken] = now
}

// IsTokenRevoked reports whether bToken is marked revoked in the local guard (and for in-process cache, its tombstone).
func (g *TokenGuard) IsTokenRevoked(userTokenCache cache.Cacher[models.User], bToken string) bool {
	if bToken == "" {
		return false
	}
	g.mu.Lock()
	localRevoked := g.isRevokedLocked(bToken, time.Now())
	g.mu.Unlock()
	if localRevoked {
		return true
	}
	if userTokenCache != nil && !userTokenCache.IsShared() {
		if cached, hit := userTokenCache.Get(bToken); hit && IsRevokedTombstone(cached) {
			return true
		}
	}
	return false
}

// IsTokenRevoked checks revocation status using the default process guard.
func IsTokenRevoked(userTokenCache cache.Cacher[models.User], bToken string) bool {
	return defaultGuard.IsTokenRevoked(userTokenCache, bToken)
}

// RevokeToken fences a revoked persistent bToken locally.
//   - For in-process caches (GoCache), writes an in-memory revocation tombstone under lock.
//   - For shared caches (Redis), performs best-effort Delete cleanup; cross-process correctness
//     is guaranteed by authoritative DB verification on shared-cache resolution rather than Redis write success.
func (g *TokenGuard) RevokeToken(userTokenCache cache.Cacher[models.User], bToken string) {
	if bToken == "" {
		return
	}
	now := time.Now()
	g.mu.Lock()
	g.markRevokedLocalLocked(bToken, now)
	if userTokenCache != nil {
		if userTokenCache.IsShared() {
			userTokenCache.Delete(bToken)
		} else {
			userTokenCache.Set(bToken, revokedTombstoneUser(), revokedTokenFenceTTL)
		}
	}
	g.mu.Unlock()
}

// RevokeToken revokes bToken on the default process guard.
func RevokeToken(userTokenCache cache.Cacher[models.User], bToken string) {
	defaultGuard.RevokeToken(userTokenCache, bToken)
}

// InvalidateTokenCache clears a cached user profile (e.g. nickname/avatar change) without writing
// a revocation record, preventing concurrent stale writes while keeping the session active.
func (g *TokenGuard) InvalidateTokenCache(userTokenCache cache.Cacher[models.User], bToken string) {
	if bToken == "" {
		return
	}
	g.mu.Lock()
	g.tokenEpoch[bToken]++
	if userTokenCache != nil {
		userTokenCache.Delete(bToken)
	}
	g.mu.Unlock()
}

// InvalidateTokenCache invalidates a cached profile on the default process guard without revoking the session.
func InvalidateTokenCache(userTokenCache cache.Cacher[models.User], bToken string) {
	defaultGuard.InvalidateTokenCache(userTokenCache, bToken)
}

// EvictUserToken revokes a single persistent bToken.
func EvictUserToken(userTokenCache cache.Cacher[models.User], bToken string) {
	defaultGuard.RevokeToken(userTokenCache, bToken)
}

// EvictSessionMapping records revocation for bToken and deletes the cToken mapping.
// Must ONLY be called when credential invalidity/revocation is confirmed — never on transient errors.
func (g *TokenGuard) EvictSessionMapping(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
) {
	now := time.Now()
	g.mu.Lock()
	if bToken != "" {
		g.markRevokedLocalLocked(bToken, now)
		if userTokenCache != nil {
			if userTokenCache.IsShared() {
				userTokenCache.Delete(bToken)
			} else {
				userTokenCache.Set(bToken, revokedTombstoneUser(), revokedTokenFenceTTL)
			}
		}
	}
	if cUserTokenCache != nil && cToken != "" {
		cUserTokenCache.Delete(cToken)
	}
	g.mu.Unlock()
}

// EvictSessionMapping revokes bToken and removes cToken on the default process guard.
func EvictSessionMapping(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
) {
	defaultGuard.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
}

// ResolveTokenUser resolves bToken into an active models.User.
//   - When userTokenCache is a shared multi-process cache (Redis), authorization ALWAYS reads the
//     authoritative persistent database and NEVER trusts or backfills UserToken cache entries, so
//     Redis write failures, stale hot entries, late backfills, or concurrent expiration cleanups
//     cannot resurrect a revoked session across processes.
//   - When userTokenCache is an in-process cache (GoCache), fenced atomic backfill (SetIfAbsent +
//     in-memory tombstone under mutex) prevents concurrent late backfill after revocation.
//   - Transient DB errors always return TokenResolveTransientError without revoking or deleting cToken.
func (g *TokenGuard) ResolveTokenUser(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
	loadFromDB func(string) (models.User, error),
) (models.User, TokenResolveStatus, error) {
	if bToken == "" || userTokenCache == nil || cUserTokenCache == nil || loadFromDB == nil {
		return models.User{}, TokenResolveInvalid, nil
	}

	// Shared cross-process cache path (Redis): strictly authoritative DB verification.
	// Never trust cached UserToken entries and never backfill UserToken in shared Redis.
	if userTokenCache.IsShared() {
		info, err := loadFromDB(bToken)

		g.mu.Lock()
		hook := g.afterDBLookup
		g.mu.Unlock()
		if hook != nil {
			hook(bToken)
		}

		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
				return models.User{}, TokenResolveInvalid, nil
			}
			return models.User{}, TokenResolveTransientError, err
		}
		if !IsActiveTokenUser(info) {
			g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
			return models.User{}, TokenResolveInvalid, nil
		}

		// Guard against same-process revocation that occurred while loadFromDB was in flight.
		g.mu.Lock()
		revokedLocally := g.isRevokedLocked(bToken, time.Now())
		g.mu.Unlock()
		if revokedLocally {
			if cToken != "" {
				cUserTokenCache.Delete(cToken)
			}
			return models.User{}, TokenResolveInvalid, nil
		}
		return info, TokenResolveActive, nil
	}

	now := time.Now()
	g.mu.Lock()
	if g.isRevokedLocked(bToken, now) {
		if cToken != "" {
			cUserTokenCache.Delete(cToken)
		}
		g.mu.Unlock()
		return models.User{}, TokenResolveInvalid, nil
	}
	startGlobal := g.globalEpoch
	startToken := g.tokenEpoch[bToken]
	g.mu.Unlock()

	if cached, hit := userTokenCache.Get(bToken); hit {
		if IsRevokedTombstone(cached) || !IsActiveTokenUser(cached) {
			g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
			return models.User{}, TokenResolveInvalid, nil
		}
		g.mu.Lock()
		localRevoked := g.isRevokedLocked(bToken, time.Now())
		g.mu.Unlock()
		if localRevoked {
			if cToken != "" {
				cUserTokenCache.Delete(cToken)
			}
			return models.User{}, TokenResolveInvalid, nil
		}
		return cached, TokenResolveActive, nil
	}

	info, err := loadFromDB(bToken)

	g.mu.Lock()
	hook := g.afterDBLookup
	g.mu.Unlock()
	if hook != nil {
		hook(bToken)
	}

	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
			return models.User{}, TokenResolveInvalid, nil
		}
		// Transient dependency error (e.g. DB timeout/disconnect): fail closed for this request
		// WITHOUT recording revocation or deleting cToken so the session recovers once DB is healthy.
		return models.User{}, TokenResolveTransientError, err
	}
	if !IsActiveTokenUser(info) {
		g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
		return models.User{}, TokenResolveInvalid, nil
	}

	// Attempt fenced atomic cache backfill for in-process cache.
	g.mu.Lock()
	revokedNow := g.isRevokedLocked(bToken, time.Now())
	staleEpoch := g.globalEpoch != startGlobal || g.tokenEpoch[bToken] != startToken
	if revokedNow {
		if cToken != "" {
			cUserTokenCache.Delete(cToken)
		}
		g.mu.Unlock()
		return models.User{}, TokenResolveInvalid, nil
	}
	if !staleEpoch {
		inserted, setErr := userTokenCache.SetIfAbsent(info.Token, info, 0)
		if setErr != nil {
			g.mu.Unlock()
			return models.User{}, TokenResolveTransientError, setErr
		}
		if inserted {
			if cToken != "" {
				cUserTokenCache.SetDefault(cToken, bToken)
			}
			g.mu.Unlock()
			return info, TokenResolveActive, nil
		}
		existing, hit := userTokenCache.Get(bToken)
		if hit {
			if IsRevokedTombstone(existing) || !IsActiveTokenUser(existing) {
				g.markRevokedLocalLocked(bToken, time.Now())
				if cToken != "" {
					cUserTokenCache.Delete(cToken)
				}
				g.mu.Unlock()
				return models.User{}, TokenResolveInvalid, nil
			}
			if cToken != "" {
				cUserTokenCache.SetDefault(cToken, bToken)
			}
			g.mu.Unlock()
			return existing, TokenResolveActive, nil
		}
	}
	g.mu.Unlock()

	fresh, freshErr := loadFromDB(bToken)
	if freshErr != nil {
		if errors.Is(freshErr, gorm.ErrRecordNotFound) {
			g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
			return models.User{}, TokenResolveInvalid, nil
		}
		return models.User{}, TokenResolveTransientError, freshErr
	}
	if !IsActiveTokenUser(fresh) {
		g.EvictSessionMapping(userTokenCache, cUserTokenCache, cToken, bToken)
		return models.User{}, TokenResolveInvalid, nil
	}
	if g.IsTokenRevoked(userTokenCache, bToken) {
		if cToken != "" {
			cUserTokenCache.Delete(cToken)
		}
		return models.User{}, TokenResolveInvalid, nil
	}
	return fresh, TokenResolveActive, nil
}

// ResolveTokenUser resolves bToken using the default process guard.
func ResolveTokenUser(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
	loadFromDB func(string) (models.User, error),
) (models.User, TokenResolveStatus, error) {
	return defaultGuard.ResolveTokenUser(userTokenCache, cUserTokenCache, cToken, bToken, loadFromDB)
}

// FlushInstanceSessionNamespace clears only the current instance's UserToken and CUserToken caches
// and advances the global backfill fence epoch so in-flight lookups cannot repopulate stale sessions.
// Under the Redis driver, Cacher.Flush() deletes solely <redis.prefix>UserToken and <redis.prefix>CUserToken.
func FlushInstanceSessionNamespace(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
) error {
	defaultGuard.mu.Lock()
	defaultGuard.globalEpoch++
	defaultGuard.mu.Unlock()

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

	defaultGuard.mu.Lock()
	defaultGuard.globalEpoch++
	defaultGuard.mu.Unlock()
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
