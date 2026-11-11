'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// ARCHON — ICONS for the cards: the status icons (/postcheck, the "couldn't post" alert, the setup warnings) and the
// one icon in front of each line of a stats card (vote, tickets)
//   icon(kind, where) → ARCHON's own emoji (config/emojis.js) when it may use it where the card is shown, else the
//   standard one, so a card never shows a raw :name:.
// `where` is the channel, message or interaction the card appears in; a guild alone checks the server-wide permission;
// nothing (a DM) means ARCHON's own emojis always work.
// The first custom emoji found in the list wins (the small static ones first, so a checklist stays calm).
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionFlagsBits: F } = require('discord.js');

const SET = {
    ok: [['small_check', 'check', 'success', 'screaminggreen'], '✅'],
    no: [['small_cross', 'error', 'red_color'], '❌'],
    warn: [['ic_warn', 'warning'], '⚠️'],
    muted: [['mute'], '🔕'],
    // one icon per line of a stats card
    streak: [['streak'], '🔥'],
    votes: [['vote'], '🗳️'],
    milestone: [['milestones'], '🎯'],
    coins: [['coins'], '💰'],
    trophy: [['trophy'], '🏆'],
    clock: [['clock', 'alarm'], '⏰'],
    gift: [[], '🎁'],
    star: [['star'], '⭐'],
    ticket: [['ticket'], '🎫'],
    member: [['member', 'myprofile'], '👤'],
    claimed: [['claim', 'staff'], '🙋'],
    lock: [['lock'], '🔒'],
    messages: [[], '💬'],
    file: [[], '📄'],
    // music player
    mc_prev: [['mc_previous'], '⏮️'],
    mc_pause: [['mc_pause'], '⏸️'],
    mc_play: [[], '▶️'],
    mc_skip: [['mc_skip'], '⏭️'],
    mc_stop: [['mc_stop'], '⏹️'],
    mc_loop: [['mc_loop'], '🔁'],
    mc_autoplay: [['mc_autoplay'], '🔄'],
    mc_voldown: [['mc_volume_down'], '🔉'],
    mc_volup: [['mc_volume_up'], '🔊'],
    mc_like: [['mc_love_this'], '❤️'],
    mc_dislike: [['mc_not_for_me'], '👎'],
    mc_queue: [['mc_queue'], '📋'],
    shop: [['ic_shop', 'shop', 'invest', 'bag'], '🛒'],
    inventory: [['ic_bag', 'bag'], '🎒'],
    refresh: [['ic_refresh', 'refresh', 'loop'], '🔄'],
    // button icons (vote portal, welcome card)
    stats: [['ic_chart', 'stats', 'charts', 'dashboard'], '📊'],
    home: [['home_1'], '🏠'],
    globe: [['globe'], '🌐'],
    online: [['ic_online', 'online'], '🟢'],
    offline: [['ic_offline', 'offline'], '🔴'],
    automod: [['automod', 'shield'], '🛡️'],
    bell: [['ic_bell', 'notification'], '🔔'],
    bellOff: [['ic_bell_off', 'mute'], '🔕'],
    weekend: [['ic_gift', 'hubSparkle'], '🎉'],
};
const CUSTOM = /^<a?:\w{2,32}:\d{15,25}>$/;

function custom(keys) {
    let E;
    try { E = require('../../config/emojis'); } catch { return null; }
    for (const k of keys) {
        const v = E?.[k];
        if (typeof v === 'string' && CUSTOM.test(v)) return v;
    }
    return null;
}

function canUse(where) {
    try {
        const guild = where?.guild || (where?.members && where?.channels ? where : null);
        if (!guild) return true;
        const me = guild.members?.me;
        if (!me) return false;
        const channel = typeof where?.channel?.permissionsFor === 'function' ? where.channel
            : (typeof where?.permissionsFor === 'function' ? where : null);
        if (channel) return !!channel.permissionsFor(me)?.has(F.UseExternalEmojis);
        return !!me.permissions?.has?.(F.UseExternalEmojis);
    } catch {
        return false;
    }
}

function icon(kind, where) {
    const [keys, fallback] = SET[kind] || [[], ''];
    const e = custom(keys);
    return e && canUse(where) ? e : fallback;
}


// Universal dynamic button icon resolver
function iconObj(key, where, fallback) {
    const e = custom([key]);
    if (e && canUse(where)) {
        const m = /^<(a?):(\w+):(\d+)>$/.exec(e);
        if (m) return { id: m[3], name: m[2], animated: m[1] === 'a' };
    }
    return fallback; // returns the Unicode string if custom is missing/denied
}

module.exports = { icon, iconObj };
