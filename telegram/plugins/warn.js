// /warn (reply) [reason] and /warnings (reply, or yourself)
const { target, guard, logAction, link, esc } = require('../mod');
const { tr } = require('../lang/mod');

module.exports = {
    name: 'warn', aliases: ['warning', 'warnings'], description: 'Warn a member or see their warnings', category: 'Moderation',
    usage: '/warn (reply) [reason] · /warnings (reply)', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        if (!(await guard(ctx, t, 'can_restrict_members'))) return;
        const db = ctx.client?.db;
        if (!db) return ctx.replyHTML(t('failed'));
        const g = `tg_${ctx.chatId}`;
        const count = (id) => db.prepare(`SELECT COUNT(*) c FROM moderation_logs WHERE user_id=? AND guild_id=? AND action='warn'`).get(String(id), g).c;

        if (ctx.calledAs === 'warnings') {
            const who = target(ctx) || { id: ctx.userId, name: ctx.message?.from?.first_name || String(ctx.userId) };
            const rows = db.prepare(`SELECT reason, timestamp FROM moderation_logs WHERE user_id=? AND guild_id=? AND action='warn' ORDER BY timestamp DESC LIMIT 10`).all(String(who.id), g);
            if (!rows.length) return ctx.replyHTML(t('warnings_none', { who_html: link(who) }));
            const lines = rows.map((w, i) => `${i + 1}. ${esc(w.reason || t('no_reason'))} · <i>${new Date(w.timestamp * 1000).toISOString().slice(0, 10)}</i>`);
            return ctx.replyHTML(`${t('warnings_t', { who_html: link(who) })}\n\n${lines.join('\n')}`);
        }

        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: '/warn' }));
        if (who.bot) return ctx.replyHTML(t('no_bots'));
        const reason = ctx.args.slice(who.fromArg ? 1 : 0).join(' ') || t('no_reason');
        logAction(ctx, 'warn', who.id, reason);
        const n = count(who.id);
        let msg = t('warned', { who_html: link(who), n, reason });
        if (n >= 3) msg += `\n\n${t('warn_many', { n })}`;
        return ctx.replyHTML(msg);
    },
};
