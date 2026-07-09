const fs = require('fs');

const DB_PATH = '/tmp/archon_antilink.json';
const URL_REGEX = /(https?:\/\/[^\s]+|t\.me\/[^\s]+|@[a-zA-Z0-9_]{5,})/gi;

function load() { try { return JSON.parse(fs.readFileSync(DB_PATH,'utf8')); } catch { return {}; } }
function save(d) { fs.writeFileSync(DB_PATH, JSON.stringify(d)); }

module.exports = {
    name: 'antilink',
    aliases: ['nolink'],
    description: 'Toggle antilink protection',
    category: 'Moderation',
    usage: '/antilink on|off',
    adminOnly: true,

    handler: async (ctx) => {
        if (!ctx.isGroup) return ctx.replyHTML(`⚠️ Groups only!`);
        if (!await ctx.isAdmin()) return ctx.replyHTML(`⛔ Admins only.`);

        const db = load();
        const key = String(ctx.chatId);
        const arg = ctx.args[0]?.toLowerCase();

        if (arg === 'on') {
            db[key] = true;
            save(db);
            return ctx.replyHTML(`🔒 <b>Antilink ON</b>\n\nI\'ll delete any links posted by non-admins.\n\n🦅 ARCHON CG-223`);
        }
        if (arg === 'off') {
            db[key] = false;
            save(db);
            return ctx.replyHTML(`🔓 <b>Antilink OFF</b>\n\nLinks are allowed again.\n\n🦅 ARCHON CG-223`);
        }

        const status = db[key] ? '🔒 ON' : '🔓 OFF';
        await ctx.replyHTML(`🔗 <b>Antilink</b> — Currently ${status}\n\nUsage: <code>/antilink on</code> or <code>/antilink off</code>`);
    },

    // Called from message handler to check links
    checkLink: async (ctx, bridge) => {
        const db = load();
        if (!db[String(ctx.chatId)]) return false;
        if (!ctx.text || !URL_REGEX.test(ctx.text)) return false;
        if (await ctx.isAdmin()) return false;

        // Delete the message
        try {
            await ctx.deleteMsg(ctx.message.message_id);
            await ctx.replyHTML(`⚠️ <a href="tg://user?id=${ctx.userId}">${ctx.username}</a>, links aren\'t allowed here!`);
        } catch(e) {}
        return true;
    }
};
