const fs = require('fs');
const { t } = require('../lang/index.js');

const DB_PATH = '/tmp/archon_filters.json';

function load() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}
function save(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d, null, 2)); }
function escapeHTML(s) { return !s || typeof s !== 'string' ? '' : s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = {
    name: 'filter',
    aliases: ['gfilter', 'pfilter', 'stop', 'gstop', 'pstop', 'filters'],
    description: 'Set keyword auto-replies',
    category: 'Moderation',
    usage: '/filter <keyword> <response>',

    handler: async (ctx) => {
        const lang = ctx.message?.from?.language_code || 'en';
        const cmd = ctx.message?.text?.split(' ')[0]?.replace('/','').replace('@' + (ctx.bridge?.botUsername||''),'').toLowerCase() || 'filter';
        const db = load();
        const isAdmin = await ctx.isAdmin();
        const isOwner = ctx.isOwner();

        if (cmd === 'filters') {
            const keys = [`c:${ctx.chatId}`, `g:${ctx.chatId}`, 'pm'];
            let msg = `🤖 <b>Active Filters</b>
━━━━━━━━━━━━━━━━

`;
            let found = false;
            for (const k of keys) {
                if (!db[k] || !Object.keys(db[k]).length) continue;
                const label = k.startsWith('g:') ? '🌐 Group-wide' : k.startsWith('c:') ? '💬 This chat' : '📩 Private';
                msg += `<b>${label}:</b>
`;
                for (const [kw, val] of Object.entries(db[k])) {
                    msg += `• <code>${escapeHTML(kw)}</code> → ${escapeHTML(val.response.substring(0,50))}
`;
                }
                msg += '
';
                found = true;
            }
            if (!found) msg += 'No filters set yet.

Use <code>/filter keyword response</code> to add one!';
            return ctx.replyHTML(msg);
        }

        if (cmd === 'stop' || cmd === 'gstop' || cmd === 'pstop') {
            if (!isAdmin && !isOwner) return ctx.replyHTML(t(lang, 'filter_admin_only'));
            const keyword = ctx.args[0]?.toLowerCase();
            if (!keyword) return ctx.replyHTML(`💡 Usage: <code>/${cmd} &lt;keyword&gt;</code>`);
            const key = cmd === 'gstop' ? `g:${ctx.chatId}` : cmd === 'pstop' ? 'pm' : `c:${ctx.chatId}`;
            if (db[key]?.[keyword]) {
                delete db[key][keyword];
                save(db);
                return ctx.replyHTML(t(lang, 'filter_removed'));
            }
            return ctx.replyHTML(t(lang, 'filter_not_found'));
        }

        if (!isAdmin && !isOwner) return ctx.replyHTML(t(lang, 'filter_admin_only'));

        const keyword = ctx.args[0]?.toLowerCase();
        const response = ctx.args.slice(1).join(' ');

        if (!keyword || !response) {
            return ctx.replyHTML(
                `🤖 <b>Auto-Reply Filter</b>
━━━━━━━━━━━━━━━━

` +
                `<code>/filter &lt;keyword&gt; &lt;response&gt;</code> — This chat only
` +
                `<code>/gfilter &lt;keyword&gt; &lt;response&gt;</code> — All groups
` +
                `<code>/pfilter &lt;keyword&gt; &lt;response&gt;</code> — Private chats
` +
                `<code>/stop &lt;keyword&gt;</code> — Remove filter
` +
                `<code>/filters</code> — List all

` +
                `💡 Example:
<code>/filter website Check bamako-steel-dev.xyz!</code>

` +
                `🦅 ARCHON CG-223`
            );
        }

        const key = cmd === 'gfilter' ? `g:${ctx.chatId}` : cmd === 'pfilter' ? 'pm' : `c:${ctx.chatId}`;
        if (!db[key]) db[key] = {};
        db[key][keyword] = { response, createdBy: ctx.username, createdAt: Date.now() };
        save(db);

        const scopeLabel = cmd === 'gfilter' ? 'all groups' : cmd === 'pfilter' ? 'private chats' : 'this chat only';
        await ctx.replyHTML(
            `${t(lang, 'filter_added')}

` +
            `🔑 Keyword: <code>${escapeHTML(keyword)}</code>
` +
            `💬 Response: ${escapeHTML(response.substring(0, 80))}${response.length > 80 ? '...' : ''}
` +
            `📍 Scope: ${scopeLabel}

` +
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
