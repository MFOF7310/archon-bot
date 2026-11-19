// ═══════════════════════════════════════════════════════════════════════════
// .pin / .unpin / .pins — pin a message and keep a copy in the server's pin archive channel
//   .pin    reply to a message (or give its ID, in this channel): it is pinned and copied to the archive
//   .unpin  reply to a pinned message (or its ID)
//   .pins   the pinned messages of this channel
// The archive card's Unpin button works at any time (pin:unpin:<channel>:<message>); the old cards' button
// (unpin_<id>) had no handler at all and always failed, it is answered too. Managing pins: Manage Messages.
// The archive channel is created once per server ("📂 Archives" / "📌-pins") and remembered.
// Texts: lang/<l>/pin.json
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`pin.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const canManage = (member) => member?.permissions?.has?.(PermissionsBitField.Flags.ManageMessages);
const short = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const GOLD = 0xE6A817;

// ─── storage ───
function ensurePinTable(db) {
    try {
        db.prepare(`CREATE TABLE IF NOT EXISTS pinned_messages (message_id TEXT PRIMARY KEY, guild_id TEXT NOT NULL, channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL, author_tag TEXT, content TEXT, pinned_by TEXT NOT NULL, pinned_at INTEGER DEFAULT (strftime('%s', 'now')),
            attachment_urls TEXT, jump_url TEXT)`).run();
        return true;
    } catch (e) { console.error('[PIN] table:', e.message); return false; }
}
function savePin(db, m, by) {
    if (!ensurePinTable(db)) return;
    try {
        db.prepare(`INSERT OR REPLACE INTO pinned_messages (message_id, guild_id, channel_id, author_id, author_tag, content, pinned_by, attachment_urls, jump_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(m.id, m.guild.id, m.channel.id, m.author.id, m.author.tag, short(m.content, 2000), by.id,
            m.attachments.size ? JSON.stringify([...m.attachments.values()].map((a) => a.url)) : null, m.url);
    } catch (e) { console.error('[PIN] save:', e.message); }
}
const forget = (db, id) => { try { db.prepare('DELETE FROM pinned_messages WHERE message_id = ?').run(id); } catch {} };
const archivedCount = (db, gid) => { try { return db.prepare('SELECT COUNT(*) AS c FROM pinned_messages WHERE guild_id = ?').get(gid)?.c || 0; } catch { return 0; } };

// ─── the archive channel ───
const ARCHIVE_CATEGORY = '📂 Archives';
const OLD_CATEGORY = '📂 NEURAL ARCHIVES';
const OLD_CHANNEL = '📌-neural-archives';
const archiveName = (lang) => (lang === 'fr' ? '📌-épinglés' : '📌-pins');
function archiveStore(db) {
    try { db.prepare('CREATE TABLE IF NOT EXISTS pin_archive (guild_id TEXT PRIMARY KEY, channel_id TEXT NOT NULL)').run(); return db; } catch { return null; }
}
async function findArchiveChannel(db, guild, lang) {
    const d = archiveStore(db);
    let row = null;
    try { row = d?.prepare('SELECT channel_id FROM pin_archive WHERE guild_id = ?').get(guild.id); } catch {}
    let ch = row ? guild.channels.cache.get(row.channel_id) : null;
    if (ch) return ch;
    ch = guild.channels.cache.find((c) => c.type === 0 && [OLD_CHANNEL, archiveName('fr'), archiveName('en')].includes(c.name));
    if (!ch) {
        try {
            let cat = guild.channels.cache.find((c) => c.type === 4 && [ARCHIVE_CATEGORY, OLD_CATEGORY].includes(c.name));
            if (!cat) cat = await guild.channels.create({ name: ARCHIVE_CATEGORY, type: 4, permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.SendMessages] }] });
            ch = await guild.channels.create({
                name: archiveName(lang), type: 0, parent: cat.id, topic: T(lang, 'archiveTopic'),
                permissionOverwrites: [{ id: guild.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory], deny: [PermissionsBitField.Flags.SendMessages] }],
            });
        } catch (e) { console.error('[PIN] archive channel:', e.message); return null; }
    }
    try { d?.prepare('INSERT OR REPLACE INTO pin_archive (guild_id, channel_id) VALUES (?, ?)').run(guild.id, ch.id); } catch {}
    return ch;
}

// ─── cards ───
function archiveCard(lang, m, by, where, unpinnedBy = null) {
    const img = [...m.attachments.values()].find((a) => /^image\//.test(a.contentType || ''));
    const files = [...m.attachments.values()].filter((a) => a !== img);
    const text = m.content ? short(m.content, 3000) : `-# ${T(lang, 'noText')}`;
    const items = [
        { text: `-# ${icon('pin', where)} ${T(lang, 'archiveTitle')} · <#${m.channel.id}>\n**${short(m.member?.displayName || m.author.globalName || m.author.username, 60)}** · <t:${Math.floor(m.createdTimestamp / 1000)}:f>` },
        { rule: true },
        { text },
    ];
    if (img) items.push({ media: [img.url, short(m.content || 'image', 200)] });
    if (files.length) items.push({ text: files.slice(0, 5).map((a, i) => `[${short(a.name || `file ${i + 1}`, 40)}](${a.url})`).join(' · ') });
    items.push({ text: `-# ${unpinnedBy ? T(lang, 'unpinnedBy', { user: unpinnedBy }) : T(lang, 'pinnedBy', { user: by, when: `<t:${Math.floor(Date.now() / 1000)}:R>` })}` });
    const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(m.url).setLabel(T(lang, 'jump')));
    if (!unpinnedBy) row.addComponents(new ButtonBuilder().setCustomId(`pin:unpin:${m.channel.id}:${m.id}`).setLabel(T(lang, 'unpin')).setStyle(ButtonStyle.Secondary));
    items.push({ row });
    return v2.card(unpinnedBy ? 0x888780 : GOLD, items);
}
const note = (color, text) => v2.card(color, [{ text }]);

// The message replied to, or the ID given (this channel only: the old code fetched every channel of the server one by one)
async function target(message, args) {
    const id = message.reference?.messageId || (/^\d{17,20}$/.test(args[0] || '') ? args[0] : null);
    if (!id) return null;
    return message.channel.messages.fetch(id).catch(() => null);
}

async function pin(client, message, args, lang) {
    const m = await target(message, args);
    if (!m) return message.reply(note(0x888780, T(lang, 'howTo'))).catch(() => {});
    if (m.pinned) return message.reply(note(0xEF9F27, T(lang, 'alreadyPinned'))).catch(() => {});
    try { await m.pin(); }
    catch (e) {
        if (e.code === 30003) return message.reply(note(0xE24B4A, T(lang, 'limit'))).catch(() => {});
        if (e.code === 50013) return message.reply(note(0xE24B4A, T(lang, 'noBotPerm'))).catch(() => {});
        console.error('[PIN] pin:', e.message);
        return message.reply(note(0xE24B4A, T(lang, 'failed'))).catch(() => {});
    }
    savePin(client.db, m, message.author);
    const archive = await findArchiveChannel(client.db, message.guild, lang);
    const archived = archive ? !!(await archive.send(archiveCard(lang, m, `<@${message.author.id}>`, archive)).catch(() => null)) : false;
    console.log(`[PIN] ${message.author.username} pinned ${m.id} in #${message.channel.name}`);
    return message.reply(note(0x2ECC71, `${icon('ok', message)} ${archived ? T(lang, 'pinnedArchived', { channel: `<#${archive.id}>` }) : T(lang, 'pinned')}\n-# ${T(lang, 'count', { n: archivedCount(client.db, message.guild.id) })} · ${T(lang, 'unpinTip')}`)).catch(() => {});
}

async function unpin(client, message, args, lang) {
    const m = await target(message, args);
    if (!m) return message.reply(note(0x888780, T(lang, 'howToUnpin'))).catch(() => {});
    if (!m.pinned) return message.reply(note(0xEF9F27, T(lang, 'notPinned'))).catch(() => {});
    const ok = await m.unpin().then(() => true).catch(() => false);
    if (ok) forget(client.db, m.id);
    return message.reply(note(ok ? 0x2ECC71 : 0xE24B4A, ok ? `${icon('ok', message)} ${T(lang, 'unpinned')}` : T(lang, 'failed'))).catch(() => {});
}

async function list(message, lang) {
    const pins = await message.channel.messages.fetchPinned().catch(() => null);
    if (!pins) return message.reply(note(0xE24B4A, T(lang, 'failed'))).catch(() => {});
    if (!pins.size) return message.reply(note(0x888780, `${T(lang, 'none')}\n-# ${T(lang, 'howTo')}`)).catch(() => {});
    const lines = [...pins.values()].sort((a, b) => b.createdTimestamp - a.createdTimestamp).slice(0, 15)
        .map((m) => `**${short(m.member?.displayName || m.author.username, 30)}** · ${short((m.content || T(lang, 'noText')).replace(/\s+/g, ' '), 70)} · [${T(lang, 'jump')}](${m.url})`);
    return message.reply(v2.card(GOLD, [
        { text: `### ${icon('pin', message)} ${T(lang, 'listTitle', { channel: `#${message.channel.name}`, n: pins.size })}` },
        { rule: true },
        { text: lines.join('\n') + (pins.size > 15 ? `\n-# ${T(lang, 'more', { n: pins.size - 15 })}` : '') },
    ])).catch(() => {});
}

// Archive cards: pin:unpin:<channel>:<message> (and the old unpin_<message>)
async function handleComponent(ix, client) {
    const lang = langOf(client, ix.guildId, ix, ix.user.id);
    if (!canManage(ix.member)) return ix.reply({ content: T(lang, 'noPermission'), flags: MessageFlags.Ephemeral }).catch(() => {});
    let channelId, messageId;
    if (ix.customId.startsWith('pin:unpin:')) [, , channelId, messageId] = ix.customId.split(':');
    else {
        messageId = ix.customId.slice('unpin_'.length);
        try { channelId = client.db.prepare('SELECT channel_id FROM pinned_messages WHERE message_id = ?').get(messageId)?.channel_id; } catch {}
    }
    const ch = channelId ? ix.guild?.channels.cache.get(channelId) : null;
    const m = ch ? await ch.messages.fetch(messageId).catch(() => null) : null;
    if (m?.pinned) await m.unpin().catch(() => {});
    forget(client.db, messageId);
    if (m && ix.message?.flags?.has?.(MessageFlags.IsComponentsV2)) {
        return ix.update(archiveCard(lang, m, null, ix, `<@${ix.user.id}>`)).catch(() => ix.reply({ content: T(lang, 'unpinned'), flags: MessageFlags.Ephemeral }).catch(() => {}));
    }
    // an old embed card, or the message is gone: say it, and take the button away
    await ix.update({ components: [] }).catch(() => {});
    return ix.followUp({ content: m ? T(lang, 'unpinned') : T(lang, 'gone'), flags: MessageFlags.Ephemeral }).catch(() => {});
}

module.exports = {
    name: 'pin',
    aliases: ['unpin', 'pins', 'archives', 'fix', 'archive', 'save'],
    description: 'Pin a message and keep a copy in the pin archive (reply to it with .pin)',
    category: 'UTILITY',
    usage: '.pin (reply to a message) · .unpin · .pins',
    examples: ['.pin', '.unpin', '.pins'],
    cooldown: 3000,
    handleComponent,

    run: async (client, message, args, db, serverSettings, usedCommand) => {
        if (!message.guild) return;
        const lang = langOf(client, message.guild.id, message, message.author.id);
        const used = String(usedCommand || '').toLowerCase();
        if (used === 'pins' || used === 'archives') return list(message, lang);
        if (!canManage(message.member)) return message.reply(note(0xE24B4A, T(lang, 'noPermission'))).catch(() => {});
        if (used === 'unpin') return unpin(client, message, args, lang);
        return pin(client, message, args, lang);
    },
};
