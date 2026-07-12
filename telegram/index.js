// ═══════════════════════════════════════════
// TELEGRAM BOT WRAPPER (bot.js)
// Exposes .initialize(client) for the main index.js
// ═══════════════════════════════════════════

const TelegramBridge = require('./bridge.js');
const pluginLoader = require('./index.js');

let bridgeInstance = null;

module.exports = {
    /**
     * Initializes the Telegram bot and attaches it to the Discord client.
     * @param {Object} client - The main Discord.js client from index.js
     */
    initialize: (client) => {
        console.log('[TELEGRAM] Initializing Bot Wrapper...');

        // 1. Create the bridge instance
        bridgeInstance = new TelegramBridge(client);
        bridgeInstance.enabled = true;

        // 2. Load all plugins from /plugins into the bridge
        pluginLoader(bridgeInstance);

        // 3. Attach to client for global access (optional, used by your status checks)
        client.telegramBridge = bridgeInstance;
        client.telegramCommandCount = bridgeInstance.commands?.size || 0;

        console.log(`[TELEGRAM] Bot engine started! Loaded ${client.telegramCommandCount} commands.`);
        
        return bridgeInstance;
    }
};
