// lib/canPost.js — ARCHON CG-223
// Can ARCHON post in this channel, and if not, exactly why? One rule set for the bot, .postcheck, the dashboard health card and safeSend.
//   diagnose(guild, channel, me, needed?, opts?) → { ok } or { ok:false, reason, key, missing, role, blocker }. Never throws.
//   log(guild, channel, me, context, needed?)     → diagnose + one console line per boot (silent background paths)
//   needsOf(payload, { reply })                   → what a message really needs: embeds → Embed Links, files → Attach Files, a reply → Read Message History
// Reasons: private · role_block · missing_perm · gone · wrong_type · thread_locked · timeout
//   (safeSend adds "refused": Discord said no although the check passed)
// opts.soft = true also lists the permissions whose absence only makes the message look worse (Use External Emojis) in d.soft.
// When ARCHON's own member or the channel's permissions are not available, the answer is { ok: true, unverified: true }:
// the send itself then decides, and a refusal is still recorded by safeSend.
const { PermissionFlagsBits: F } = require('discord.js');

const PERMS = {
    view: ['View Channel', F.ViewChannel],
    send: ['Send Messages', F.SendMessages],
    sendThreads: ['Send Messages in Threads', F.SendMessagesInThreads],
    embed: ['Embed Links', F.EmbedLinks],
    files: ['Attach Files', F.AttachFiles],
    history: ['Read Message History', F.ReadMessageHistory],
    emojis: ['Use External Emojis', F.UseExternalEmojis],
    threads: ['Manage Threads', F.ManageThreads],
};

const NEEDED = [PERMS.view, PERMS.send, PERMS.embed];
// Sends that upload a card/image need Attach Files on top of the base trio.
const CARD_NEEDED = [...NEEDED, PERMS.files];
// A reply quotes the member's message, and Discord refuses it without Read Message History.
const REPLY_NEEDED = [PERMS.view, PERMS.send, PERMS.history];
const SOFT = [PERMS.emojis];

const REASON_SUFFIX = {
    private: 'Private', role_block: 'RoleBlock', missing_perm: 'MissingPerm',
    gone: 'Gone', wrong_type: 'WrongType', thread_locked: 'ThreadLocked', timeout: 'Timeout', refused: 'Refused',
};
const REASONS = Object.keys(REASON_SUFFIX);
const keyFor = (prefix, reason) => prefix + (REASON_SUFFIX[reason] || 'Private');

const fail = (reason, extra = {}) => ({ ok: false, reason, key: keyFor('cantPost', reason), missing: [], role: null, blocker: null, ...extra });

const isThread = (ch) => (typeof ch?.isThread === 'function' ? ch.isThread() : [10, 11, 12].includes(ch?.type));
// Forums, media channels and categories hold posts or channels, not messages.
const holdsMessages = (ch) => typeof ch?.send === 'function' && (typeof ch.isTextBased === 'function' ? ch.isTextBased() : true);
const timedOut = (me) => {
    const until = me?.communicationDisabledUntilTimestamp;
    return typeof until === 'number' && until > Date.now();
};
// In a thread, "Send Messages" is "Send Messages in Threads"; everything else comes from the parent channel.
const adapt = (needed, thread) => (thread ? needed.map((p) => (p[1] === F.SendMessages ? PERMS.sendThreads : p)) : needed);

// Who takes the permission away, in the order Discord applies channel overwrites:
// ARCHON's own overwrite wins, then its roles (a deny that no allow cancels), then @everyone.
function findBlocker(guild, source, me, bits) {
    const ows = source?.permissionOverwrites?.cache;
    if (!ows || typeof ows.get !== 'function') return null;
    const has = (ow, side, bit) => !!ow?.[side]?.has?.(bit);
    const roleName = (id) => {
        const n = guild.roles?.cache?.get(id)?.name;
        return n ? (n.startsWith('@') ? n : '@' + n) : '@role';
    };
    const mine = ows.get(me.id);
    for (const bit of bits) {
        if (has(mine, 'deny', bit)) return { type: 'member', id: me.id, name: '@' + (me.displayName || me.user?.username || 'ARCHON') };
    }
    const roleOws = [...ows.values()].filter((ow) => ow.type === 0 && ow.id !== guild.id && me.roles?.cache?.has?.(ow.id));
    for (const bit of bits) {
        if (has(mine, 'allow', bit) || roleOws.some((ow) => has(ow, 'allow', bit))) continue;
        const denier = roleOws.find((ow) => has(ow, 'deny', bit));
        if (denier) return { type: 'role', id: denier.id, name: roleName(denier.id) };
    }
    const everyone = ows.get(guild.id);
    for (const bit of bits) {
        if (has(everyone, 'deny', bit)) return { type: 'everyone', id: guild.id, name: '@everyone' };
    }
    return null;
}

function diagnose(guild, channel, me, needed = NEEDED, opts = {}) {
    try {
        if (!channel) return fail('gone');
        me = me || guild?.members?.me;
        if (!guild || !me) return { ok: true, unverified: true };
        const asked = Array.isArray(needed) && needed.length ? needed : NEEDED;
        // Posting needs a channel that holds messages. Other checks (Manage Channels for slowmode, the ban/kick guards) do not.
        const posting = asked.some(([, bit]) => bit === F.SendMessages || bit === F.SendMessagesInThreads);
        if (posting && !holdsMessages(channel)) return fail('wrong_type', { channelType: channel.type });
        // A timed-out member keeps only View Channel and Read Message History, whatever the check.
        if (timedOut(me)) return fail('timeout', { until: me.communicationDisabledUntilTimestamp });

        const thread = isThread(channel);
        const want = adapt(asked, thread);
        const chPerms = typeof channel.permissionsFor === 'function' ? channel.permissionsFor(me) : null;
        if (!chPerms) return { ok: true, unverified: true };

        const missing = want.filter(([, bit]) => !chPerms.has(bit)).map(([name]) => name);
        if (missing.length === 0) {
            if (posting && thread && channel.locked && !chPerms.has(F.ManageThreads)) return fail('thread_locked', { missing: [PERMS.threads[0]] });
            const res = { ok: true };
            if (opts.soft) {
                const soft = SOFT.filter(([, bit]) => !chPerms.has(bit)).map(([name]) => name);
                if (soft.length) res.soft = soft;
            }
            return res;
        }

        // Missing on the whole server: the role itself has to be fixed first.
        const missingGuild = want.filter(([, bit]) => !me.permissions?.has?.(bit)).map(([name]) => name);
        if (missingGuild.length) return fail('missing_perm', { missing: missingGuild });

        // The role has it, so a channel overwrite takes it away: name the one that does.
        const bits = want.filter(([name]) => missing.includes(name)).map(([, bit]) => bit);
        const blocker = findBlocker(guild, thread ? channel.parent : channel, me, bits);
        const role = blocker ? blocker.name : null;
        if (missing.includes(PERMS.view[0])) return fail('private', { missing, role, blocker });
        return fail('role_block', { missing, role, blocker });
    } catch (e) {
        console.error('[canPost] check failed:', e.message);
        return { ok: true, unverified: true };
    }
}

// What a message really needs, from what it carries.
function needsOf(payload, opts = {}) {
    const list = [PERMS.view, PERMS.send];
    const p = payload && typeof payload === 'object' ? payload : {};
    if (Array.isArray(p.embeds) && p.embeds.length) list.push(PERMS.embed);
    if (Array.isArray(p.files) && p.files.length) list.push(PERMS.files);
    if (opts.reply) list.push(PERMS.history);
    return list;
}

function consoleText(d) {
    switch (d.reason) {
        case 'private': return 'channel is private — add the ARCHON role to its permissions';
        case 'role_block': return `${d.role || 'an override'} is denying ${d.missing.join(', ')} — add the ARCHON role with allow`;
        case 'missing_perm': return `role missing ${d.missing.join(', ')} server-wide — Server Settings → Roles → ARCHON`;
        case 'gone': return 'the channel no longer exists';
        case 'wrong_type': return 'not a channel that holds messages (forum, media or category)';
        case 'thread_locked': return 'the thread is locked';
        case 'timeout': return 'ARCHON is timed out on this server';
        default: return d.reason;
    }
}

// Background sends: a console line once per boot, and the failure journal the admins and the dashboard read.
const warned = new Set();
function log(guild, channel, me, context = 'bot', needed = NEEDED) {
    const d = diagnose(guild, channel, me, needed);
    if (!d.ok) {
        const id = `${context}:${guild?.id}:${channel?.id}:${d.reason}`;
        if (!warned.has(id)) {
            warned.add(id);
            console.warn(`[canPost] ⛔ ${context} → #${channel?.name || channel?.id || '?'} (${guild?.name || guild?.id}) — ${consoleText(d)}`);
        }
    }
    return d;
}

// Localized permission names, as Discord's own fr/zh client shows them.
// Arabic and Bambara have no Discord interface: admins see the English labels, so those map to themselves.
const PERM_LOCALE = {
    fr: {
        'View Channel': 'Voir le salon', 'Send Messages': 'Envoyer des messages', 'Embed Links': 'Intégrer des liens',
        'Manage Channels': 'Gérer les salons', 'Manage Roles': 'Gérer les rôles', 'Attach Files': 'Joindre des fichiers',
        'Read Message History': 'Voir les anciens messages', 'Send Messages in Threads': 'Envoyer des messages dans les fils',
        'Use External Emojis': 'Utiliser des émojis externes', 'Manage Threads': 'Gérer les fils',
    },
    zh: {
        'View Channel': '查看频道', 'Send Messages': '发送消息', 'Embed Links': '嵌入链接',
        'Manage Channels': '管理频道', 'Manage Roles': '管理身份组', 'Attach Files': '上传文件',
        'Read Message History': '阅读消息历史记录', 'Send Messages in Threads': '在子区中发送消息',
        'Use External Emojis': '使用外部表情符号', 'Manage Threads': '管理子区',
    },
};
const localize = (names, lang) => (names || []).map((n) => (PERM_LOCALE[lang] || {})[n] || n);

// What each feature sends, for the checks that have no message in hand (.postcheck, the dashboard health card).
// safeSend does not use this table: it reads the message itself.
const FEATURE_NEEDED = {
    welcome: [PERMS.view, PERMS.send, PERMS.files],          // card image in a Components V2 message
    goodbye: [PERMS.view, PERMS.send, PERMS.files],
    levelup: [PERMS.view, PERMS.send],                        // one line of text
    'levelup-milestone': [...NEEDED, PERMS.files],            // embed + banner image
    modlog: [PERMS.view, PERMS.send],                         // Components V2 card
    birthday: NEEDED,                                         // embed
    youtube: [PERMS.view, PERMS.send],
    tiktok: [PERMS.view, PERMS.send],
};
const neededFor = (feature) => FEATURE_NEEDED[feature] || NEEDED;

module.exports = {
    diagnose, log, keyFor, localize, neededFor, needsOf,
    FEATURE_NEEDED, CARD_NEEDED, NEEDED, REPLY_NEEDED, PERMS, REASONS,
};
