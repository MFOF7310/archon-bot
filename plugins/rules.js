'use strict';
// /rules — the server's rules as one gold card.
//   show      the card, privately, for whoever asks (accept and translate buttons included)
//   panel     posts the card in the rules channel (/channels), or updates the one already there
//   edit      a multi-line box (up to 4000 characters), filled with the current rules or what #rules already says
//   settings  a private card: role given on accept, card colour, who accepted
// One rule per line; "Name: details" puts the name in bold; a line starting with # is a section heading.
// Rules are numbered with ARCHON's number icons (ic_num_1…9), then plain numbers.
// Saving updates the posted panel in place. "Read in my language" has Archon AI translate the rules privately;
// each language is translated once per version of the rules and kept.
// Buttons, menus and the box use rules:… ids routed from index.js; old panels (rules_accept_<id>) still work.
// Words: lang/<locale>/rules.json.
const crypto = require('crypto');
const {
    SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, PermissionFlagsBits,
    ModalBuilder, TextInputBuilder, TextInputStyle, RoleSelectMenuBuilder, StringSelectMenuBuilder,
} = require('discord.js');
const v2 = require('../lib/games/v2');
const { icon } = require('../lib/ui/icons');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

const GOLD = 0xE6A817;
const GREY = 0x4E5058;
const V2 = MessageFlags.IsComponentsV2;
const EPH = MessageFlags.Ephemeral;
const COLORS = { gold: '#E6A817', blue: '#378ADD', green: '#23A55A', red: '#E74C3C', purple: '#7F77DD', teal: '#1D9E75', orange: '#D85A30', grey: '#4E5058' };
const LANG_NAME = { en: 'English', fr: 'French', zh: 'Simplified Chinese', ar: 'Arabic', bm: 'Bambara' };

const L = (lang) => (k, v) => t(`rules.${k}`, lang, v || {});
const langOf = (client, gid, ix, uid) => pickLang(client, gid, ix || null, uid) || 'en';
const isAdmin = (member) => !!member?.permissions?.has(PermissionFlagsBits.ManageGuild);
const colorOf = (row) => { const n = parseInt(String(row.color || '').replace('#', ''), 16); return Number.isFinite(n) ? n : GOLD; };

// ─── storage ───
let ready = false;
function ensure(db) {
    if (ready) return;
    db.prepare('CREATE TABLE IF NOT EXISTS server_rules (guild_id TEXT PRIMARY KEY, rules_text TEXT, updated_at INTEGER)').run();
    const cols = db.prepare('PRAGMA table_info(server_rules)').all().map((c) => c.name);
    for (const [c, type] of [['color', 'TEXT'], ['title', 'TEXT'], ['welcome_on', 'INTEGER DEFAULT 1'], ['accept_role_id', 'TEXT'], ['panel_channel_id', 'TEXT'], ['panel_message_id', 'TEXT']]) {
        if (!cols.includes(c)) db.prepare(`ALTER TABLE server_rules ADD COLUMN ${c} ${type}`).run();
    }
    db.prepare('CREATE TABLE IF NOT EXISTS rules_acceptance (guild_id TEXT NOT NULL, user_id TEXT NOT NULL, accepted_at INTEGER NOT NULL, PRIMARY KEY (guild_id, user_id))').run();
    db.prepare('CREATE TABLE IF NOT EXISTS rules_translations (guild_id TEXT NOT NULL, lang TEXT NOT NULL, hash TEXT NOT NULL, text TEXT NOT NULL, PRIMARY KEY (guild_id, lang))').run();
    ready = true;
}
function getRow(db, gid) { ensure(db); return db.prepare('SELECT * FROM server_rules WHERE guild_id = ?').get(gid) || {}; }
function save(db, gid, patch) {
    ensure(db);
    const keys = Object.keys(patch);
    db.prepare(`INSERT INTO server_rules (guild_id, ${keys.join(', ')}, updated_at) VALUES (?, ${keys.map(() => '?').join(', ')}, ?)
        ON CONFLICT(guild_id) DO UPDATE SET ${keys.map((k) => `${k} = excluded.${k}`).join(', ')}, updated_at = excluded.updated_at`)
        .run(gid, ...keys.map((k) => patch[k]), Math.floor(Date.now() / 1000));
    if ('rules_text' in patch) { try { require('../lib/rules-text').forget(gid); } catch { /* Archon AI reads it later */ } }
}
const acceptedCount = (db, gid) => { try { return db.prepare('SELECT COUNT(*) AS n FROM rules_acceptance WHERE guild_id = ?').get(gid).n; } catch { return 0; } };
const hasAccepted = (db, gid, uid) => { try { return !!db.prepare('SELECT 1 FROM rules_acceptance WHERE guild_id = ? AND user_id = ?').get(gid, uid); } catch { return false; } };

function rulesChannel(client, guild) {
    const s = client.getServerSettings?.(guild.id) || {};
    const id = s.rulesChannel || s.rules_channel || (guild.id === process.env.GUILD_ID ? process.env.RULES_CHANNEL_ID : null) || guild.rulesChannelId;
    return id ? guild.channels.cache.get(String(id)) || null : null;
}

// ─── icons in the text: :ic_shield: becomes ARCHON's icon of that name (config/emojis.js) ───
// Unknown names stay as typed. Icons ARCHON can't use in that channel fall back to nothing, never a broken :name:.
const SUGGESTED = ['ic_shield', 'ic_flag', 'ic_gavel', 'ic_lock', 'ic_warn', 'ic_bell', 'ic_users', 'ic_ticket', 'ic_link', 'ic_games', 'ic_crown', 'ic_heal'];
function withIcons(text, where) {
    let E = {};
    try { E = require('../config/emojis'); } catch { return text; }
    let usable = () => true;
    try { usable = require('../lib/emoji-check').usable; } catch { /* trust them */ }
    return String(text).replace(/(?<!<a?):([A-Za-z0-9_]{2,32}):(?!\d)/g, (all, key) => {
        const v = E[key];
        if (typeof v !== 'string' || !v) return all;
        return /^<a?:\w+:\d+>$/.test(v) && !usable(v) ? '' : v;
    });
}

// ─── the text ───
// "Name: details" → **Name** · details; "# Heading" → a heading; "-# note" stays a small note. Numbers 1–9 use the icons.
// The number shown is the one the owner wrote: when the text numbers its rules ("5. …"), only those lines get a number,
// and every other line (an intro, a second line of a rule, a sanction note) is shown as it is. It used to count every
// line, so the owner's rule 5 came out as 6 or 7.
// Text with no numbers at all: each line is a rule, numbered in order; "- …" lines are sub-points under the rule above
// (unless every line is a "- …" line: then those are the rules).
const NUMBERED = /^(\d{1,3})[.)]\s+/;
const BULLET = /^[-*•]\s+/;
function format(text, where) {
    const lines = String(text || '').split('\n').map((raw) => raw.trim()).filter(Boolean);
    const isRule = (l) => !/^#{1,3}\s/.test(l) && !/^-#\s/.test(l);
    const ownNumbers = lines.some((l) => NUMBERED.test(l));
    const allBullets = !ownNumbers && lines.filter(isRule).every((l) => BULLET.test(l));
    const nameIt = (body) => { const m = /^([^:*_`<>]{2,40}):\s+(.+)$/.exec(body); return m ? `**${m[1].trim()}** · ${m[2]}` : body; };
    const numIcon = (k) => (k >= 1 && k <= 9 ? icon(`num_${k}`, where) : `**${k}.**`);
    let n = 0;
    return lines.map((line) => {
        if (/^#{1,3}\s/.test(line)) return `\n### ${line.replace(/^#{1,3}\s+/, '')}`;
        if (/^-#\s/.test(line)) return line;
        if (ownNumbers) {
            const m = NUMBERED.exec(line);
            if (!m) return BULLET.test(line) ? `• ${line.replace(BULLET, '')}` : line;   // intro, second line, note: no number
            return `${numIcon(Number(m[1]))} ${nameIt(line.replace(NUMBERED, ''))}`;
        }
        if (BULLET.test(line) && !allBullets) return `• ${line.replace(BULLET, '')}`;   // a sub-point of the rule above
        n += 1;
        return `${numIcon(n)} ${nameIt(line.replace(BULLET, ''))}`;
    }).join('\n').trim();
}
const render = (text, where) => format(withIcons(text, where), where);

function card(client, guild, row, lang, { where, text, viewer, translatedTo } = {}) {
    const tr = L(lang);
    const body = text ?? row.rules_text;
    const title = row.title || tr('title');
    if (!body || !String(body).trim()) {
        return v2.card(GREY, [
            { text: `### ${icon('ch_rules', where)} ${title}\n${tr('notConfigured')}` },
            { text: `-# ${tr('editHint')}` },
        ]);
    }
    const head = `## ${icon('gavel', where)} ${title}\n-# ${translatedTo ? tr('translatedNote', { language: translatedTo }) : tr('sub')}`;
    const items = [
        guild.iconURL() ? { thumbnail: [head, guild.iconURL({ extension: 'png', size: 128 })] } : { text: head },
        { rule: true },
        { text: render(body, where) },
    ];
    if (translatedTo) return v2.card(colorOf(row), items);
    items.push({ rule: true });
    const foot = [];
    if (row.accept_role_id) foot.push(`${icon('users', where)} ${tr('acceptedCount', { n: acceptedCount(client.db, guild.id) })}`);
    if (row.updated_at) foot.push(tr('updated', { when: `<t:${row.updated_at}:R>` }));
    if (foot.length) items.push({ text: `-# ${foot.join(' · ')}` });
    const buttons = new ActionRowBuilder();
    if (row.accept_role_id) {
        const done = viewer && hasAccepted(client.db, guild.id, viewer);
        buttons.addComponents(new ButtonBuilder().setCustomId('rules:accept').setStyle(done ? ButtonStyle.Secondary : ButtonStyle.Success)
            .setLabel(done ? tr('btnAccepted') : tr('btnAccept')).setEmoji(icon('check', where)).setDisabled(!!done));
    }
    buttons.addComponents(new ButtonBuilder().setCustomId('rules:tr').setStyle(ButtonStyle.Secondary).setLabel(tr('btnTranslate')).setEmoji(icon('language', where)));
    items.push({ row: buttons });
    return v2.card(colorOf(row), items);
}

// The posted panel: edited in place when it still exists
async function refreshPanel(client, guild, { post = false } = {}) {
    const db = client.db;
    const row = getRow(db, guild.id);
    const lang = langOf(client, guild.id, null, null);
    let ch = row.panel_channel_id ? guild.channels.cache.get(String(row.panel_channel_id)) : null;
    let msg = ch && row.panel_message_id ? await ch.messages.fetch(String(row.panel_message_id)).catch(() => null) : null;
    if (msg) { await msg.edit({ ...card(client, guild, row, lang, { where: ch }), flags: V2, allowedMentions: { parse: [] } }); return { ch, edited: true }; }
    if (!post) return null;
    ch = rulesChannel(client, guild);
    if (!ch?.isTextBased?.()) return { missing: true };
    msg = await ch.send({ ...card(client, guild, row, lang, { where: ch }), allowedMentions: { parse: [] } });
    save(db, guild.id, { panel_channel_id: ch.id, panel_message_id: msg.id });
    return { ch, edited: false };
}

// accepted-count on the panel: refreshed at most once a minute, not on every click
const pending = new Map();
function refreshSoon(client, guild) {
    if (pending.has(guild.id)) return;
    pending.set(guild.id, setTimeout(() => { pending.delete(guild.id); refreshPanel(client, guild).catch(() => {}); }, 60 * 1000));
}

// ─── private screens ───
function editModal(tr, title, text) {
    const name = new TextInputBuilder().setCustomId('title').setLabel(tr('modalName').slice(0, 45))
        .setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false);
    const body = new TextInputBuilder().setCustomId('text').setLabel(tr('modalRules').slice(0, 45))
        .setStyle(TextInputStyle.Paragraph).setMaxLength(4000).setRequired(true).setPlaceholder(tr('modalPlaceholder').slice(0, 100));
    // a pre-filled value can't be empty, so only set it when there is one
    if (title) name.setValue(String(title).slice(0, 100));
    if (text) body.setValue(String(text).slice(0, 4000));
    return new ModalBuilder().setCustomId('rules:save').setTitle(tr('modalTitle').slice(0, 45))
        .addComponents(new ActionRowBuilder().addComponents(name), new ActionRowBuilder().addComponents(body));
}

function settingsCard(client, guild, lang, where) {
    const tr = L(lang);
    const row = getRow(client.db, guild.id);
    const role = row.accept_role_id ? guild.roles.cache.get(String(row.accept_role_id)) : null;
    const colorName = Object.entries(COLORS).find(([, h]) => h.toLowerCase() === String(row.color || COLORS.gold).toLowerCase())?.[0] || 'gold';
    const lines = [
        role ? tr('settingsRole', { role: `<@&${role.id}>` }) : tr('settingsNoRole'),
        tr('settingsColor', { color: tr(`color_${colorName}`) }),
        tr('acceptedCount', { n: acceptedCount(client.db, guild.id) }),
    ];
    const shown = SUGGESTED.map((k) => { const e = withIcons(`:${k}:`, where); return e && e !== `:${k}:` ? `${e} \`:${k}:\`` : null; }).filter(Boolean);
    return v2.card(colorOf(row), [
        { text: `### ${icon('tool', where)} ${tr('settingsTitle')}\n${lines.join('\n')}` },
        ...(shown.length ? [{ rule: true }, { text: `${tr('iconsHint')}\n${shown.join('  ')}` }] : []),
        { row: new ActionRowBuilder().addComponents(new RoleSelectMenuBuilder().setCustomId('rules:role').setPlaceholder(tr('pickRole')).setMinValues(0).setMaxValues(1)) },
        { row: new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('rules:color').setPlaceholder(tr('pickColor'))
            .addOptions(Object.keys(COLORS).map((k) => ({ label: tr(`color_${k}`), value: k, default: k === colorName })))) },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rules:who').setStyle(ButtonStyle.Secondary).setLabel(tr('btnWho')).setEmoji(icon('users', where)),
            new ButtonBuilder().setCustomId('rules:norole').setStyle(ButtonStyle.Secondary).setLabel(tr('btnNoRole')).setEmoji(icon('x', where)).setDisabled(!role),
            new ButtonBuilder().setCustomId('rules:ai').setStyle(ButtonStyle.Primary).setLabel(tr('btnAi')).setEmoji(icon('brain', where)),
        ) },
    ]);
}

// ─── translation (Archon AI), kept per language and version ───
const trBusy = new Map();
async function translated(client, gid, text, lang) {
    const db = client.db;
    const hash = crypto.createHash('sha1').update(String(text)).digest('hex').slice(0, 16);
    const hit = db.prepare('SELECT text FROM rules_translations WHERE guild_id = ? AND lang = ? AND hash = ?').get(gid, lang, hash);
    if (hit) return hit.text;
    const { generateAIResponse } = require('../lib/lydia/models');
    const system = `Translate these Discord server rules into ${LANG_NAME[lang] || 'English'}. Keep one rule per line, the same order, `
        + 'the "Name: details" shape, headings starting with #, and every <#…>, <@&…>, <@…> and <:…:…> exactly as they are. '
        + 'Output only the translated rules, nothing before or after.';
    const res = await generateAIResponse(system, String(text), [], null, undefined, gid);
    const out = String(res?.content || '').trim();
    if (!out) return null;
    db.prepare('INSERT OR REPLACE INTO rules_translations (guild_id, lang, hash, text) VALUES (?, ?, ?, ?)').run(gid, lang, hash, out);
    return out;
}

// ─── rules drafted by Archon AI (/rules settings → Write with AI) ───
// The owner says what kind of server it is, how strict, and what to include. The draft is shown privately with the real
// card layout; nothing is saved until they press Save (or change it in the edit box first). Plain text only: no code
// blocks, no ANSI or diff (most members read Discord on a phone), and only icon codes from SUGGESTED.
const drafts = new Map();   // `${guild}:${user}` → { text, at }
const aiBusy = new Map();
const DRAFT_MS = 20 * 60 * 1000;

function aiModal(tr) {
    const kind = new TextInputBuilder().setCustomId('kind').setLabel(tr('aiKind').slice(0, 45)).setStyle(TextInputStyle.Short)
        .setMaxLength(100).setRequired(true).setPlaceholder(tr('aiKindPh').slice(0, 100));
    const tone = new TextInputBuilder().setCustomId('tone').setLabel(tr('aiTone').slice(0, 45)).setStyle(TextInputStyle.Short)
        .setMaxLength(40).setRequired(false).setPlaceholder(tr('aiTonePh').slice(0, 100));
    const extra = new TextInputBuilder().setCustomId('extra').setLabel(tr('aiExtra').slice(0, 45)).setStyle(TextInputStyle.Paragraph)
        .setMaxLength(1000).setRequired(false).setPlaceholder(tr('aiExtraPh').slice(0, 100));
    return new ModalBuilder().setCustomId('rules:aigen').setTitle(tr('aiModalTitle').slice(0, 45))
        .addComponents(...[kind, tone, extra].map((x) => new ActionRowBuilder().addComponents(x)));
}

// the model's answer, cleaned: no code fences or ANSI, icon codes outside the list removed, channel links kept only for
// this server's real channels, rules numbered 1, 2, 3…
function cleanDraft(raw, channelIds = new Set()) {
    let n = 0;
    return String(raw || '')
        .replace(/```[a-z]*\n?/gi, '').replace(/\u001b\[[0-9;]*m/g, '').replace(/\[[0-9;]{1,8}m/g, '')
        .replace(/:([A-Za-z0-9_]{2,32}):/g, (all, k) => (SUGGESTED.includes(k) ? all : ''))
        .replace(/<#(\d{17,20})>/g, (all, id) => (channelIds.has(id) ? all : ''))
        .replace(/<@[&!]?\d{17,20}>/g, '')
        .split('\n').map((l) => l.replace(/\s+$/, '').replace(/\s{2,}/g, ' ').trim())
        .filter((l, i, a) => l || (i > 0 && a[i - 1]))
        .map((l) => (NUMBERED.test(l) ? `${++n}. ${l.replace(NUMBERED, '')}` : l))
        .join('\n').trim().slice(0, 3800);
}

// What the model is given: the owner's answers, the rules the server already has (to rewrite, not replace with
// invented ones), and the server's real text channels (the only ones it may link). No numbers it wasn't given.
function textChannels(guild) {
    return [...guild.channels.cache.values()]
        .filter((c) => [0, 5, 15].includes(c.type) && c.permissionsFor?.(guild.roles.everyone)?.has?.(PermissionFlagsBits.ViewChannel) !== false)
        .sort((a, b) => (a.rawPosition ?? 0) - (b.rawPosition ?? 0))
        .slice(0, 40);
}

async function draftRules(client, guild, { kind, tone, extra }) {
    const { generateAIResponse } = require('../lib/lydia/models');
    const serverLang = langOf(client, guild.id, null, null);
    const chans = textChannels(guild);
    let current = '';
    try { current = getRow(client.db, guild.id).rules_text || (await require('../lib/rules-text').get(client, guild))?.text || ''; } catch { current = ''; }
    current = String(current).slice(0, 2500);
    const system = `You write the rules of a Discord server, in ${LANG_NAME[serverLang] || 'English'}. Output only the rules: no intro, `
        + 'no closing sentence, no code blocks, no ANSI, no diff, no tables, no bold or italics.\n'
        + 'Format, one item per line:\n'
        + '- a section heading: "# Heading" (2 or 3 sections at most)\n'
        + '- a rule: "<number>. <Short name>: <one clear sentence>". Number the rules 1, 2, 3… straight through all sections. '
        + 'Never write a rule on two lines.\n'
        + '- at the very end, one line "-# <note>" saying what happens when a rule is broken.\n'
        + `Between 6 and 10 rules, under 1800 characters. You may put one icon code right after a rule's colon, only from this list: ${SUGGESTED.map((k) => `:${k}:`).join(' ')}. Never write any other code.\n`
        + 'Sentences are plain, friendly and firm, written for the members. Include respect, no spam or ads, and following Discord\'s Terms of Service.\n'
        + 'Channels: when a rule is about a channel from the list below, write it exactly as its <#id> code. Never name or invent a channel that is not in the list; '
        + 'if none fits, say it in words ("the scrims channel").\n'
        + 'Facts: never invent numbers or details the owner did not give: no ban or mute durations, no minimum age, no times, no warning counts. '
        + 'Sanctions stay general ("a warning, then an exclusion") unless the owner wrote them.\n'
        + 'Current rules: when the server already has rules, keep everything they say (their points, numbers and channels), rewrite them clearly in this format, '
        + 'and only add what the owner asked for or what is clearly missing (respect, spam, Terms of Service).';
    const ask = `Server name: ${guild.name}\nKind of server: ${kind}\nHow strict: ${tone || 'normal'}\nPoints the owner wants: ${extra || 'none'}\n`
        + `Text channels:\n${chans.length ? chans.map((c) => `- #${c.name} = <#${c.id}>`).join('\n') : '(none)'}\n`
        + `Current rules:\n${current.trim() || '(none yet)'}`;
    const res = await generateAIResponse(system, ask, [], null, undefined, guild.id);
    return cleanDraft(res?.content, new Set(chans.map((c) => c.id)));
}

function draftCard(client, guild, lang, where, text) {
    const tr = L(lang);
    const row = getRow(client.db, guild.id);
    return v2.card(colorOf(row), [
        { text: `## ${icon('gavel', where)} ${tr('aiPreviewTitle')}\n-# ${tr('aiPreviewSub')}` },
        { rule: true },
        { text: render(text, where) },
        { rule: true },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('rules:aisave').setStyle(ButtonStyle.Success).setLabel(tr('btnAiSave')).setEmoji(icon('check', where)),
            new ButtonBuilder().setCustomId('rules:aiedit').setStyle(ButtonStyle.Secondary).setLabel(tr('btnAiEdit')).setEmoji(icon('tool', where)),
            new ButtonBuilder().setCustomId('rules:ai').setStyle(ButtonStyle.Secondary).setLabel(tr('btnAiRetry')).setEmoji(icon('refresh', where)),
        ) },
    ]);
}

// ─── buttons, menus, the box ───
async function accept(interaction, client) {
    const db = client.db;
    const guild = interaction.guild;
    const tr = L(langOf(client, guild.id, interaction, interaction.user.id));
    const row = getRow(db, guild.id);
    if (hasAccepted(db, guild.id, interaction.user.id)) return interaction.reply({ content: tr('alreadyAccepted'), flags: EPH });
    const role = row.accept_role_id ? guild.roles.cache.get(String(row.accept_role_id)) : null;
    if (role) {
        if (!role.editable) return interaction.reply({ content: tr('roleTooHigh'), flags: EPH });
        const member = await guild.members.fetch(interaction.user.id).catch(() => null);
        const ok = member ? await member.roles.add(role, 'Accepted the server rules').then(() => true).catch(() => false) : false;
        if (!ok) return interaction.reply({ content: tr('acceptFailed'), flags: EPH });
    }
    db.prepare('INSERT OR IGNORE INTO rules_acceptance (guild_id, user_id, accepted_at) VALUES (?, ?, ?)').run(guild.id, interaction.user.id, Math.floor(Date.now() / 1000));
    refreshSoon(client, guild);
    return interaction.reply({ content: `${icon('ok', interaction)} ${tr('acceptDone')}`, flags: EPH, allowedMentions: { parse: [] } });
}

async function handleComponent(interaction, client) {
    const db = client.db;
    const guild = interaction.guild;
    if (!guild) return;
    ensure(db);
    const lang = langOf(client, guild.id, interaction, interaction.user.id);
    const tr = L(lang);
    const id = interaction.customId;
    if (id.startsWith('rules_accept_') || id === 'rules:accept') return accept(interaction, client);

    if (id === 'rules:tr') {
        const row = getRow(db, guild.id);
        let text = row.rules_text;
        if (!text) return interaction.reply({ content: tr('notConfigured'), flags: EPH });
        const key = `${guild.id}:${interaction.user.id}`;
        if (Date.now() - (trBusy.get(key) || 0) < 15000) return interaction.reply({ content: tr('trWait'), flags: EPH });
        trBusy.set(key, Date.now());
        await interaction.deferReply({ flags: EPH });
        const out = await translated(client, guild.id, text, lang).catch((e) => { console.error('[RULES] translate:', e.message); return null; });
        if (!out) return interaction.editReply({ content: tr('trFailed') });
        return interaction.editReply({ ...card(client, guild, row, lang, { where: interaction, text: out, translatedTo: tr(`lang_${lang}`) }), flags: V2 });
    }

    if (!isAdmin(interaction.member)) return interaction.reply({ content: tr('needManageGuild'), flags: EPH });

    if (id === 'rules:ai') return interaction.showModal(aiModal(tr));
    if (id === 'rules:aigen') {
        const key = `${guild.id}:${interaction.user.id}`;
        if (Date.now() - (aiBusy.get(key) || 0) < 20000) return interaction.reply({ content: tr('aiWait'), flags: EPH });
        aiBusy.set(key, Date.now());
        await interaction.deferReply({ flags: EPH });
        const f = (k) => { try { return interaction.fields.getTextInputValue(k).trim(); } catch { return ''; } };
        const text = await draftRules(client, guild, { kind: f('kind'), tone: f('tone'), extra: f('extra') })
            .catch((e) => { console.error('[RULES] draft:', e.message); return ''; });
        aiBusy.delete(key);
        if (!text || !NUMBERED.test(text.split('\n').find((l) => NUMBERED.test(l)) || '')) return interaction.editReply({ content: tr('aiFailed') });
        drafts.set(key, { text, at: Date.now() });
        return interaction.editReply({ ...draftCard(client, guild, lang, interaction, text), flags: V2 });
    }
    if (id === 'rules:aisave' || id === 'rules:aiedit') {
        const key = `${guild.id}:${interaction.user.id}`;
        const d = drafts.get(key);
        if (!d || Date.now() - d.at > DRAFT_MS) { drafts.delete(key); return interaction.reply({ content: tr('aiExpired'), flags: EPH }); }
        if (id === 'rules:aiedit') return interaction.showModal(editModal(tr, getRow(db, guild.id).title, d.text));   // Save in the box saves it
        drafts.delete(key);
        save(db, guild.id, { rules_text: d.text });
        await interaction.deferUpdate();
        const r = await refreshPanel(client, guild).catch(() => null);
        const done = `${icon('ok', interaction)} ${r?.edited ? tr('savedPanel', { channel: `<#${r.ch.id}>` }) : tr('savedNoPanel')}`;
        // the draft card is a V2 message: it becomes a one-line V2 card (a V2 message can't go back to plain text)
        return interaction.editReply({ ...v2.card(GOLD, [{ text: done }]), flags: V2 }).catch(() => interaction.followUp({ content: done, flags: EPH }));
    }
    if (id === 'rules:save') {
        const text = interaction.fields.getTextInputValue('text').trim();
        const title = interaction.fields.getTextInputValue('title').trim() || null;
        save(db, guild.id, { rules_text: text || null, title });
        await interaction.deferReply({ flags: EPH });
        const r = await refreshPanel(client, guild).catch(() => null);
        // no icon used yet: one line saying they can (shown only then, so it never nags)
        const tip = /:[A-Za-z0-9_]{2,32}:|<a?:\w+:\d+>/.test(text) ? '' : `\n-# ${tr('iconsTip')}`;
        return interaction.editReply({ content: `${icon('ok', interaction)} ${r?.edited ? tr('savedPanel', { channel: `<#${r.ch.id}>` }) : tr('savedNoPanel')}${tip}` });
    }
    if (id === 'rules:role') {
        const roleId = interaction.values?.[0] || null;
        const role = roleId ? guild.roles.cache.get(roleId) : null;
        if (role && (!role.editable || role.managed || role.id === guild.id)) return interaction.reply({ content: tr('roleTooHigh'), flags: EPH });
        save(db, guild.id, { accept_role_id: role ? role.id : null });
        refreshPanel(client, guild).catch(() => {});
        return interaction.update({ ...settingsCard(client, guild, lang, interaction), flags: V2 });
    }
    if (id === 'rules:norole') {
        save(db, guild.id, { accept_role_id: null });
        refreshPanel(client, guild).catch(() => {});
        return interaction.update({ ...settingsCard(client, guild, lang, interaction), flags: V2 });
    }
    if (id === 'rules:color') {
        save(db, guild.id, { color: COLORS[interaction.values?.[0]] || COLORS.gold });
        refreshPanel(client, guild).catch(() => {});
        return interaction.update({ ...settingsCard(client, guild, lang, interaction), flags: V2 });
    }
    if (id === 'rules:who') {
        const rows = db.prepare('SELECT user_id, accepted_at FROM rules_acceptance WHERE guild_id = ? ORDER BY accepted_at DESC LIMIT 30').all(guild.id);
        if (!rows.length) return interaction.reply({ content: tr('acceptedEmpty'), flags: EPH });
        const list = rows.map((r, i) => `${i + 1}. <@${r.user_id}> · <t:${r.accepted_at}:R>`).join('\n');
        return interaction.reply({ content: `**${tr('acceptedTitle', { n: acceptedCount(db, guild.id) })}**\n${list}`, flags: EPH, allowedMentions: { parse: [] } });
    }
}

// ─── command ───
module.exports = {
    name: 'rules',
    aliases: ['regles', 'règles', 'qawanin'],
    description: '📜 The server rules: show, post, edit',
    category: 'SYSTEM',
    usage: '/rules show | panel | edit | settings',
    data: new SlashCommandBuilder().setName('rules').setDescription('📜 The server rules')
        .addSubcommand((s) => s.setName('show').setDescription('Show the rules (only you see them)'))
        .addSubcommand((s) => s.setName('panel').setDescription('Post or update the rules in the rules channel (admin)'))
        .addSubcommand((s) => s.setName('edit').setDescription('Write or change the rules (admin)'))
        .addSubcommand((s) => s.setName('settings').setDescription('Accept role, colour, who accepted (admin)')),

    execute: async (interaction, client) => {
        const db = client.db;
        const guild = interaction.guild;
        ensure(db);
        const lang = langOf(client, guild.id, interaction, interaction.user.id);
        const tr = L(lang);
        const sub = interaction.options.getSubcommand();

        if (sub === 'show') {
            return interaction.reply({ ...card(client, guild, getRow(db, guild.id), lang, { where: interaction, viewer: interaction.user.id }), flags: V2 | EPH });
        }
        if (!isAdmin(interaction.member)) return interaction.reply({ content: tr('needManageGuild'), flags: EPH });

        if (sub === 'edit') {
            const row = getRow(db, guild.id);
            let text = row.rules_text;
            // nothing saved yet: start from what the rules channel already says
            if (!text) { try { text = (await require('../lib/rules-text').get(client, guild))?.text || ''; } catch { text = ''; } }
            return interaction.showModal(editModal(tr, row.title, text));
        }
        if (sub === 'settings') return interaction.reply({ ...settingsCard(client, guild, lang, interaction), flags: V2 | EPH });
        if (sub === 'panel') {
            if (!getRow(db, guild.id).rules_text) return interaction.reply({ content: tr('needText'), flags: EPH });
            await interaction.deferReply({ flags: EPH });
            const r = await refreshPanel(client, guild, { post: true }).catch((e) => { console.error('[RULES] panel:', e.message); return null; });
            if (!r || r.missing) return interaction.editReply({ content: tr('channelMissing') });
            return interaction.editReply({ content: `${icon('ok', interaction)} ${r.edited ? tr('panelUpdated', { channel: `<#${r.ch.id}>` }) : tr('panelPosted', { channel: `<#${r.ch.id}>` })}` });
        }
    },

    // .rules shows the card in the channel; .rules panel posts or updates the panel
    run: async (client, message, args) => {
        const guild = message.guild;
        if (!guild) return;
        ensure(client.db);
        const lang = langOf(client, guild.id, null, message.author.id);
        const tr = L(lang);
        if ((args[0] || '').toLowerCase() === 'panel') {
            if (!isAdmin(message.member)) return message.reply(tr('needManageGuild')).catch(() => {});
            const r = await refreshPanel(client, guild, { post: true }).catch(() => null);
            return message.reply(!r || r.missing ? tr('channelMissing') : (r.edited ? tr('panelUpdated', { channel: `<#${r.ch.id}>` }) : tr('panelPosted', { channel: `<#${r.ch.id}>` }))).catch(() => {});
        }
        return message.channel.send({ ...card(client, guild, getRow(client.db, guild.id), lang, { where: message }), allowedMentions: { parse: [] } }).catch(() => {});
    },

    handleComponent,
    refreshPanel,
};
