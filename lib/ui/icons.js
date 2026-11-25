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
    coins: [['coins'], '🪙'],
    trophy: [['trophy'], '🏆'],
    rank1: [['ic_rank1', 'gold_medal'], '🥇'],   // the vote leaderboard's podium
    rank2: [['ic_rank2', 'silver_medal'], '🥈'],
    rank3: [['ic_rank3', 'bronze_medal'], '🥉'],
    clock: [['clock', 'alarm'], '⏰'],
    gift: [['ic_gift', 'claim'], '🎁'],
    star: [['star'], '⭐'],
    ticket: [['ticket'], '🎫'],
    member: [['member', 'myprofile'], '👤'],
    claimed: [['claim', 'staff'], '🙋'],
    lock: [['lock'], '🔒'],
    messages: [['ic_general'], '💬'],
    skip: [['ic_skip'], '⏭️'],
    file: [['ic_file'], '📄'],
    // music player
    music: [['music'], '🎵'],                    // /lyrics
    calc: [['ic_calc'], '🧮'],                    // /calc
    qr: [['ic_qr'], '🔳'],                        // /qr
    define: [['ic_define', 'ic_rules'], '📖'],    // /define
    youtube: [['ic_youtube'], '📺'],             // /youtube
    search: [['ic_search'], '🔍'],
    eye: [['ic_eye'], '👀'],
    pin: [['ic_pin'], '📌'],                     // pin archive
    boost: [['ic_rocket', 'boost'], '🚀'],      // .boosters
    mc_prev: [['mc_previous'], '⏮️'],
    mc_pause: [['mc_pause'], '⏸️'],
    mc_play: [['mc_play'], '▶️'],
    mc_skip: [['mc_skip'], '⏭️'],
    mc_stop: [['mc_stop'], '⏹️'],
    mc_loop: [['mc_loop'], '🔁'],
    mc_autoplay: [['mc_autoplay'], '🔄'],
    mc_voldown: [['mc_volume_down'], '🔉'],
    mc_volup: [['mc_volume_up'], '🔊'],
    mc_like: [['mc_love_this'], '❤️'],
    mc_dislike: [['mc_not_for_me'], '👎'],
    mc_queue: [['mc_queue'], '📋'],
    mc_library: [['mc_library'], '📚'],          // /music library
    mc_folder: [['mc_folder', 'folder'], '📂'],
    mc_shuffle: [['ic_shuffle'], '🔀'],
    shop: [['ic_shop', 'shop', 'invest', 'bag'], '🛒'],
    inventory: [['ic_bag', 'bag'], '🎒'],
    refresh: [['ic_refresh', 'refresh', 'loop'], '🔄'],
    // button icons (vote portal, welcome card)
    stats: [['ic_chart', 'stats', 'charts', 'dashboard'], '📊'],
    home: [['home_1'], '🏠'],
    globe: [['globe'], '🌐'],
    language: [['ic_language', 'globe'], '🌐'],   // /setlang title
    world: [['ic_world', 'globe'], '🌐'],         // the Auto choice
    user: [['ic_user'], '👤'],
    online: [['ic_online', 'online'], '🟢'],
    offline: [['ic_offline', 'offline'], '🔴'],
    automod: [['automod', 'shield'], '🛡️'],
    bell: [['ic_bell', 'notification'], '🔔'],
    afk: [['ic_moon'], '💤'],                     // /afk cards
    // the fun pack (lib/fun)
    paw: [['ic_paw'], '🐾'],
    car: [['ic_car'], '🚗'],
    dice: [['ic_dice'], '🎲'],
    coin: [['ic_coin', 'coins'], '🪙'],
    hand: [['ic_hand'], '👋'],
    // /build cards
    builds: [['ic_builds', 'ic_log'], '📋'],
    // /bot socials: section titles and the brand buttons
    share: [['ic_share'], '🔗'],
    broadcast: [['ic_broadcast'], '📡'],
    users: [['ic_users', 'member'], '👥'],
    code: [['ic_code', 'developericon'], '💻'],
    link: [['ic_link', 'website'], '🔗'],
    github: [['ic_github', 'developericon'], '💻'],
    discord: [['ic_discord', 'discord'], '🎮'],
    tiktok: [['tiktok_logo'], '🎬'],
    instagram: [['instagram'], '📸'],
    facebook: [['facebook'], '📘'],
    whatsapp: [['whatsapp'], '💬'],
    // /war cards
    swords: [['ic_swords', 'duel_sword'], '⚔️'],
    // /lydia card
    sparkle: [['hubSparkle'], '✨'],   // the animated sparkle_stars emoji
    brain: [['ic_brain'], '🧠'],
    inbox: [['ic_inbox'], '📬'],                  // Lydia: "sent to your DMs", and her empty memory
    inbox_empty: [['ic_inbox'], '📭'],
    clear: [['ic_clear'], '🧹'],
    // /verify
    shield_check: [['ic_shield_check', 'ic_shield'], '🛡️'],
    user_check: [['ic_user_check'], '✅'],
    user_x: [['ic_user_x'], '⛔'],
    keyboard: [['ic_enter'], '⌨️'],
    // /wrg
    puzzle: [['ic_puzzle'], '🧩'],
    // /duel battle buttons
    shield: [['ic_shield'], '🛡️'],
    heal: [['ic_heal'], '💚'],
    bolt: [['ic_bolt'], '⚡'],
    history: [['ic_history'], '🕐'],
    flame: [['ic_flame', 'streak'], '🔥'],
    win: [['ic_win', 'ic_status_ok'], '🟢'],
    loss: [['ic_loss', 'ic_status_bad'], '🔴'],
    draw: [['ic_draw', 'ic_status_warn'], '🟡'],
    target: [['ic_target', 'gamer'], '🎯'],
    tool: [['ic_tool'], '🛠️'],
    edit: [['ic_edit'], '✏️'],
    trash: [['ic_trash'], '🗑️'],
    bellOff: [['ic_bell_off', 'mute'], '🔕'],
    weekend: [['ic_gift', 'hubSparkle'], '🎉'],
    bot: [['ic_bot'], '🤖'],
    send: [['ic_send'], '💸'],
    join: [['ic_join'], '🎁'],   // white icon made for the green Enter button of a giveaway (ic_enter is the verify keyboard)
    palette: [['ic_palette'], '🎨'],
    on: [['ic_on'], '🟢'],                        // green switch: something turned on
    off: [['ic_toggle_off', 'ic_off'], '🔴'],      // red switch, the mirror of ic_on (ic_off stays the red cross for errors)
    dashboard: [['ic_dashboard'], '🌐'],   // dashboard link buttons (globe stays for translation and link domains)
    back: [['ic_back', 'back'], '⬅️'],
    // page buttons: ‹ › on every card that turns pages
    page_prev: [['ic_chevron_left'], '◀️'],
    page_next: [['ic_chevron_right'], '▶️'],
    info: [['ic_info', 'hubInfo'], '💡'],
    next: [['ic_next', 'triviaNext'], '➡️'],
    category: [['ic_category', 'triviaMenu'], '🗂️'],
    games: [['ic_games', 'triviaGames'], '🎮'],
    // /channels: one icon per channel setting
    ch_title: [['ic_hash'], '#️⃣'],
    ch_welcome: [['ic_door_enter'], '👋'],
    ch_goodbye: [['ic_door_exit'], '🚪'],
    ch_rules: [['ic_rules'], '📜'],
    ch_general: [['ic_general'], '💬'],
    ch_modlog: [['ic_gavel'], '🔨'],
    ch_log: [['ic_log'], '📋'],
    ch_ticket: [['ic_ticket', 'ticket'], '🎫'],
    ch_daily: [['ic_daily', 'ic_calendar'], '📅'],
    ch_levelup: [['ic_levelup'], '📈'],
    ch_updates: [['ic_updates'], '📣'],
    ch_votes: [['vote', 'ic_vote'], '🗳️'],
    todo: [['ic_circle_dashed'], '⚪'],           // setup checklist: not done yet
    // /rules: the rule numbers and the card title
    num_1: [['ic_num_1'], '1\uFE0F\u20E3'],
    num_2: [['ic_num_2'], '2\uFE0F\u20E3'],
    num_3: [['ic_num_3'], '3\uFE0F\u20E3'],
    num_4: [['ic_num_4'], '4\uFE0F\u20E3'],
    num_5: [['ic_num_5'], '5\uFE0F\u20E3'],
    num_6: [['ic_num_6'], '6\uFE0F\u20E3'],
    num_7: [['ic_num_7'], '7\uFE0F\u20E3'],
    num_8: [['ic_num_8'], '8\uFE0F\u20E3'],
    num_9: [['ic_num_9'], '9\uFE0F\u20E3'],
    gavel: [['ic_gavel'], '⚖️'],
    // /global cards
    building: [['ic_building'], '🏘️'],          // this server's wallet
    server: [['ic_server'], '🖥️'],
    crown: [['ic_crown', 'crown'], '👑'],         // leaderboard: 1st
    medal: [['ic_medal'], '🥈'],                  // 2nd
    medal2: [['ic_medal_2'], '🥉'],               // 3rd
    voice: [['ic_voice'], '🎙️'],                  // /tempvoice room panel
    gamepad: [['ic_gamepad'], '🎮'],              // /tempvoice room names and setup
    // /image themes (title and "Change theme" menu)
    img_random: [['ic_shuffle'], '🔀'],
    img_dog: [['ic_dog'], '🐕'],
    img_cat: [['ic_cat'], '🐈'],
    img_car: [['ic_car'], '🚗'],
    img_nature: [['ic_leaf'], '🌿'],
    img_architecture: [['ic_arch'], '🏛️'],
    img_food: [['ic_food'], '🍽️'],
    img_space: [['ic_rocket'], '🚀'],
    img_cyberpunk: [['ic_city'], '🌃'],
    check: [['ic_check'], '✅'],                  // white tick for green Confirm buttons
    x: [['ic_x'], '✖️'],                          // Cancel buttons
    dot_on: [['dot_yellow'], '🟡'],               // streak strip
    dot_off: [['dot_white'], '⚪'],
};
const CUSTOM = /^<a?:\w{2,32}:\d{15,25}>$/;

function custom(keys) {
    let E;
    try { E = require('../../config/emojis'); } catch { return null; }
    for (const k of keys) {
        const v = E?.[k];
        if (typeof v === 'string' && CUSTOM.test(v) && require('../emoji-check').usable(v)) return v;
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
