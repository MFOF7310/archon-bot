// ═══════════════════════════════════════════
//  ARCHON CG-223 — TELEGRAM ENTRY POINT
//  Located at: telegram/telegram.js
//  Loaded by root telegram.js via: require('./telegram/telegram')
// ═══════════════════════════════════════════

console.log('[TELEGRAM] Loading telegram/telegram.js...');

var bridge, bot;

try {
    bridge = require('./bridge');
    console.log('[TELEGRAM] bridge.js loaded OK');
} catch (e) {
    console.error('[TELEGRAM] FAILED to load bridge.js:', e.message);
    throw e;
}

try {
    bot = require('./bot');
    console.log('[TELEGRAM] bot.js loaded OK');
} catch (e) {
    console.error('[TELEGRAM] FAILED to load bot.js:', e.message);
    throw e;
}

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

let _initialized = false;
let _bridge = null;

module.exports = {
    async initialize(client) {
        if (_initialized) {
            console.log(yellow + '[TELEGRAM]' + reset + ' Already initialized');
            return _bridge;
        }

        console.log(cyan + '[TELEGRAM]' + reset + ' ════════════════════════════════════════');
        console.log(cyan + '[TELEGRAM]' + reset + '  ARCHON CG-223 TELEGRAM BRIDGE v3.0');
        console.log(cyan + '[TELEGRAM]' + reset + '  by @mfof7310');
        console.log(cyan + '[TELEGRAM]' + reset + ' ════════════════════════════════════════');

        try {
            // Step 1: Create bridge
            console.log('[TELEGRAM] Step 1: Initialize bridge...');
            _bridge = bridge.initialize(client);
            console.log(`[TELEGRAM] Bridge created. Commands: ${_bridge.commands.size}`);

            // Step 2: Activate
            console.log('[TELEGRAM] Step 2: Activate bridge...');
            const act = _bridge.activate();
            console.log(`[TELEGRAM] Bridge activated: ${act.success}`);

            // Step 3: Init bot engine (loads plugins + starts polling)
            console.log('[TELEGRAM] Step 3: Initialize bot engine...');
            if (bot && typeof bot.initialize === 'function') {
                await bot.initialize(client);
                console.log(`[TELEGRAM] Bot engine init done. Commands: ${_bridge.commands.size}`);
            } else {
                console.error(red + '[TELEGRAM]' + reset + ' bot.initialize is not a function!');
                console.error('[TELEGRAM] bot exports:', Object.keys(bot || {}));
            }

            _initialized = true;
            // Sync Telegram command count to client for Discord dashboard display
            client.telegramCommands = _bridge.commands;
            client.telegramAliases = _bridge.aliases;
            client.telegramCommandCount = _bridge.commands.size;
            console.log(green + '[TELEGRAM]' + reset + ` System ready! Commands: ${_bridge.commands.size}`);

        } catch (err) {
            console.error(red + '[TELEGRAM]' + reset + ' Init error:', err.message);
            console.error(red + '[TELEGRAM]' + reset + ' Stack:', err.stack);
        }

        return _bridge;
    },

    getBridge() { return _bridge; },
    isInitialized() { return _initialized; },
    status() {
        return {
            initialized: _initialized,
            bridge: _bridge ? _bridge.status() : null,
            info: _bridge ? _bridge.info() : null,
        };
    }
};
