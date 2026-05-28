// db/premium.js — Archon Premium State Layer (Production Hardened)
// ============================================================
// ENVIRONMENT VALIDATION
// ============================================================

// Safely load dotenv — silently skip if not installed (e.g., in production with system-level env vars)
try {
    require('dotenv').config();
} catch (e) {
    // dotenv is a dev convenience; production uses real environment variables
}

// Critical variable check — fires once at module load
const REQUIRED_ENV_VARS = ['DB_PATH'];
const MISSING_VARS = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

if (MISSING_VARS.length > 0) {
    console.warn(
        `[PREMIUM DB] ⚠️ Missing environment variables: ${MISSING_VARS.join(', ')}. ` +
        `Using safe defaults. Set these in your .env file or system environment for production stability.`
    );
}

// ============================================================
// DATABASE PATH RESOLUTION
// ============================================================
const path = require('path');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'database.sqlite');

console.log(`[PREMIUM DB] 📁 Resolved database path: ${DB_PATH}`);

// ============================================================
// HELPER FACTORY
// Requires a better-sqlite3 database instance to be injected
// ============================================================
module.exports = (db) => {
    if (!db) {
        throw new Error(
            '[PREMIUM DB] ❌ FATAL: No database instance provided to premium helpers. ' +
            'Call require(\'./db/premium\')(yourDbInstance).'
        );
    }

    // Verify the premium table exists; create if missing
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS user_premium (
                user_id TEXT PRIMARY KEY,
                premium_active INTEGER NOT NULL DEFAULT 0,
                premium_since INTEGER,
                premium_expires INTEGER,
                tier TEXT DEFAULT 'premium_tier_1',
                cancelled_at INTEGER,
                created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
            )
        `);

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_premium_active
            ON user_premium(premium_active)
        `);

        console.log('[PREMIUM DB] ✅ user_premium table verified/created.');
    } catch (err) {
        console.error('[PREMIUM DB] ❌ Failed to initialize user_premium table:', err.message);
        throw err; // Fatal — premium features cannot function without this table
    }

    // ============================================================
    // COMPILED PREPARED STATEMENTS (cached for performance)
    // ============================================================
    let stmtCheckPremium, stmtGrantPremium, stmtRevokePremium, stmtExtendPremium;

    try {
        stmtCheckPremium = db.prepare(
            'SELECT premium_active FROM user_premium WHERE user_id = ?'
        );

        stmtGrantPremium = db.prepare(`
            INSERT INTO user_premium (user_id, premium_active, premium_since, premium_expires, tier, updated_at)
            VALUES (?, 1, ?, ?, ?, ?)
            ON CONFLICT(user_id) DO UPDATE SET
                premium_active = 1,
                premium_since = COALESCE(user_premium.premium_since, ?),
                premium_expires = ?,
                tier = ?,
                cancelled_at = NULL,
                updated_at = ?
        `);

        stmtRevokePremium = db.prepare(`
            UPDATE user_premium
            SET premium_active = 0, cancelled_at = ?, updated_at = ?
            WHERE user_id = ?
        `);

        stmtExtendPremium = db.prepare(`
            UPDATE user_premium
            SET premium_active = 1, premium_expires = ?, updated_at = ?
            WHERE user_id = ?
        `);

        console.log('[PREMIUM DB] ✅ All prepared statements compiled.');
    } catch (err) {
        console.error('[PREMIUM DB] ❌ Failed to compile prepared statements:', err.message);
        throw err;
    }

    // ============================================================
    // PUBLIC API
    // ============================================================
    return {
        /**
         * Check if a user has active premium (global, not per-server).
         * Returns boolean. Logs and returns false on any error.
         */
        isPremium(userId) {
            try {
                const row = stmtCheckPremium.get(userId);
                return row ? row.premium_active === 1 : false;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ isPremium check failed for ${userId}:`, err.message);
                return false; // Fail safe — deny premium on error
            }
        },

        /**
         * Grant premium to a user. Called from webhook.js on payment.succeeded.
         * @param {string} userId - Discord user ID
         * @param {string} tier - Premium tier identifier
         * @param {number|null} durationDays - Subscription length in days, null for lifetime
         * @returns {object} better-sqlite3 run result
         */
        grantPremium(userId, tier = 'premium_tier_1', durationDays = null) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const expires = durationDays ? now + (durationDays * 86400) : null;

                const result = stmtGrantPremium.run(
                    userId, now, expires, tier, now,  // INSERT values
                    now, expires, tier, now            // ON CONFLICT UPDATE values
                );

                console.log(
                    `[PREMIUM DB] ✅ Premium granted to ${userId} | Tier: ${tier} | ` +
                    `Expires: ${expires ? new Date(expires * 1000).toISOString() : 'Lifetime'}`
                );

                return result;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ grantPremium failed for ${userId}:`, err.message);
                throw err; // Re-throw so webhook handler can respond with 500
            }
        },

        /**
         * Revoke premium from a user. Called on subscription.cancelled.
         * @param {string} userId - Discord user ID
         * @returns {object} better-sqlite3 run result
         */
        revokePremium(userId) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const result = stmtRevokePremium.run(now, now, userId);

                console.log(`[PREMIUM DB] 🔻 Premium revoked for ${userId} | Changes: ${result.changes}`);

                return result;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ revokePremium failed for ${userId}:`, err.message);
                throw err;
            }
        },

        /**
         * Extend premium expiry. Called on subscription.renewed.
         * @param {string} userId - Discord user ID
         * @param {number} newExpiryTimestamp - Unix timestamp (seconds) for new expiry
         * @returns {object} better-sqlite3 run result
         */
        extendPremium(userId, newExpiryTimestamp) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const result = stmtExtendPremium.run(newExpiryTimestamp, now, userId);

                console.log(
                    `[PREMIUM DB] 🔄 Premium extended for ${userId} | ` +
                    `New expiry: ${new Date(newExpiryTimestamp * 1000).toISOString()} | Changes: ${result.changes}`
                );

                return result;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ extendPremium failed for ${userId}:`, err.message);
                throw err;
            }
        },

        /**
         * Get full premium details for a user.
         * @param {string} userId - Discord user ID
         * @returns {object|null} Premium row or null
         */
        getPremiumDetails(userId) {
            try {
                const row = db.prepare(
                    'SELECT * FROM user_premium WHERE user_id = ?'
                ).get(userId);
                return row || null;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ getPremiumDetails failed for ${userId}:`, err.message);
                return null;
            }
        }
    };
};
