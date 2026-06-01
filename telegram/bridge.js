// ═══════════════════════════════════════════
//  ARCHON CG-223 — TELEGRAM BRIDGE v3.0
//  Discord ↔ Telegram Bridge by @mfof7310
// ═══════════════════════════════════════════

const https = require('https');

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

class TelegramBridge {
    constructor(client) {
        console.log('[BRIDGE] Constructor called');
        this.client = client;
        client.telegramBridge = this;
        client._telegramCommands = 0;
        this.enabled = false;
        this.token = process.env.TELEGRAM_BOT_TOKEN || null;
        this.chatId = process.env.TELEGRAM_CHAT_ID || null;
        this.version = '3.0.0';
        console.log('[BRIDGE] Token:', this.token ? '✓ set (' + this.token.substring(0, 10) + '...)' : '✗ missing');
        console.log('[BRIDGE] Chat ID:', this.chatId ? '✓ set' : '✗ missing');

        // Command registry (Telegram-specific)
        this.commands = new Map();
        this.aliases = new Map();

        // Lydia AI state
        this.lydiaActiveChats = new Set();
        this.userSessions = new Map();
        this.conversations = new Map();

        // Stats
        this.stats = { messagesSent: 0, messagesReceived: 0, commandsUsed: 0, startedAt: Date.now() };

        // Bind methods
        this.send = this.send.bind(this);
        this.sendTo = this.sendTo.bind(this);
        this.activate = this.activate.bind(this);
        this.deactivate = this.deactivate.bind(this);
        this.status = this.status.bind(this);
        this.info = this.info.bind(this);
    }

    // ── Register a Telegram command ──
    registerCommand(name, handler, info = {}) {
        if (!handler || typeof handler !== 'function') {
            console.log(yellow + '[BRIDGE]' + reset + ' Skipping ' + name + ': no handler');
            return;
        }
        const cmdName = name.toLowerCase();
        this.commands.set(cmdName, {
            handler,
            name: cmdName,
            description: info.description || '',
            category: info.category || 'General',
            usage: info.usage || `/${cmdName}`,
            aliases: (info.aliases || []).map(a => a.toLowerCase()),
            ownerOnly: info.ownerOnly || false,
            adminOnly: info.adminOnly || false,
            cooldown: info.cooldown || 2000,
            hidden: info.hidden || false,
        });
        (info.aliases || []).forEach(alias => this.aliases.set(alias.toLowerCase(), cmdName));
    }

    // ── Get a command by name or alias ──
    getCommand(name) {
        const key = name.toLowerCase();
        const main = this.commands.get(key);
        if (main) return { name: key, ...main };
        const aliasTarget = this.aliases.get(key);
        if (aliasTarget) {
            const cmd = this.commands.get(aliasTarget);
            return cmd ? { name: aliasTarget, ...cmd } : null;
        }
        return null;
    }

    // ── Send message to default chat ──
    async send(content, options = {}) {
        if (!this.enabled && !options.force) return { success: false, error: 'Bridge disabled' };
        if (!this.token || !this.chatId) return { success: false, error: 'Missing credentials' };
        return this._sendToChat(this.chatId, content, options);
    }

    // ── Send message to specific chat ──
    async sendTo(chatId, content, options = {}) {
        if (!this.token) return { success: false, error: 'Missing token' };
        return this._sendToChat(chatId, content, options);
    }

    // ── Internal: HTTP send ──
    _sendToChat(chatId, content, options = {}) {
        return new Promise((resolve) => {
            // Build payload, including reply_markup from options.extra
            const payload = {
                chat_id: chatId,
                text: String(content).substring(0, 4096),
                parse_mode: options.parse_mode || undefined,
                disable_web_page_preview: options.noPreview || false,
                reply_to_message_id: options.reply_to || undefined,
            };

            // Support reply_markup from options.extra.reply_markup (used by buttons)
            const markup = options.extra?.reply_markup || options.reply_markup;
            if (markup) payload.reply_markup = markup;

            const body = JSON.stringify(payload);

            const req = https.request(
                `https://api.telegram.org/bot${this.token}/sendMessage`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
                    timeout: 15000,
                },
                (res) => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            if (json.ok) {
                                this.stats.messagesSent++;
                                resolve({ success: true, data: json.result });
                            } else {
                                resolve({ success: false, error: json.description });
                            }
                        } catch {
                            resolve({ success: false, error: 'Invalid response' });
                        }
                    });
                }
            );

            req.on('error', (err) => resolve({ success: false, error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ success: false, error: 'Timeout' }); });
            req.write(body);
            req.end();
        });
    }

    // ── Send chat action (typing, upload_photo, etc.) ──
    async sendAction(chatId, action = 'typing') {
        if (!this.token) return { success: false };
        return new Promise((resolve) => {
            const body = JSON.stringify({ chat_id: chatId, action });
            const req = https.request(
                `https://api.telegram.org/bot${this.token}/sendChatAction`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => { try { resolve({ success: JSON.parse(data).ok }); } catch { resolve({ success: false }); }});
                }
            );
            req.on('error', () => resolve({ success: false }));
            req.write(body);
            req.end();
        });
    }

    // ── Send photo ──
    async sendPhoto(chatId, photo, options = {}) {
        if (!this.token) return { success: false };
        return this._sendMedia(chatId, 'sendPhoto', { photo, caption: options.caption, parse_mode: options.parse_mode });
    }

    // ── Send video ──
    async sendVideo(chatId, video, options = {}) {
        if (!this.token) return { success: false };
        return this._sendMedia(chatId, 'sendVideo', { video, caption: options.caption, parse_mode: options.parse_mode, supports_streaming: true });
    }

    // ── Send document ──
    async sendDocument(chatId, document, options = {}) {
        if (!this.token) return { success: false };
        return this._sendMedia(chatId, 'sendDocument', { document, caption: options.caption, parse_mode: options.parse_mode });
    }

    // ── Delete message ──
    async deleteMessage(chatId, messageId) {
        if (!this.token) return { success: false };
        return new Promise((resolve) => {
            const body = JSON.stringify({ chat_id: chatId, message_id: messageId });
            const req = https.request(
                `https://api.telegram.org/bot${this.token}/deleteMessage`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => { try { resolve({ success: JSON.parse(data).ok }); } catch { resolve({ success: false }); }});
                }
            );
            req.on('error', () => resolve({ success: false }));
            req.write(body);
            req.end();
        });
    }

    // ── Edit message ──
    async editMessage(chatId, messageId, text, options = {}) {
        if (!this.token) return { success: false };
        return new Promise((resolve) => {
            const body = JSON.stringify({
                chat_id: chatId, message_id: messageId,
                text: String(text).substring(0, 4096),
                parse_mode: options.parse_mode || undefined,
            });
            const req = https.request(
                `https://api.telegram.org/bot${this.token}/editMessageText`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 10000 },
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => { try { resolve({ success: JSON.parse(data).ok, data: JSON.parse(data).result }); } catch { resolve({ success: false }); }});
                }
            );
            req.on('error', () => resolve({ success: false }));
            req.write(body);
            req.end();
        });
    }

    _sendMedia(chatId, method, params) {
        return new Promise((resolve) => {
            const body = JSON.stringify({ chat_id: chatId, ...params });
            const req = https.request(
                `https://api.telegram.org/bot${this.token}/${method}`,
                { method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 20000 },
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve({ success: json.ok, data: json.result, error: json.description });
                        } catch { resolve({ success: false }); }
                    });
                }
            );
            req.on('error', () => resolve({ success: false }));
            req.write(body);
            req.end();
        });
    }

    // ── Check if user is admin ──
    async isAdmin(chatId, userId) {
        if (!this.token) return false;
        return new Promise((resolve) => {
            const req = https.request(
                `https://api.telegram.org/bot${this.token}/getChatMember?chat_id=${chatId}&user_id=${userId}`,
                { method: 'GET', timeout: 10000 },
                (res) => {
                    let data = '';
                    res.on('data', c => data += c);
                    res.on('end', () => {
                        try {
                            const json = JSON.parse(data);
                            resolve(json.ok && ['creator', 'administrator'].includes(json.result?.status));
                        } catch { resolve(false); }
                    });
                }
            );
            req.on('error', () => resolve(false));
            req.end();
        });
    }

    // ── Control ──
    activate() {
        if (!this.token || !this.chatId) {
            console.log(`${yellow}[TELEGRAM]${reset} Missing credentials in .env`);
            return { success: false, error: 'Missing credentials' };
        }
        this.enabled = true;
        console.log(`${green}[TELEGRAM]${reset} Bridge v${this.version} ACTIVATED · BAMAKO_223 🇲🇱`);
        return { success: true };
    }

    deactivate() {
        this.enabled = false;
        console.log(`${yellow}[TELEGRAM]${reset} Bridge DEACTIVATED`);
        return { success: true };
    }

    status() {
        return {
            configured: !!(this.token && this.chatId),
            enabled: this.enabled,
            version: this.version,
        };
    }

    info() {
        return {
            ...this.status(),
            token: this.token ? '✅ configured' : '❌ missing',
            chatId: this.chatId || 'missing',
            tgCommands: this.commands.size,
            tgAliases: this.aliases.size,
            lydiaChats: this.lydiaActiveChats.size,
            sessions: this.userSessions.size,
        };
    }
}

module.exports = {
    initialize: (client) => {
        const bridge = new TelegramBridge(client);
        client.telegramBridge = bridge;
        return bridge;
    },
};
