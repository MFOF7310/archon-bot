/*
// db/premium-db.js — Archon Premium State Layer (Fixed for SQLite)
module.exports = (db) => {
    if (!db) {
        throw new Error('[PREMIUM DB] ❌ No database instance provided');
    }

    // Create table WITHOUT function defaults (SQLite limitation)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_premium (
            user_id TEXT PRIMARY KEY,
            premium_active INTEGER NOT NULL DEFAULT 0,
            premium_since INTEGER,
            premium_expires INTEGER,
            tier TEXT DEFAULT 'premium_tier_1',
            cancelled_at INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            notified INTEGER DEFAULT 0
        )
    `);

    // Check and add missing columns
    const columns = db.prepare("PRAGMA table_info(user_premium)").all().map(c => c.name);

    if (!columns.includes('notified')) {
        db.exec('ALTER TABLE user_premium ADD COLUMN notified INTEGER DEFAULT 0');
        console.log('[PREMIUM DB] ✅ Added column: notified');
    }
    if (!columns.includes('created_at')) {
        db.exec('ALTER TABLE user_premium ADD COLUMN created_at INTEGER');
        console.log('[PREMIUM DB] ✅ Added column: created_at');
    }
    if (!columns.includes('updated_at')) {
        db.exec('ALTER TABLE user_premium ADD COLUMN updated_at INTEGER');
        console.log('[PREMIUM DB] ✅ Added column: updated_at');
    }

    // Create index
    db.exec(`CREATE INDEX IF NOT EXISTS idx_user_premium_active ON user_premium(premium_active)`);

    console.log('[PREMIUM DB] ✅ user_premium table verified');

    // Prepared statements
    const stmtGrantPremium = db.prepare(`
        INSERT INTO user_premium (user_id, premium_active, premium_since, premium_expires, tier, updated_at, created_at, notified)
        VALUES (?, 1, ?, ?, ?, ?, ?, 0)
        ON CONFLICT(user_id) DO UPDATE SET
            premium_active = 1,
            premium_since = COALESCE(user_premium.premium_since, ?),
            premium_expires = ?,
            tier = ?,
            cancelled_at = NULL,
            updated_at = ?,
            notified = 0
    `);

    const stmtRevokePremium = db.prepare(`
        UPDATE user_premium SET premium_active = 0, cancelled_at = ?, updated_at = ? WHERE user_id = ?
    `);

    const stmtExtendPremium = db.prepare(`
        UPDATE user_premium SET premium_active = 1, premium_expires = ?, updated_at = ? WHERE user_id = ?
    `);

    return {
        isPremium(userId) {
            try {
                const row = db.prepare('SELECT premium_active FROM user_premium WHERE user_id = ?').get(userId);
                return row ? row.premium_active === 1 : false;
            } catch (err) {
                return false;
            }
        },
        grantPremium(userId, tier = 'premium_tier_1', durationDays = 30) {
            const now = Math.floor(Date.now() / 1000);
            const expires = durationDays ? now + (durationDays * 86400) : null;
            const result = stmtGrantPremium.run(
                userId, now, expires, tier, now, now,
                now, expires, tier, now
            );
            console.log(`[PREMIUM DB] ✅ Premium granted to ${userId}`);
            return result;
        },
        revokePremium(userId) {
            const now = Math.floor(Date.now() / 1000);
            const result = stmtRevokePremium.run(now, now, userId);
            console.log(`[PREMIUM DB] 🔻 Premium revoked for ${userId}`);
            return result;
        },
        extendPremium(userId, newExpiryTimestamp) {
            const now = Math.floor(Date.now() / 1000);
            const result = stmtExtendPremium.run(newExpiryTimestamp, now, userId);
            console.log(`[PREMIUM DB] 🔄 Premium extended for ${userId}`);
            return result;
        }
    };
};
*/