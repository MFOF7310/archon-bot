// db/premium.js — Archon Premium State Layer (Production Hardened v1.1)
// ============================================================
// FIXES in v1.1:
//   1. Added 'notified' column for DM notification tracking
//   2. Self-healing schema — adds missing columns automatically
//   3. Returns full row data for status checks
//   4. Better error messages for debugging
// ============================================================

try {
    require('dotenv').config();
} catch (e) {}

const path = require('path');

console.log(`[PREMIUM DB] 📁 Module loaded`);

// ============================================================
// HELPER FACTORY
// Requires a better-sqlite3 database instance to be injected
// ============================================================
module.exports = (db) => {
    if (!db) {
        throw new Error(
            '[PREMIUM DB] ❌ FATAL: No database instance provided to premium helpers. ' +
            'Call require("./db/premium")(yourDbInstance).'
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
                updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
                notified INTEGER DEFAULT 0
            )
        `);

        // Self-healing: Add missing columns if table exists but columns don't
        const columns = db.prepare("PRAGMA table_info(user_premium)").all().map(c => c.name);

        if (!columns.includes('notified')) {
            db.exec('ALTER TABLE user_premium ADD COLUMN notified INTEGER DEFAULT 0');
            console.log('[PREMIUM DB] ✅ Added missing column: notified');
        }
        if (!columns.includes('created_at')) {
            db.exec('ALTER TABLE user_premium ADD COLUMN created_at INTEGER NOT NULL DEFAULT (strftime("%s", "now"))');
            console.log('[PREMIUM DB] ✅ Added missing column: created_at');
        }
        if (!columns.includes('updated_at')) {
            db.exec('ALTER TABLE user_premium ADD COLUMN updated_at INTEGER NOT NULL DEFAULT (strftime("%s", "now"))');
            console.log('[PREMIUM DB] ✅ Added missing column: updated_at');
        }

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_user_premium_active
            ON user_premium(premium_active)
        `);

        console.log('[PREMIUM DB] ✅ user_premium table verified/created with all columns.');
    } catch (err) {
        console.error('[PREMIUM DB] ❌ Failed to initialize user_premium table:', err.message);
        throw err;
    }

    // ============================================================
    // COMPILED PREPARED STATEMENTS (cached for performance)
    // ============================================================
    let stmtCheckPremium, stmtGrantPremium, stmtRevokePremium, stmtExtendPremium, stmtGetDetails;

    try {
        stmtCheckPremium = db.prepare(
            'SELECT premium_active FROM user_premium WHERE user_id = ?'
        );

        stmtGetDetails = db.prepare(
            'SELECT * FROM user_premium WHERE user_id = ?'
        );

        stmtGrantPremium = db.prepare(`
            INSERT INTO user_premium (user_id, premium_active, premium_since, premium_expires, tier, updated_at, notified)
            VALUES (?, 1, ?, ?, ?, ?, 0)
            ON CONFLICT(user_id) DO UPDATE SET
                premium_active = 1,
                premium_since = COALESCE(user_premium.premium_since, ?),
                premium_expires = ?,
                tier = ?,
                cancelled_at = NULL,
                updated_at = ?,
                notified = 0
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
                return false;
            }
        },

        /**
         * Get full premium details for status display.
         */
        getPremiumDetails(userId) {
            try {
                const row = stmtGetDetails.get(userId);
                return row || null;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ getPremiumDetails failed for ${userId}:`, err.message);
                return null;
            }
        },

        /**
         * Grant premium to a user. Called from webhook.js on payment.succeeded.
         * @param {string} userId - Discord user ID
         * @param {string} tier - Premium tier identifier
         * @param {number|null} durationDays - Subscription length in days, null for lifetime
         * @returns {object} better-sqlite3 run result
         */
        grantPremium(userId, tier = 'premium_tier_1', durationDays = 30) {
            try {
                const now = Math.floor(Date.now() / 1000);
                const expires = durationDays ? now + (durationDays * 86400) : null;

                const result = stmtGrantPremium.run(
                    userId, now, expires, tier, now,  // INSERT values
                    now, expires, tier, now            // ON CONFLICT UPDATE values
                );

                console.log(
                    `[PREMIUM DB] ✅ Premium granted to ${userId} | Tier: ${tier} | ` +
                    `Expires: ${expires ? new Date(expires * 1000).toISOString() : 'Lifetime'} | ` +
                    `Changes: ${result.changes}`
                );

                return result;
            } catch (err) {
                console.error(`[PREMIUM DB] ❌ grantPremium failed for ${userId}:`, err.message);
                throw err;
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
        }
    };
};
