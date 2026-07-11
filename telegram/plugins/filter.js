const fs = require('fs');

const DB_PATH = '/tmp/archon_filters.json';

function load() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function save(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); }

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

module.exports = {
    name: 'filter',
    aliases: ['gfilter', 'pfilter', 'stop', 'gstop', 'pstop', 'filters'],
    description: 'Set keyword auto-replies',
    category: 'Moderation',
    usage: '/filter <keyword> <response>',

    handler: async (ctx) => {
        const cmd = ctx.message?.text?.split(' ')[0]?.replace('/', '').replace('@' + (ctx.bridge?.botUsername || ''), '').toLowerCase() || 'filter';
        const db = load();
        const isAdmin = await ctx.isAdmin();
        const isOwner = ctx.isOwner();

        // LIST
        if (cmd === 'filters') {
            const keys = [`c:${ctx.chatId}`, `g:${ctx.chatId}`, `pm`];
            let msg = `🤖 <b>Active Filters</b>\n━━━━━━━━━━━━━━━━\n\n`;
            let found = false;
            for (const k of keys) {
                if (!db[k] || !Object.keys(db[k]).length) continue;
                const label = k.startsWith('g:') ? '🌐 Group-wide' : k.startsWith('c:') ? '💬 This chat' : '📩 Private';
                msg += `<b>${label}:</b>\n`;
                for (const [kw, val] of Object.entries(db[k])) {
                    msg += `• <code>${escapeHTML(kw)}</code> → ${escapeHTML(val.response.substring(0,50))}\n`;
                }
                msg += '\n';
                found = true;
            }
            if (!found) msg += 'No filters set yet.\n\nUse <code>/filter keyword response</code> to add one!';
            return ctx.replyHTML(msg);
        }

        // STOP / REMOVE
        if (cmd === 'stop' || cmd === 'gstop' || cmd === 'pstop') {
            if (!isAdmin && !isOwner) return ctx.replyHTML(`⛔ Only admins can remove filters.`);
            const keyword = ctx.args[0]?.toLowerCase();
            if (!keyword) return ctx.replyHTML(`💡 Usage: <code>/${cmd} &lt;keyword&gt;</code>`);
            const key = cmd === 'gstop' ? `g:${ctx.chatId}` : cmd === 'pstop' ? 'pm' : `c:${ctx.chatId}`;
            if (db[key]?.[keyword]) {
                delete db[key][keyword];
                save(db);
                return ctx.replyHTML(`✅ Filter <b>${escapeHTML(keyword)}</b> removed!`);
            }
            return ctx.replyHTML(`❌ No filter found for: <b>${escapeHTML(keyword)}</b>`);
        }

        // ADD
        if (!isAdmin && !isOwner) return ctx.replyHTML(`⛔ Only admins can add filters.`);

        const keyword = ctx.args[0]?.toLowerCase();
        const response = ctx.args.slice(1).join(' ');

        if (!keyword || !response) {
            return ctx.replyHTML(
                `🤖 <b>Auto-Reply Filter</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `<code>/filter &lt;keyword&gt; &lt;response&gt;</code> — This chat only\n` +
                `<code>/gfilter &lt;keyword&gt; &lt;response&gt;</code> — All groups\n` +
                `<code>/pfilter &lt;keyword&gt; &lt;response&gt;</code> — Private chats\n` +
                `<code>/stop &lt;keyword&gt;</code> — Remove filter\n` +
                `<code>/filters</code> — List all\n\n` +
                `💡 Example:\n<code>/filter website Check bamako-steel-dev.xyz!</code>\n\n` +
                `🦅 ARCHON CG-223`
            );
        }

        const key = cmd === 'gfilter' ? `g:${ctx.chatId}` : cmd === 'pfilter' ? 'pm' : `c:${ctx.chatId}`;
        if (!db[key]) db[key] = {};
        db[key][keyword] = { response, createdBy: ctx.username, createdAt: Date.now() };
        save(db);

        const scopeLabel = cmd === 'gfilter' ? 'all groups' : cmd === 'pfilter' ? 'private chats' : 'this chat only';
        await ctx.replyHTML(
            `✅ <b>Filter Added!</b>\n\n` +
            `🔑 Keyword: <code>${escapeHTML(keyword)}</code>\n` +
            `💬 Response: ${escapeHTML(response.substring(0, 80))}${response.length > 80 ? '...' : ''}\n` +
            `📍 Scope: ${scopeLabel}\n\n` +
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
        );
    },

    checkMessage: async (ctx) => {
        const db = load();
        const text = ctx.text?.toLowerCase();
        if (!text || text.startsWith('/')) return false;

        const keysToCheck = [
            `c:${ctx.chatId}`,
            ctx.isGroup ? `g:${ctx.chatId}` : null,
            !ctx.isGroup ? 'pm' : null,
        ].filter(Boolean);

        if (!global._tgArCooldowns) global._tgArCooldowns = new Map();

        for (const key of keysToCheck) {
            if (!db[key]) continue;
            for (const [keyword, val] of Object.entries(db[key])) {
                if (!text.includes(keyword.toLowerCase())) continue;
                const cdKey = `${ctx.chatId}:${keyword}`;
                const last = global._tgArCooldowns.get(cdKey);
                if (last && Date.now() - last < 60000) continue;
                global._tgArCooldowns.set(cdKey, Date.now());
                await ctx.replyHTML(val.response);
                return true;
            }
        }
        return false;
    }
};
