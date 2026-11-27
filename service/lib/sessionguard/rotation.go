package sessionguard

import (
	"errors"
	"leon-panel/lib/cache"
	"leon-panel/models"

	"gorm.io/gorm"
)

const (
	// LegacyBTokenRotationV1Key records in system_setting that pre-PR-1A persistent bTokens
	// have been rotated once for this database.
	LegacyBTokenRotationV1Key = "auth_btoken_rotation_v1"

	// ConfigDisableStartupSessionRotation allows operators to disable automatic startup rotation
	// while keeping DTO field filtering, bookmark ownership checks, and log redaction active.
	ConfigDisableStartupSessionRotation = "disable_startup_session_rotation"
)

// IsActiveUser verifies that a cached or database-loaded user record is valid and enabled.
func IsActiveUser(u models.User) bool {
	return u.ID != 0 && u.Status == 1
}

// IsActiveTokenUser verifies that a token-authenticated user record has a non-empty token and Status == 1.
func IsActiveTokenUser(u models.User) bool {
	return u.ID != 0 && u.Token != "" && u.Status == 1
}

// EvictUserToken removes a single persistent bToken entry from the hot UserToken cache.
func EvictUserToken(userTokenCache cache.Cacher[models.User], bToken string) {
	if userTokenCache == nil || bToken == "" {
		return
	}
	userTokenCache.Delete(bToken)
}

// EvictSessionMapping removes both the client cToken mapping and persistent bToken cache entry.
func EvictSessionMapping(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	cToken string,
	bToken string,
) {
	if userTokenCache != nil && bToken != "" {
		userTokenCache.Delete(bToken)
	}
	if cUserTokenCache != nil && cToken != "" {
		cUserTokenCache.Delete(cToken)
	}
}

// FlushInstanceSessionNamespace clears only the current instance's UserToken and CUserToken caches.
// Under the Redis driver, Cacher.Flush() deletes solely <redis.prefix>UserToken and <redis.prefix>CUserToken.
func FlushInstanceSessionNamespace(
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
) {
	if userTokenCache != nil {
		userTokenCache.Flush()
	}
	if cUserTokenCache != nil {
		cUserTokenCache.Flush()
	}
}

// EnsureLegacySessionRotation performs an idempotent one-time rotation of existing persistent bTokens
// and flushes only the current instance's session cache namespace.
// Once recorded under LegacyBTokenRotationV1Key, subsequent restarts are no-ops so newly issued sessions survive.
func EnsureLegacySessionRotation(
	db *gorm.DB,
	userTokenCache cache.Cacher[models.User],
	cUserTokenCache cache.Cacher[string],
	skip bool,
) (rotated bool, err error) {
	if skip || db == nil {
		return false, nil
	}

	err = db.Transaction(func(tx *gorm.DB) error {
		var marker models.SystemSetting
		findErr := tx.Where("config_name = ?", LegacyBTokenRotationV1Key).First(&marker).Error
		if findErr != nil && !errors.Is(findErr, gorm.ErrRecordNotFound) {
			return findErr
		}
		if findErr == nil && marker.ConfigValue == "1" {
			rotated = false
			return nil
		}

		if err := tx.Model(&models.User{}).
			Where("token <> '' AND token IS NOT NULL").
			Update("token", "").Error; err != nil {
			return err
		}

		if errors.Is(findErr, gorm.ErrRecordNotFound) {
			if err := tx.Create(&models.SystemSetting{
				ConfigName:  LegacyBTokenRotationV1Key,
				ConfigValue: "1",
			}).Error; err != nil {
				return err
			}
		} else {
			if err := tx.Model(&models.SystemSetting{}).
				Where("id = ?", marker.ID).
				Update("config_value", "1").Error; err != nil {
				return err
			}
		}

		rotated = true
		return nil
	})
	if err != nil {
		return false, err
	}

	if rotated {
		FlushInstanceSessionNamespace(userTokenCache, cUserTokenCache)
	}
	return rotated, nil
}
