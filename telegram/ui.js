// telegram/ui.js — one message per action. A status line is edited in place (or reuses the message whose button
// was pressed), then removed once the file is sent, or turned into the error or the download link. No pile of
// "Downloading… / Sending… / Done" messages in the chat.
async function progress(ctx, text, markup = null) {
    const opt = (mk) => ({ parse_mode: 'HTML', ...(mk ? { extra: { reply_markup: mk } } : {}) });
    let id = ctx.statusMsgId || null;
    if (id) await ctx.bridge.editMessage(ctx.chatId, id, text, opt(markup)).catch(() => {});
    else { const r = await ctx.bridge.sendTo(ctx.chatId, text, { ...opt(markup), reply_to: ctx.message?.message_id }).catch(() => null); id = r?.data?.message_id || null; }
    let gone = false;
    return {
        id,
        set: (t, mk = null) => (id && !gone ? ctx.bridge.editMessage(ctx.chatId, id, t, opt(mk)).catch(() => {}) : null),
        // the file is in the chat: the status line goes away
        done: () => { if (id && !gone) { gone = true; return ctx.bridge.deleteMessage(ctx.chatId, id).catch(() => {}); } },
        // the status line becomes the final answer (an error, a link, a choice)
        end: (t, mk = null) => { gone = true; return id ? ctx.bridge.editMessage(ctx.chatId, id, t, opt(mk)).catch(() => {}) : ctx.bridge.sendTo(ctx.chatId, t, opt(mk)); },
    };
}

// A caption: the title in bold, then the details on one line
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
function caption(title, ...details) {
    const d = details.filter(Boolean).map(esc).join(' · ');
    return [title ? `<b>${esc(String(title).slice(0, 120))}</b>` : '', d].filter(Boolean).join('\n');
}

// Show a card: in the message whose button was pressed (no new message), otherwise as a reply
function show(ctx, text, markup = null) {
    const opt = { parse_mode: 'HTML', ...(markup ? { extra: { reply_markup: markup } } : {}) };
    if (ctx.statusMsgId) return ctx.bridge.editMessage(ctx.chatId, ctx.statusMsgId, text, opt).catch(() => {});
    return ctx.bridge.sendTo(ctx.chatId, text, { ...opt, reply_to: ctx.message?.message_id });
}

module.exports = { progress, caption, esc, show };
