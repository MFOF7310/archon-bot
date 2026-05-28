// webhook.js — Archon Billing Gateway v4 (Production Hardened)
// ============================================================
// ENVIRONMENT VALIDATION — Runs before anything else
// ============================================================

// Safely load dotenv — silently skip if not installed
try {
    require('dotenv').config();
} catch (e) {
    // dotenv is optional; production uses real environment variables
}

const REQUIRED_ENV_VARS = ['DODO_WEBHOOK_SECRET', 'DODO_API_KEY'];
const MISSING_VARS = REQUIRED_ENV_VARS.filter(v => !process.env[v]);

if (MISSING_VARS.length > 0) {
    console.error(
        `[WEBHOOK] 🚨 FATAL: Missing critical environment variables: ${MISSING_VARS.join(', ')}.\n` +
        `The billing gateway cannot verify payment signatures without these.\n` +
        `Set them in your .env file or system environment before starting this service.`
    );
    // Don't process.exit() here — let the developer see the error and fix it.
    // The server will still start but webhook verification will fail safely.
}

const MISSING_OPTIONAL = [];
if (!process.env.DB_PATH) MISSING_OPTIONAL.push('DB_PATH');
if (!process.env.WEBHOOK_PORT) MISSING_OPTIONAL.push('WEBHOOK_PORT');

if (MISSING_OPTIONAL.length > 0) {
    console.warn(
        `[WEBHOOK] ⚠️ Missing optional environment variables: ${MISSING_OPTIONAL.join(', ')}. ` +
        `Using safe defaults.`
    );
}

// ============================================================
// IMPORTS
// ============================================================
const express = require('express');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();

// ============================================================
// CONFIGURATION WITH FALLBACKS
// ============================================================
const DODO_WEBHOOK_SECRET = process.env.DODO_WEBHOOK_SECRET || '';
const DODO_API_KEY = process.env.DODO_API_KEY || '';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'database.sqlite');
const WEBHOOK_PORT = parseInt(process.env.WEBHOOK_PORT, 10) || 3000;
const DEDUP_TTL_SECONDS = parseInt(process.env.DEDUP_TTL_SECONDS, 10) || 3600;

console.log('[WEBHOOK] 📋 Configuration loaded:');
console.log(`  → DB_PATH: ${DB_PATH}`);
console.log(`  → WEBHOOK_PORT: ${WEBHOOK_PORT}`);
console.log(`  → DEDUP_TTL_SECONDS: ${DEDUP_TTL_SECONDS}`);
console.log(`  → DODO_WEBHOOK_SECRET: ${DODO_WEBHOOK_SECRET ? '✅ Set' : '❌ MISSING'}`);
console.log(`  → DODO_API_KEY: ${DODO_API_KEY ? '✅ Set' : '❌ MISSING'}`);

// ============================================================
// RAW BODY PARSING (required for signature verification)
// ============================================================
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf.toString();
    }
}));

// ============================================================
// DATABASE BRIDGE — Opens dedicated connection with PRAGMAs
// ============================================================
let db;
try {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('cache_size = -64000');
    db.pragma('temp_store = MEMORY');
    db.pragma('busy_timeout = 5000');
    console.log('[WEBHOOK] 🗄️ Database connection established.');
} catch (err) {
    console.error('[WEBHOOK] ❌ FATAL: Could not open database:', err.message);
    console.error(`[WEBHOOK] Path attempted: ${DB_PATH}`);
    process.exit(1); // Cannot function without database
}

// ============================================================
// PREMIUM HELPERS — Wired to this webhook's DB connection
// ============================================================
let premium;
try {
    premium = require('./db/premium')(db);
    console.log('[WEBHOOK] 🧩 Premium helpers initialized.');
} catch (err) {
    console.error('[WEBHOOK] ❌ FATAL: Could not initialize premium helpers:', err.message);
    process.exit(1);
}

// ============================================================
// DEDUPLICATION LAYER — Database-backed (survives restarts)
// ============================================================
const dedup = {
    _ensureTable() {
        try {
            db.exec(`
                CREATE TABLE IF NOT EXISTS webhook_dedup (
                    event_id TEXT PRIMARY KEY,
                    processed_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL
                )
            `);
            // Purge expired entries on startup
            const deleted = db.prepare(
                'DELETE FROM webhook_dedup WHERE expires_at < ?'
            ).run(Math.floor(Date.now() / 1000));
            if (deleted.changes > 0) {
                console.log(`[WEBHOOK] 🧹 Cleaned ${deleted.changes} expired dedup entries.`);
            }
            console.log('[WEBHOOK] 🛡️ Deduplication table verified.');
        } catch (err) {
            console.error('[WEBHOOK] ❌ Failed to initialize dedup table:', err.message);
            throw err;
        }
    },

    isDuplicate(eventId) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const expiresAt = now + DEDUP_TTL_SECONDS;

            db.prepare(
                'INSERT INTO webhook_dedup (event_id, processed_at, expires_at) VALUES (?, ?, ?)'
            ).run(eventId, now, expiresAt);

            return false; // Insert succeeded — not a duplicate
        } catch (err) {
            if (err.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
                return true; // Already processed
            }
            console.error('[WEBHOOK] ❌ Dedup check error:', err.message);
            throw err;
        }
    },

    clear(eventId) {
        try {
            db.prepare('DELETE FROM webhook_dedup WHERE event_id = ?').run(eventId);
        } catch (err) {
            console.error('[WEBHOOK] ⚠️ Failed to clear dedup entry:', err.message);
            // Non-fatal — entry will expire naturally via TTL
        }
    }
};

// Initialize dedup table
try {
    dedup._ensureTable();
} catch (err) {
    console.error('[WEBHOOK] ❌ FATAL: Dedup initialization failed:', err.message);
    process.exit(1);
}

// ============================================================
// EVENT HANDLER REGISTRY
// ============================================================
const eventHandlers = {
    'payment.succeeded': async (data) => {
        const userId = data.metadata?.discord_user_id;
        const tier = data.metadata?.tier || 'premium_tier_1';

        if (!userId) {
            console.warn('[WEBHOOK] ⚠️ payment.succeeded missing discord_user_id in metadata.');
            return;
        }

        console.log(
            `[WEBHOOK] ⚡ PREMIUM LIVE — User: ${userId} | ` +
            `Amount: ${data.total_amount} ${data.currency} | Tier: ${tier}`
        );

        premium.grantPremium(userId, tier);
    },

    'subscription.cancelled': async (data) => {
        const userId = data.metadata?.discord_user_id;
        if (!userId) {
            console.warn('[WEBHOOK] ⚠️ subscription.cancelled missing discord_user_id.');
            return;
        }

        console.log(`[WEBHOOK] 🔻 EXPIRED — Revoking premium for User ${userId}`);
        premium.revokePremium(userId);
    },

    'subscription.renewed': async (data) => {
        const userId = data.metadata?.discord_user_id;
        if (!userId) {
            console.warn('[WEBHOOK] ⚠️ subscription.renewed missing discord_user_id.');
            return;
        }

        console.log(
            `[WEBHOOK] 🔄 RENEWED — User ${userId} | Next billing: ` +
            `${data.next_billing_date ? new Date(data.next_billing_date * 1000).toISOString() : 'N/A'}`
        );

        if (data.next_billing_date) {
            premium.extendPremium(userId, data.next_billing_date);
        }
    }
};

// ============================================================
// SIGNATURE VERIFICATION HELPER
// ============================================================
function verifySignature(rawBody, signature) {
    // If webhook secret was never configured, reject all requests safely
    if (!DODO_WEBHOOK_SECRET) {
        console.error('[WEBHOOK] 🚨 Cannot verify signature: DODO_WEBHOOK_SECRET is not set.');
        return false;
    }

    try {
        const hmac = crypto.createHmac('sha256', DODO_WEBHOOK_SECRET);
        const computedSignature = hmac.update(rawBody).digest('hex');

        // Use timing-safe comparison to prevent timing attacks
        if (
            signature.length !== computedSignature.length ||
            !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))
        ) {
            return false;
        }

        return true;
    } catch (err) {
        console.error('[WEBHOOK] ❌ Signature verification threw an error:', err.message);
        return false;
    }
}

// ============================================================
// 🔐 WEBHOOK ENDPOINT
// ============================================================
app.post('/api/v1/billing/webhook', async (req, res) => {
    // 1. Validate signature header presence
    const signature = req.headers['x-dodo-signature'];
    if (!signature) {
        console.warn('[WEBHOOK] 🚫 Rejected: Missing x-dodo-signature header.');
        return res.status(401).json({ error: 'Missing signature header' });
    }

    // 2. Verify cryptographic signature
    if (!verifySignature(req.rawBody, signature)) {
        console.warn('[WEBHOOK] 🚫 Rejected: Signature verification failed.');
        return res.status(403).json({ error: 'Invalid signature' });
    }

    // 3. Parse event payload
    const event = req.body;
    const eventId = event.id || `${event.type}_${Date.now()}`;

    console.log(`[WEBHOOK] 📥 Received: ${event.type} | ID: ${eventId}`);

    // 4. Deduplication check
    try {
        if (dedup.isDuplicate(eventId)) {
            console.log(`[WEBHOOK] 📌 Duplicate event ${eventId} — acknowledged, not reprocessed.`);
            return res.status(200).json({ received: true, deduplicated: true });
        }
    } catch (err) {
        console.error('[WEBHOOK] ❌ Dedup check failed:', err.message);
        return res.status(500).json({ error: 'Internal deduplication error' });
    }

    // 5. Route to handler
    try {
        const handler = eventHandlers[event.type];

        if (handler) {
            await handler(event.data);
            console.log(`[WEBHOOK] ✅ Successfully processed: ${event.type}`);
        } else {
            console.log(`[WEBHOOK] ℹ️ Unhandled event type: ${event.type} — acknowledged for audit.`);
        }

        return res.status(200).json({ received: true });
    } catch (err) {
        console.error(`[WEBHOOK] 💥 Handler crash for ${event.type}:`, err.message);
        console.error('[WEBHOOK] Stack trace:', err.stack);

        // Clear dedup entry so Dodo can retry
        dedup.clear(eventId);

        return res.status(500).json({ error: 'Internal processing error' });
    }
});

// ============================================================
// 🩺 HEALTH CHECK ENDPOINT
// ============================================================
app.get('/api/v1/billing/health', (req, res) => {
    let dbStatus = 'unknown';
    try {
        dbStatus = db.open ? 'connected' : 'disconnected';
    } catch (e) {
        dbStatus = 'error';
    }

    res.status(200).json({
        status: 'operational',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        config: {
            db_path: DB_PATH,
            webhook_secret_configured: !!DODO_WEBHOOK_SECRET,
            api_key_configured: !!DODO_API_KEY
        },
        database: dbStatus
    });
});

// ============================================================
// 🚀 SERVER LAUNCH
// ============================================================
app.listen(WEBHOOK_PORT, () => {
    console.log(`[WEBHOOK] 🦅 Archon Billing Gateway live on port ${WEBHOOK_PORT}`);
    console.log(`[WEBHOOK] 🩺 Health check: http://localhost:${WEBHOOK_PORT}/api/v1/billing/health`);
    console.log(`[WEBHOOK] 📡 Webhook endpoint: http://localhost:${WEBHOOK_PORT}/api/v1/billing/webhook`);
});
