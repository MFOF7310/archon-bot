'use strict';
// The readable text of a card message: Components V2 (containers, sections, text, buttons, menus) and old embeds,
// plus the first picture found (thumbnail, gallery, embed image) when the message has no attachment.
function cardText(m) {
    const out = []; let image = null;
    const seen = new Set();
    const walk = (c) => {
        if (!c || typeof c !== 'object' || seen.has(c)) return; seen.add(c);
        if (typeof c.content === 'string' && c.content.trim()) out.push(c.content.trim());   // text display
        if (typeof c.label === 'string' && c.label.trim()) out.push(`[${c.label.trim()}]`);  // buttons
        if (typeof c.placeholder === 'string' && c.placeholder.trim()) out.push(`[${c.placeholder.trim()}]`);
        const url = c.media?.url;
        if (!image && typeof url === 'string' && /^https?:/.test(url)) image = url;
        for (const k of ['components', 'items']) if (Array.isArray(c[k])) c[k].forEach(walk);
        if (c.accessory) walk(c.accessory);
    };
    try { for (const c of m?.components || []) walk(typeof c.toJSON === 'function' ? c.toJSON() : (c.data || c)); } catch { /* keep what was read */ }
    for (const e of m?.embeds || []) {
        const d = e.data || e;
        [d.author?.name, d.title, d.description, ...(d.fields || []).map((f) => `${f.name}: ${f.value}`), d.footer?.text]
            .filter((x) => typeof x === 'string' && x.trim()).forEach((x) => out.push(x.trim()));
        if (!image) image = d.image?.url || d.thumbnail?.url || null;
    }
    return { text: out.join('\n'), image };
}

// Everything readable in a message: its own text, then the card's
function messageText(m) {
    const card = cardText(m);
    return { text: [String(m?.content || '').trim(), card.text].filter(Boolean).join('\n'), image: card.image };
}

module.exports = { cardText, messageText };
