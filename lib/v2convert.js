'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// CLASSIC MESSAGE → COMPONENTS V2 CARD (the house style)
//   toV2(payload)        a new message: content + embeds + button rows + files become one card
//                        (title, text, fields as "**Name** · value" lines, image, footer, buttons inside the card)
//   fit(message, payload) an edit: a card when the message already is one, the payload unchanged when it is an old
//                        embed message (Discord refuses embeds or content on a card, and an old message stays as it was)
// A payload that already is a card, or has nothing to convert, comes back unchanged. Text is kept within Discord's
// 4000-character limit for a card. Mentions in the content still notify, as allowedMentions says.
// ═══════════════════════════════════════════════════════════════════════════
const {
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder,
    MediaGalleryBuilder, MediaGalleryItemBuilder, MessageFlags,
} = require('discord.js');

const V2 = MessageFlags.IsComponentsV2;
const LIMIT = 3900;                      // all the text of one card (Discord allows 4000)
const ZERO = /^[\s​‌‍⁠]*$/;

const data = (e) => (e && typeof e === 'object' ? (e.data ?? (typeof e.toJSON === 'function' ? e.toJSON() : e)) : {});
// flags as discord.js accepts them: a number, a bit field, a flag name, or a list of those
const flagsOf = (f) => {
    if (typeof f === 'number') return f;
    if (typeof f === 'string') return MessageFlags[f] ?? 0;
    if (Array.isArray(f)) return f.reduce((a, x) => a | flagsOf(x), 0);
    return Number(f?.bitfield ?? 0) || 0;
};

function isV2(message) {
    const f = message?.flags;
    if (!f) return false;
    if (typeof f.has === 'function') return !!f.has(V2);
    return (flagsOf(f) & V2) === V2;
}

// a budget shared by every text of one card
function budget() {
    let left = LIMIT;
    return (s) => {
        s = String(s ?? '');
        if (left <= 0 || !s) return '';
        if (s.length > left) s = s.slice(0, Math.max(0, left - 1)) + '…';
        left -= s.length;
        return s;
    };
}

function fieldLine(f) {
    const name = ZERO.test(String(f.name ?? '')) ? '' : String(f.name);
    const value = String(f.value ?? '');
    if (!name) return value;
    if (!ZERO.test(value) && !value.includes('\n') && (name.length + value.length) <= 80) return `**${name}** · ${value}`;
    return `**${name}**\n${value}`;
}

function container(embed, rows, take) {
    const d = data(embed);
    const c = new ContainerBuilder();
    if (typeof d.color === 'number') c.setAccentColor(d.color);
    const head = [];
    if (d.author?.name) head.push(`-# ${d.author.name}`);
    if (d.title) head.push(`### ${d.url ? `[${d.title}](${d.url})` : d.title}`);
    if (d.description) head.push(String(d.description));
    const headText = take(head.join('\n'));
    const thumb = d.thumbnail?.url;
    let parts = 0;
    if (headText) {
        const t = new TextDisplayBuilder().setContent(headText);
        if (thumb) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(t).setThumbnailAccessory(new ThumbnailBuilder().setURL(thumb)));
        else c.addTextDisplayComponents(t);
        parts++;
    }
    const fields = (Array.isArray(d.fields) ? d.fields : []).filter((f) => f && !(ZERO.test(String(f.name ?? '')) && ZERO.test(String(f.value ?? ''))));
    if (fields.length) {
        if (parts) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        const body = take(fields.map(fieldLine).join('\n'));
        if (body) { c.addTextDisplayComponents(new TextDisplayBuilder().setContent(body)); parts++; }
    }
    if (d.image?.url) {
        c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(d.image.url)));
        parts++;
    }
    const ts = d.timestamp ? Math.floor(new Date(d.timestamp).getTime() / 1000) : null;
    const foot = [d.footer?.text, Number.isFinite(ts) && ts ? `<t:${ts}:f>` : null].filter(Boolean).join(' · ');
    const footText = foot ? take(`-# ${foot}`) : '';
    if (footText) {
        if (parts) c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footText));
        parts++;
    }
    if (!parts) c.addTextDisplayComponents(new TextDisplayBuilder().setContent('​'));
    for (const r of rows) c.addActionRowComponents(r);
    return c;
}

function toV2(payload) {
    if (payload == null) return payload;
    const p = typeof payload === 'string' ? { content: payload } : { ...payload };
    if (isV2(p)) return p;
    const embeds = (Array.isArray(p.embeds) ? p.embeds : []).filter(Boolean);
    const hasContent = typeof p.content === 'string' && p.content.length > 0;
    if (!embeds.length && !hasContent) {
        // nothing to turn into a card; just make sure nothing is left that a card refuses
        if ('embeds' in p && !p.embeds?.length) delete p.embeds;
        if ('content' in p && !p.content) delete p.content;
        return p;
    }
    const rows = Array.isArray(p.components) ? p.components.filter(Boolean) : [];
    const take = budget();
    const out = [];
    if (hasContent) out.push(new TextDisplayBuilder().setContent(take(p.content) || '​'));
    embeds.forEach((e, i) => out.push(container(e, i === embeds.length - 1 ? rows : [], take)));
    if (!embeds.length) out.push(...rows);
    delete p.content;
    delete p.embeds;
    p.components = out;
    p.flags = flagsOf(p.flags) | V2;
    return p;
}

function fit(message, payload) {
    return isV2(message) ? toV2(payload) : payload;
}

module.exports = { toV2, fit, isV2 };
