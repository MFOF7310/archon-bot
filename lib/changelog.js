'use strict';
// lib/changelog.js — ARCHON's release notes, one source for everything:
//   /changelog (card + menu of earlier versions), the post in each server's updates channel when a new version
//   boots, Lydia's "recent changes" and the updater's "What's new".
// The notes live in config/changelog.json, written for members in plain words (never raw commit titles:
// those are developer talk and can describe security fixes).
const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { card } = require('./games/v2');
const { t } = require('./i18n');
let EMOJIS = {}; try { EMOJIS = require('../config/emojis'); } catch {}
const em = (k, fb) => EMOJIS[k] || fb;

const FILE = path.join(__dirname, '..', 'config', 'changelog.json');
const DASHBOARD = 'https://bamako-steel-dev.xyz';
const SUPPORT = 'https://discord.gg/NFSMFJajp9';
const LOCALE = { en: 'en-GB', fr: 'fr-FR', zh: 'zh-CN', ar: 'ar', bm: 'en-GB' };
const SECTIONS = [['new', 'hubSparkle', '✨'], ['improved', 'progress', '📈'], ['fixed', 'check', '🔧']];

// Read once, again only when the file changes (a deploy), never on every message
let cache = [], stamp = 0;
function releases() {
    try {
        const m = fs.statSync(FILE).mtimeMs;
        if (m !== stamp) { cache = JSON.parse(fs.readFileSync(FILE, 'utf8')).releases || []; stamp = m; }
    } catch (e) { if (!stamp) console.error('[CHANGELOG] config/changelog.json:', e.message); }
    return cache;
}
const latest = () => releases()[0] || null;
const find = (v) => releases().find((r) => r.version === String(v)) || null;
const line = (item, lang) => (item && (item[lang] || item.en)) || '';
const _ = (lang) => (k, v) => t('changelog.' + k, lang, v || {});
function day(iso, lang) {
    try { return new Date(iso + 'T12:00:00Z').toLocaleDateString(LOCALE[lang] || 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }); }
    catch { return iso; }
}

// The card. `owner` = who may switch versions in place ('0' for a channel post: everyone gets a private copy)
function view(release, lang, owner = '0', { posted = false } = {}) {
    const s = _(lang);
    const rel = release || latest();
    if (!rel) return card(0x378ADD, [{ text: s('none') }]);
    const items = [{ text: `## ${em('notification', '📣')} ${s('title')}\n-# ${s('version', { v: rel.version, date: day(rel.date, lang) })}` }, { rule: true }];
    const body = SECTIONS.filter(([k]) => (rel[k] || []).length)
        .map(([k, ek, fb]) => `**${em(ek, fb)} ${s(k)}**\n${rel[k].map((i) => `- ${line(i, lang)}`).join('\n')}`);
    items.push({ text: body.join('\n\n') });
    if (posted) items.push({ text: `-# ${s('posted')}` });
    items.push({ rule: true });

    const older = releases().slice(0, 25);
    if (older.length > 1) {
        items.push({ row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`chg:v:${owner}`).setPlaceholder(s('older'))
            .addOptions(older.map((r) => ({ label: `v${r.version}`, description: day(r.date, lang), value: r.version, default: r.version === rel.version })))) });
    }
    items.push({ row: new ActionRowBuilder().addComponents(
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(DASHBOARD).setLabel(s('dashboard')).setEmoji(em('ic_dashboard', em('dashboard', '🌐'))),
        new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(SUPPORT).setLabel(s('support')).setEmoji(em('ic_system', '🛟'))) });
    return card(0x378ADD, items);
}

// Plain text of one release (updater DM, Lydia). `version` may also be a release object (fetched from GitHub).
function plain(version, lang = 'en', max = 1000) {
    const rel = version && typeof version === 'object' ? version : (version ? find(version) : latest());
    if (!rel) return '';
    const s = _(lang);
    return SECTIONS.filter(([k]) => (rel[k] || []).length)
        .map(([k]) => `${s(k)}${lang === 'fr' ? ' :' : ':'}\n${rel[k].map((i) => `• ${line(i, lang)}`).join('\n')}`).join('\n').slice(0, max);
}

// What Lydia knows about recent changes: the two latest releases, in English (she answers in the member's language)
function forAI() {
    const rs = releases().slice(0, 2);
    if (!rs.length) return 'No release notes yet.';
    return rs.map((r) => `v${r.version} (${r.date}):\n${plain(r.version, 'en', 900)}`).join('\n\n');
}

// Menu of earlier versions. The one who opened /changelog changes their card; anyone else (and every
// channel post) gets a private copy, so a public message never changes under other members' eyes.
async function handleComponent(interaction, client) {
    const [, , owner] = interaction.customId.split(':');
    const rel = find(interaction.values?.[0]) || latest();
    let lang = 'en';
    try { lang = require('./pick-lang').pickLang(client, interaction.guildId, interaction); } catch {}
    if (owner !== '0' && owner === interaction.user.id) return interaction.update(view(rel, lang, owner));
    const mine = view(rel, lang, interaction.user.id);
    return interaction.reply({ ...mine, flags: mine.flags | 64 });
}

// After a deploy: post the new version once in every server that picked an updates channel
// (Dashboard › General › Updates channel, or /channels). Nothing is posted where none is set.
async function announce(client) {
    const db = client.db;
    const rel = latest();
    if (!db || !rel) return 0;
    const get = (k) => db.prepare('SELECT value FROM bot_meta WHERE key = ?').get(k)?.value;
    if (get('changelog_posted') === rel.version) return 0;
    // Marked first: a crash halfway must never post the same version twice
    db.prepare('INSERT OR REPLACE INTO bot_meta (key, value) VALUES (?, ?)').run('changelog_posted', rel.version);

    let rows = [];
    try { rows = db.prepare("SELECT guild_id, updates_channel FROM server_settings WHERE updates_channel IS NOT NULL AND updates_channel != ''").all(); } catch {}
    const { pickLang } = require('./pick-lang');
    let sent = 0;
    for (const r of rows) {
        const guild = client.guilds.cache.get(r.guild_id);
        if (!guild) continue;
        const ch = await guild.channels.fetch(r.updates_channel).catch(() => null);
        if (!ch?.isTextBased?.() || ch.guildId !== guild.id) continue;
        try {
            const d = require('./canPost').diagnose(guild, ch, guild.members.me);
            if (d && d.ok === false) { console.log(`[CHANGELOG] ${guild.name}: can't post in #${ch.name} (${d.reason})`); continue; }
        } catch {}
        let lang = 'en';
        try { lang = pickLang(client, guild.id, null); } catch {}
        await ch.send(view(rel, lang, '0', { posted: true })).then(() => sent++).catch((e) => console.log(`[CHANGELOG] ${guild.name}: ${e.message}`));
        await new Promise((res) => setTimeout(res, 1200));
    }
    console.log(`[CHANGELOG] v${rel.version} posted in ${sent} server(s)`);
    return sent;
}

module.exports = { releases, latest, find, view, plain, forAI, handleComponent, announce };
