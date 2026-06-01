// webhook.js — Archon Billing Gateway (Production v1.2.0)
// ============================================================
// FIXED: syntax error + payment.succeeded now GRANTS premium
// ============================================================

try {
    require('dotenv').config();
} catch (e) {}

const REQUIRED_VARS = ['DODO_WEBHOOK_SECRET'];
const MISSING_VARS = REQUIRED_VARS.filter(v => !process.env[v]);

if (MISSING_VARS.length > 0) {
    console.error(
        `[WEBHOOK] 🚨 FATAL: Missing critical environment variables: ${MISSING_VARS.join(', ')}.\n` +
        `The billing gateway cannot verify payment signatures without these.`
    );
}

const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DB_PATH = process.env.DB_PATH || './data/database.sqlite';
const DEDUP_TTL_SECONDS = parseInt(process.env.DEDUP_TTL_SECONDS, 10) || 3600;
const MAX_PAYLOAD_SIZE = process.env.MAX_PAYLOAD_SIZE || '64kb';
const WEBHOOK_RATE_LIMIT = parseInt(process.env.WEBHOOK_RATE_LIMIT, 10) || 100;
const WEBHOOK_RATE_WINDOW = parseInt(process.env.WEBHOOK_RATE_WINDOW, 10) || 60000;

console.log('[WEBHOOK] 📋 Configuration:');
console.log(`  → DB_PATH: ${DB_PATH}`);
console.log(`  → DEDUP_TTL_SECONDS: ${DEDUP_TTL_SECONDS}`);
console.log(`  → MAX_PAYLOAD_SIZE: ${MAX_PAYLOAD_SIZE}`);
console.log(`  → WEBHOOK_RATE_LIMIT: ${WEBHOOK_RATE_LIMIT}/${WEBHOOK_RATE_WINDOW}ms`);
console.log(`  → DODO_WEBHOOK_SECRET: ${DODO_WEBHOOK_SECRET ? '✅ Set' : '❌ MISSING'}`);

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// ============================================================
// DATABASE: Shared connection or self-initialize
// ============================================================
let db;
let premiumHelpers;

function initializeDatabase(sharedDb = null) {
    if (sharedDb) {
        db = sharedDb;
        console.log('[WEBHOOK] ✅ Using shared database connection (injected)');
    } else {
        const Database = require('better-sqlite3');
        const dataDir = path.dirname(DB_PATH);
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        db.pragma('synchronous = NORMAL');
        db.pragma('busy_timeout = 5000');
        console.log('[WEBHOOK] ✅ Self-initialized database connection (standalone mode)');
    }

    // Initialize schema
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_premium (
            user_id TEXT PRIMARY KEY,
            premium_active INTEGER DEFAULT 0,
            premium_since INTEGER,
            premium_expires INTEGER,
            tier TEXT DEFAULT 'premium_tier_1',
            cancelled_at INTEGER,
            updated_at INTEGER,
            notified INTEGER DEFAULT 0
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_dedup (
            event_id TEXT PRIMARY KEY,
            processed_at INTEGER NOT NULL,
            expires_at INTEGER NOT NULL
        )
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS webhook_delivery_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            user_id TEXT,
            status TEXT NOT NULL,
            status_code INTEGER,
            error_message TEXT,
            payload TEXT,
            processed_at INTEGER DEFAULT (strftime('%s', 'now'))
        )
    `);

    try {
        const premiumModule = require('./db/premium.js');
        premiumHelpers = premiumModule(db);
        console.log('[WEBHOOK] ✅ Premium helpers loaded from db/premium.js');
    } catch (err) {
        console.warn('[WEBHOOK] ⚠️ Could not load db/premium.js, using inline fallback:', err.message);
        premiumHelpers = createInlinePremiumHelpers(db);
    }

    return db;
}

function createInlinePremiumHelpers(db) {
    return {
        grantPremium(userId, tier = 'premium_tier_1', durationDays = 30) {
            const now = Math.floor(Date.now() / 1000);
            const expires = durationDays ? now + (durationDays * 86400) : null;
            const result = db.prepare(`
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
            `).run(userId, now, expires, tier, now, now, expires, tier, now);
            return result;
        },
        revokePremium(userId) {
            const now = Math.floor(Date.now() / 1000);
            return db.prepare(`
                UPDATE user_premium SET premium_active = 0, cancelled_at = ?, updated_at = ? WHERE user_id = ?
            `).run(now, now, userId);
        },
        extendPremium(userId, newExpiryTimestamp) {
            const now = Math.floor(Date.now() / 1000);
            return db.prepare(`
                UPDATE user_premium SET premium_active = 1, premium_expires = ?, updated_at = ? WHERE user_id = ?
            `).run(newExpiryTimestamp, now, userId);
        }
    };
}

// ============================================================
// RATE LIMITER
// ============================================================
const rateLimitStore = new Map();

function checkRateLimit(clientIp) {
    const now = Date.now();
    const windowStart = now - WEBHOOK_RATE_WINDOW;
    let requests = rateLimitStore.get(clientIp) || [];
    requests = requests.filter(timestamp => timestamp > windowStart);

    if (requests.length >= WEBHOOK_RATE_LIMIT) {
        const oldestRequest = Math.min(...requests);
        const retryAfter = Math.ceil((oldestRequest + WEBHOOK_RATE_WINDOW - now) / 1000);
        return { allowed: false, retryAfter: Math.max(1, retryAfter) };
    }

    requests.push(now);
    rateLimitStore.set(clientIp, requests);

    if (Math.random() < 0.01) {
        for (const [ip, timestamps] of rateLimitStore.entries()) {
            const recent = timestamps.filter(t => t > windowStart);
            if (recent.length === 0) rateLimitStore.delete(ip);
            else rateLimitStore.set(ip, recent);
        }
    }

    return { allowed: true, retryAfter: 0 };
}

function logDelivery(eventId, eventType, userId, status, statusCode, errorMessage = null, payload = null) {
    try {
        db.prepare(`
            INSERT INTO webhook_delivery_log 
            (event_id, event_type, user_id, status, status_code, error_message, payload)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(eventId, eventType, userId, status, statusCode, errorMessage, payload ? JSON.stringify(payload) : null);
    } catch (err) {
        console.error('[WEBHOOK] Failed to log delivery:', err.message);
    }
}

const dedup = {
    isDuplicate(eventId) {
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + DEDUP_TTL_SECONDS;
        try {
            db.prepare('INSERT INTO webhook_dedup (event_id, processed_at, expires_at) VALUES (?, ?, ?)').run(eventId, now, expiresAt);
            return false;
        } catch (e) {
            if (e.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') return true;
            throw e;
        }
    },
    clear(eventId) {
        try {
            db.prepare('DELETE FROM webhook_dedup WHERE event_id = ?').run(eventId);
        } catch (e) {
            console.error('[WEBHOOK] ⚠️ Failed to clear dedup entry:', e.message);
        }
    }
};

function verifySignature(rawBody, signature) {
    if (!DODO_WEBHOOK_SECRET) {
        console.error('[WEBHOOK] 🚨 Cannot verify: DODO_WEBHOOK_SECRET is not set.');
        return false;
    }
    if (!signature) {
        console.error('[WEBHOOK] 🚨 Missing signature header.');
        return false;
    }
    try {
        const hmac = crypto.createHmac('sha256', DODO_WEBHOOK_SECRET);
        const computed = hmac.update(rawBody).digest('hex');
        if (signature.length !== computed.length) return false;
        return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(computed, 'hex'));
    } catch (err) {
        console.error('[WEBHOOK] ❌ Signature verification error:', err.message);
        return false;
    }
}

// ============================================================
// EVENT HANDLERS (CORRECTED)
// ============================================================
const eventHandlers = {
    'payment.succeeded': async (data) => {
        console.log('[WEBHOOK] 🔍 Full payment.succeeded data:', JSON.stringify(data, null, 2));
        console.log('[WEBHOOK] 🔍 metadata:', JSON.stringify(data?.metadata, null, 2));

        const userId = data?.metadata?.discord_user_id;
        const tier = data?.metadata?.tier || 'premium_tier_1';

        if (!userId) {
            console.warn('[WEBHOOK] ⚠️ No discord_user_id in metadata.');
            return { success: false, reason: 'missing_user_id' };
        }

        console.log(`[WEBHOOK] ⚡ PREMIUM LIVE — User: ${userId} | Amount: ${data?.total_amount} ${data?.currency}`);

        const result = premiumHelpers.grantPremium(userId, tier, 30);

        try {
            db.prepare('UPDATE user_premium SET notified = 0 WHERE user_id = ?').run(userId);
        } catch (e) {}

        return { success: true, changes: result.changes };
    },

    'subscription.cancelled': async (data) => {
        const userId = data?.metadata?.discord_user_id;
        if (!userId) return { success: false, reason: 'missing_user_id' };

        console.log(`[WEBHOOK] 🔻 EXPIRED — Revoking premium for ${userId}`);
        const result = premiumHelpers.revokePremium(userId);
        return { success: true, changes: result.changes };
    },

    'subscription.renewed': async (data) => {
        const userId = data?.metadata?.discord_user_id;
        if (!userId) return { success: false, reason: 'missing_user_id' };

        console.log(`[WEBHOOK] 🔄 RENEWED — User ${userId}`);

        if (data?.next_billing_date) {
            const result = premiumHelpers.extendPremium(userId, data.next_billing_date);
            return { success: true, changes: result.changes };
        }

        const result = premiumHelpers.grantPremium(userId, data?.metadata?.tier || 'premium_tier_1', 30);
        return { success: true, changes: result.changes };
    },

    'subscription.updated': async (data) => {
        const userId = data?.metadata?.discord_user_id;
        const tier = data?.metadata?.tier;
        if (!userId) return { success: false, reason: 'missing_user_id' };

        console.log(`[WEBHOOK] 📝 UPDATED — User ${userId}, Tier: ${tier}`);
        const current = db.prepare('SELECT premium_active FROM user_premium WHERE user_id = ?').get(userId);

        if (current?.premium_active) {
            const result = premiumHelpers.grantPremium(userId, tier, 30);
            return { success: true, changes: result.changes };
        }
        return { success: false, reason: 'user_not_active' };
    }
};

// ============================================================
// EXPRESS ROUTER
// ============================================================
const router = express.Router();

router.use(express.json({
    limit: MAX_PAYLOAD_SIZE,
    verify: (req, res, buf) => { req.rawBody = buf.toString(); }
}));

router.post('/api/v1/billing/webhook', async (req, res) => {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const event = req.body;
    const eventId = event?.id || `${event?.type}_${event?.created_at || Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const eventType = event?.type || 'unknown';
    const userId = event?.data?.metadata?.discord_user_id || null;

    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
        logDelivery(eventId, eventType, userId, 'rate_limited', 429, `Retry after ${rateCheck.retryAfter}s`);
        return res.status(429).set('Retry-After', String(rateCheck.retryAfter)).json({ error: 'Rate limit exceeded', retry_after: rateCheck.retryAfter });
    }

    const signature = req.headers['x-dodo-signature'];
    if (!signature) {
        logDelivery(eventId, eventType, userId, 'missing_signature', 401);
        return res.status(401).json({ error: 'Missing signature header' });
    }

    if (!verifySignature(req.rawBody, signature)) {
        logDelivery(eventId, eventType, userId, 'invalid_signature', 403);
        return res.status(403).json({ error: 'Invalid signature' });
    }

    try {
        if (dedup.isDuplicate(eventId)) {
            logDelivery(eventId, eventType, userId, 'deduplicated', 200);
            return res.status(200).json({ received: true, deduplicated: true });
        }
    } catch (err) {
        logDelivery(eventId, eventType, userId, 'dedup_error', 500, err.message);
        return res.status(500).json({ error: 'Deduplication error' });
    }

    try {
        const handler = eventHandlers[eventType];
        if (!handler) {
            console.warn(`[WEBHOOK] ⚠️ Unhandled event type: ${eventType}`);
            logDelivery(eventId, eventType, userId, 'unhandled_type', 200);
            return res.status(200).json({ received: true, handled: false, note: 'Event type not handled' });
        }

        const result = await handler(event.data);

        if (result && result.success) {
            logDelivery(eventId, eventType, userId, 'success', 200, null, event.data);
            return res.status(200).json({ received: true, processed: true, changes: result.changes });
        } else {
            const reason = result?.reason || 'handler_rejected';
            logDelivery(eventId, eventType, userId, 'handler_rejected', 200, reason, event.data);
            return res.status(200).json({ received: true, processed: false, reason: reason });
        }
    } catch (err) {
        console.error('[WEBHOOK] 💥 Handler crash:', err.message);
        dedup.clear(eventId);
        logDelivery(eventId, eventType, userId, 'handler_crash', 500, err.message, event.data);
        return res.status(500).json({ error: 'Internal processing error', message: err.message });
    }
});

router.get('/api/v1/billing/health', (req, res) => {
    let dbStatus = 'disconnected';
    try {
        db.prepare('SELECT 1').get();
        dbStatus = 'connected';
    } catch (err) {
        dbStatus = 'error';
    }

    res.status(200).json({
        status: 'operational',
        version: '1.2.0',
        timestamp: Math.floor(Date.now() / 1000),
        config: {
            webhook_secret_configured: !!DODO_WEBHOOK_SECRET,
            rate_limit: `${WEBHOOK_RATE_LIMIT}/${WEBHOOK_RATE_WINDOW}ms`,
            dedup_ttl: DEDUP_TTL_SECONDS
        },
        database: { status: dbStatus, path: DB_PATH, shared_mode: !!db }
    });
});

router.get('/', (req, res) => {
    res.status(200).json({
        service: 'Archon Billing Gateway',
        status: 'operational',
        version: '1.2.0',
        endpoints: [
            'POST /api/v1/billing/webhook',
            'GET /api/v1/billing/health',
            'GET /health'
        ]
    });
});

function gracefulShutdown(signal) {
    console.log(`\n[WEBHOOK] 🛑 ${signal} received.`);
    process.exit(0);
}

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
    console.error('[WEBHOOK] 💥 Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('[WEBHOOK] 💥 Unhandled Rejection:', reason);
});

module.exports = router;
module.exports.initializeDatabase = initializeDatabase;
module.exports.getRouter = () => router;