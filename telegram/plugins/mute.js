// /mute [10m|2h|1d] [reason] and /unmute — reply to the member, or give their numeric ID
const { api, target, guard, fail, logAction, link } = require('../mod');
const { tr } = require('../lang/mod');
const RIGHT = 'can_restrict_members';
const SECS = { s: 1, m: 60, h: 3600, d: 86400 };
const ALL = ['can_send_messages', 'can_send_audios', 'can_send_documents', 'can_send_photos', 'can_send_videos',
    'can_send_video_notes', 'can_send_voice_notes', 'can_send_polls', 'can_send_other_messages', 'can_add_web_page_previews'];
const perms = (on) => Object.fromEntries(ALL.map((k) => [k, on]));

module.exports = {
    name: 'mute', aliases: ['unmute', 'silence'], description: 'Mute or unmute a member', category: 'Moderation',
    usage: '/mute (reply) [10m|2h|1d] [reason] · /unmute (reply)', adminOnly: true,
    handler: async (ctx) => {
        const t = tr(ctx);
        const un = ctx.calledAs === 'unmute';
        if (!(await guard(ctx, t, RIGHT))) return;
        const who = target(ctx);
        if (!who) return ctx.replyHTML(t('need_target', { cmd: un ? '/unmute' : '/mute' }));
        if (who.bot) return ctx.replyHTML(t('no_bots'));
        const tok = ctx.bridge.token;

        if (un) {
            // Give back the group's normal permissions rather than "everything allowed"
            const chat = await api(tok, 'getChat', { chat_id: ctx.chatId });
            const r = await api(tok, 'restrictChatMember', { chat_id: ctx.chatId, user_id: who.id, permissions: chat.result?.permissions || perms(true), use_independent_chat_permissions: true });
            if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
            logAction(ctx, 'unmute', who.id);
            return ctx.replyHTML(t('unmuted', { who_html: link(who) }));
        }

        const args = ctx.args.slice(who.fromArg ? 1 : 0);
        const m = /^(\d+)([smhd])$/i.exec(args[0] || '');
        let secs = 3600, n = 1, u = 'h';
        if (m) { n = parseInt(m[1], 10); u = m[2].toLowerCase(); secs = n * SECS[u]; args.shift(); }
        secs = Math.min(Math.max(secs, 60), 366 * 86400);
        const reason = args.join(' ') || t('no_reason');
        const r = await api(tok, 'restrictChatMember', { chat_id: ctx.chatId, user_id: who.id, permissions: perms(false), use_independent_chat_permissions: true, until_date: Math.floor(Date.now() / 1000) + secs });
        if (!r.ok) return ctx.replyHTML(fail(t, r, RIGHT));
        logAction(ctx, 'mute', who.id, reason);
        return ctx.replyHTML(t('muted', { who_html: link(who), dur: `${n} ${t('dur')[u]}`, reason }));
    },
};
