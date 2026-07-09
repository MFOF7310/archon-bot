const fs = require('fs');
const path = require('path');

const DB_PATH = path.join('/tmp', 'archon_rules.json');

function loadRules() {
    try { return JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); } catch { return {}; }
}

function saveRules(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data), 'utf8');
}

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

module.exports = {
    name: 'rules',
    aliases: ['setrules', 'rule'],
    description: 'Set or view group rules',
    category: 'Moderation',
    usage: '/rules | /rules set <text>',

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        const db = loadRules();
        const key = String(ctx.chatId);

        if (ctx.args[0]?.toLowerCase() === 'set') {
            if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Only admins can set rules.`);
            const text = ctx.args.slice(1).join(' ');
            if (!text) return ctx.replyHTML(`💡 Usage: <code>/rules set Your rules here...</code>`);
            db[key] = text;
            saveRules(db);
            return ctx.replyHTML(`✅ Group rules updated!\n\n🦅 ARCHON CG-223`);
        }

        if (ctx.args[0]?.toLowerCase() === 'clear') {
            if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);
            delete db[key];
            saveRules(db);
            return ctx.replyHTML(`✅ Rules cleared.`);
        }

        const rules = db[key];
        if (!rules) return ctx.replyHTML(`📋 No rules set yet.\n\nAdmins can set rules with:\n<code>/rules set Your rules here</code>`);
        await ctx.replyHTML(`📋 <b>Group Rules</b>\n━━━━━━━━━━━━━━━━\n\n${escapeHTML(rules)}\n\n🦅 ARCHON CG-223`);
    }
};
