const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { t } = require('../lib/i18n');
const ui = require('../lib/games/ui');
const v2 = require('../lib/games/v2');
const E = require('../config/emojis');
const em = (k, fb) => E[k] || fb;

const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const GOLD = 0xffd700;

let _ready = false;
function ensureTable(db) {
    if (_ready) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS server_rules (
        guild_id TEXT PRIMARY KEY,
        rules_text TEXT,
        updated_at INTEGER
    )`).run();
    const cols = db.prepare('PRAGMA table_info(server_rules)').all().map(c => c.name);
    if (!cols.includes('color')) db.prepare('ALTER TABLE server_rules ADD COLUMN color TEXT').run();
    if (!cols.includes('title')) db.prepare('ALTER TABLE server_rules ADD COLUMN title TEXT').run();
    if (!cols.includes('welcome_on')) db.prepare('ALTER TABLE server_rules ADD COLUMN welcome_on INTEGER DEFAULT 1').run();
    if (!cols.includes('accept_role_id')) db.prepare('ALTER TABLE server_rules ADD COLUMN accept_role_id TEXT').run();
    db.prepare(`CREATE TABLE IF NOT EXISTS rules_acceptance (
        guild_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        accepted_at INTEGER NOT NULL,
        PRIMARY KEY (guild_id, user_id)
    )`).run();
    _ready = true;
}

function saveStyle(db, gid, patch) {
    ensureTable(db);
    const keys = Object.keys(patch);
    db.prepare(`INSERT INTO server_rules (guild_id, ${keys.join(', ')}, updated_at)
        VALUES (?, ${keys.map(() => '?').join(', ')}, ?)
        ON CONFLICT(guild_id) DO UPDATE SET ${keys.map(k => k + ' = excluded.' + k).join(', ')}, updated_at = excluded.updated_at`)
        .run(gid, ...keys.map(k => patch[k]), Math.floor(Date.now() / 1000));
}

function getRow(db, gid) {
    ensureTable(db);
    return db.prepare('SELECT * FROM server_rules WHERE guild_id = ?').get(gid) || {};
}

function saveRulesText(db, gid, text) { saveStyle(db, gid, { rules_text: text }); }
function clearRulesText(db, gid) { saveStyle(db, gid, { rules_text: null }); }

function getRulesChannelId(client, gid) {
    const s = client.getServerSettings?.(gid) || {};
    if (s.rulesChannel) return s.rulesChannel;
    if (gid === process.env.GUILD_ID && process.env.RULES_CHANNEL_ID) return process.env.RULES_CHANNEL_ID;
    return null;
}

function setRulesChannel(client, db, gid, channelId) {
    if (client.updateServerSetting) {
        client.updateServerSetting(gid, 'rules_channel', channelId);
        client.settings?.delete(gid);
        return;
    }
    try {
        const r = db.prepare('UPDATE server_settings SET rules_channel = ? WHERE guild_id = ?').run(channelId, gid);
        if (r.changes === 0) db.prepare('INSERT INTO server_settings (guild_id, rules_channel) VALUES (?, ?)').run(gid, channelId);
        client.settings?.delete(gid);
    } catch (e) { console.error('[RULES] channel write failed:', e.message); }
}

function fmtRules(text) {
    return String(text || '').split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

function acceptRow(gid, lang) {
    const L = (k) => t('rules.' + k, lang);
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`rules_accept_${gid}`)
            .setLabel(L('btnAccept') || 'Accept')
            .setEmoji(ui.emObj('verified', '✅'))
            .setStyle(ButtonStyle.Success)
    );
}

function buildCard(client, guild, rulesText, lang, custom, style, accepted) {
    const text = fmtRules(rulesText);
    const L = (k, v) => t('rules.' + k, lang, v);
    const title = style.title || L('title');
    const items = [];

    if (style.welcome_on !== 0) {
        items.push({ text: `*${em('rules', '📜')} ARCHON CG-223 · Server Rules*` });
        items.push({ text: L('welcomeLine', { server: guild.name }) });
    } else {
        items.push({ text: `*${em('rules', '📜')} ARCHON CG-223 · Server Rules*` });
    }
    items.push({ text: `## ${title}` });
    items.push({ rule: true });
    if (!custom || !text) {
        items.push({ text: `⚠️ ${L('notConfigured')}` });
        items.push({ text: `-# ${L('notConfiguredHint')}` });
        items.push({ text: `-# ${guild.name} · ARCHON CG-223 · BAMAKO_223 🇲🇱` });
        return v2.card(0x95a5a6, items);
    }
    items.push({ text });
    items.push({ rule: true });

    if (accepted) {
        items.push({ text: `✅ ${L('alreadyAccepted')}` });
    } else {
        items.push({ text: `-# ${L('acceptNote')}` });
        const row = acceptRow(guild.id, lang);
        if (row) items.push({ row });
    }
    items.push({ text: `-# ${guild.name} · ARCHON CG-223 · BAMAKO_223 🇲🇱` });

    return v2.card(parseInt(String(style.color || '#ffd700').replace('#',''), 16), items);
}

async function sendRules(client, guild, channel, lang) {
    const row = getRow(client.db, guild.id);
    const rulesText = row.rules_text;
    const style = { color: row.color, title: row.title, welcome_on: row.welcome_on };
    const card = buildCard(client, guild, rulesText, lang, !!row.rules_text, style, false);
    await channel.send({ ...card, allowedMentions: { parse: [] } });
    return 1;
}

function initRulesAccept(client) {
    // Handler GLOBAL idempotent — survit aux restarts pm2
    if (client._rulesAcceptHandlerReady) return;
    client._rulesAcceptHandlerReady = true;

    client.on('interactionCreate', async (i) => {
        if (typeof i.isButton !== 'function' || !i.isButton()) return;
        if (!i.customId || !i.customId.startsWith('rules_accept_')) return;
        const gid = i.guildId;
        if (!gid) return;

        try {
            await i.deferReply({ flags: 64 });
            const db = client.db;
            ensureTable(db);
            const already = db.prepare('SELECT 1 FROM rules_acceptance WHERE guild_id = ? AND user_id = ?').get(gid, i.user.id);
            if (already) {
                return i.editReply({ content: t('rules.alreadyAccepted', 'en') }).catch(() => {});
            }
            const row = getRow(db, gid);
            const lang = OKL.includes(client.getServerSettings?.(gid)?.language) ? client.getServerSettings(gid).language : 'en';
            if (!row.accept_role_id) {
                return i.editReply({ content: t('rules.needAcceptRole', lang) }).catch(() => {});
            }
            const member = await i.guild.members.fetch(i.user.id).catch(() => null);
            const role = i.guild.roles.cache.get(row.accept_role_id);
            if (!member || !role) {
                return i.editReply({ content: t('rules.acceptFailed', lang) }).catch(() => {});
            }
            await member.roles.add(role, 'Accepted server rules').catch(() => {});
            db.prepare('INSERT OR IGNORE INTO rules_acceptance (guild_id, user_id, accepted_at) VALUES (?, ?, ?)')
                .run(gid, i.user.id, Math.floor(Date.now() / 1000));
            return i.editReply({ content: t('rules.acceptSuccess', lang) }).catch(() => {});
        } catch (e) {
            console.error('[RULES ACCEPT]', e.message);
            if (i.deferred || i.replied) await i.editReply({ content: '❌ Error' }).catch(() => {});
            else await i.reply({ content: '❌ Error', flags: 64 }).catch(() => {});
        }
    });
}

// Backward compat: appelé depuis le chemin prefix
function attachAcceptCollector(_msg, client, _gid) {
    initRulesAccept(client);
}

module.exports = {
    name: 'rules',
    init: initRulesAccept,
    aliases: ['regles', 'règles', 'qawanin'],
    description: '📜 Display server rules (customizable per server)',
    category: 'SYSTEM',
    usage: '/rules | /rules set <text> | /rules channel #ch | /rules panel',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('rules').setDescription('📜 Display the server rules')
        .addSubcommand(s => s.setName('show').setDescription('Show rules here'))
        .addSubcommand(s => s.setName('panel').setDescription('Publish rules to the stored rules channel'))
        .addSubcommand(s => s.setName('set').setDescription('Set custom rules (admin)')
            .addStringOption(o => o.setName('text').setDescription('Full rules text, one rule per line').setRequired(true)))
        .addSubcommand(s => s.setName('reset').setDescription('Reset to default rules (admin)'))
        .addSubcommand(s => s.setName('channel').setDescription('Set the rules channel (admin)')
            .addChannelOption(o => o.setName('channel').setDescription('Rules channel').setRequired(true)))
        .addSubcommand(s => s.setName('setcolor').setDescription('Set embed accent color (admin)')
            .addStringOption(o => o.setName('color').setDescription('Hex color, e.g. #ff0000').setRequired(true)))
        .addSubcommand(s => s.setName('settitle').setDescription('Set embed title (admin)')
            .addStringOption(o => o.setName('title').setDescription('Custom title').setRequired(true)))
        .addSubcommand(s => s.setName('welcome').setDescription('Toggle welcome line (admin)')
            .addBooleanOption(o => o.setName('enabled').setDescription('true = show').setRequired(true)))
        .addSubcommand(s => s.setName('acceptrole').setDescription('Role given when a member accepts (admin)')
            .addRoleOption(o => o.setName('role').setDescription('Leave empty to clear').setRequired(false)))
        .addSubcommand(s => s.setName('accepted').setDescription('List members who accepted (admin)'))
        .addSubcommand(s => s.setName('resetchannel').setDescription('Clear the rules channel (admin)')),

    execute: async (interaction, client) => {
        const db = client.db;
        const gid = interaction.guild.id;
        ensureTable(db);
        const lang = OKL.includes(client.getServerSettings?.(gid)?.language) ? client.getServerSettings(gid).language : 'en';
        const L = (k, v) => t('rules.' + k, lang, v);
        const sub = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (sub === 'show') {
            await interaction.deferReply({ flags: 64 }).catch(() => {});
            const row = getRow(db, gid);
            const rulesText = row.rules_text;
            const style = { color: row.color, title: row.title, welcome_on: row.welcome_on };
            const already = db.prepare('SELECT 1 FROM rules_acceptance WHERE guild_id = ? AND user_id = ?').get(gid, interaction.user.id);
            await interaction.channel.send({ ...buildCard(client, interaction.guild, rulesText, lang, !!row.rules_text, style, !!already), allowedMentions: { parse: [] } });
            return interaction.editReply({ content: '📜' }).catch(() => {});
        }

        if (!isAdmin) return interaction.reply({ content: L('needManageGuild'), flags: 64 });

        if (sub === 'panel') {
            const chId = getRulesChannelId(client, gid);
            if (!chId) return interaction.reply({ content: L('channelMissing'), flags: 64 });
            const ch = interaction.guild.channels.cache.get(chId) || await interaction.guild.channels.fetch(chId).catch(() => null);
            if (!ch) return interaction.reply({ content: L('channelMissing'), flags: 64 });
            await sendRules(client, interaction.guild, ch, lang);
            return interaction.reply({ content: L('panelPosted', { channel: ch.toString() }), flags: 64 });
        }

        if (sub === 'set') {
            const text = interaction.options.getString('text', true);
            saveRulesText(db, gid, text);
            return interaction.reply({ content: L('setSuccess', { extra: '' }), flags: 64 });
        }

        if (sub === 'reset') {
            const row = getRow(db, gid);
            if (!row.rules_text) return interaction.reply({ content: L('resetNoCustom'), flags: 64 });
            clearRulesText(db, gid);
            return interaction.reply({ content: L('resetSuccess'), flags: 64 });
        }

        if (sub === 'channel') {
            const ch = interaction.options.getChannel('channel', true);
            setRulesChannel(client, db, gid, ch.id);
            return interaction.reply({ content: L('channelSet', { channel: ch.toString() }), flags: 64 });
        }

        if (sub === 'setcolor') {
            let hex = interaction.options.getString('color', true).trim();
            if (!/^#?[0-9a-fA-F]{6}$/.test(hex)) return interaction.reply({ content: L('invalidColor'), flags: 64 });
            if (!hex.startsWith('#')) hex = '#' + hex;
            saveStyle(db, gid, { color: hex });
            return interaction.reply({ content: L('setColorSuccess', { color: hex }), flags: 64 });
        }

        if (sub === 'settitle') {
            const title = interaction.options.getString('title', true).slice(0, 200);
            saveStyle(db, gid, { title });
            return interaction.reply({ content: L('setTitleSuccess', { title }), flags: 64 });
        }

        if (sub === 'welcome') {
            const on = interaction.options.getBoolean('enabled', true) ? 1 : 0;
            saveStyle(db, gid, { welcome_on: on });
            return interaction.reply({ content: on ? L('welcomeOn') : L('welcomeOff'), flags: 64 });
        }

        if (sub === 'acceptrole') {
            const role = interaction.options.getRole('role');
            if (!role) {
                saveStyle(db, gid, { accept_role_id: null });
                return interaction.reply({ content: L('acceptRoleCleared'), flags: 64 });
            }
            saveStyle(db, gid, { accept_role_id: role.id });
            return interaction.reply({ content: L('acceptRoleSet', { role: role.toString() }), flags: 64 });
        }

        if (sub === 'accepted') {
            const rows = db.prepare('SELECT user_id, accepted_at FROM rules_acceptance WHERE guild_id = ? ORDER BY accepted_at DESC LIMIT 50').all(gid);
            if (!rows.length) return interaction.reply({ content: L('acceptedEmpty'), flags: 64 });
            const list = rows.map((r, i) => `${i + 1}. <@${r.user_id}> — <t:${r.accepted_at}:R>`).join('\n');
            return interaction.reply({ content: `**${L('acceptedTitle', { n: rows.length })}**\n${list}`, flags: 64 });
        }

        if (sub === 'resetchannel') {
            setRulesChannel(client, db, gid, null);
            return interaction.reply({ content: L('channelCleared'), flags: 64 });
        }
    },

    run: async (client, message, args, db, ss) => {
        const gid = message.guild?.id;
        if (!gid) return;
        ensureTable(db);
        const lang = OKL.includes(ss?.language) ? ss.language : 'en';
        const L = (k, v) => t('rules.' + k, lang, v);
        const sub = (args[0] || '').toLowerCase();
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (sub === 'set' || sub === 'reset' || sub === 'panel' || sub === 'channel' || sub === 'acceptrole') {
            if (!isAdmin) return message.reply(L('needManageGuild')).catch(() => {});
            if (sub === 'set') {
                const text = args.slice(1).join(' ');
                if (!text) return message.reply(L('setSuccess', { extra: '' })).catch(() => {});
                saveRulesText(db, gid, text);
                return message.reply(L('setSuccess', { extra: '' })).catch(() => {});
            }
            if (sub === 'reset') {
                clearRulesText(db, gid);
                return message.reply(L('resetSuccess')).catch(() => {});
            }
            if (sub === 'channel') {
                const ch = message.mentions.channels.first();
                if (!ch) return message.reply(L('channelMissing')).catch(() => {});
                setRulesChannel(client, db, gid, ch.id);
                return message.reply(L('channelSet', { channel: ch.toString() })).catch(() => {});
            }
            if (sub === 'panel') {
                const chId = getRulesChannelId(client, gid);
                if (!chId) return message.reply(L('channelMissing')).catch(() => {});
                const ch = message.guild.channels.cache.get(chId) || await message.guild.channels.fetch(chId).catch(() => null);
                if (!ch) return message.reply(L('channelMissing')).catch(() => {});
                await sendRules(client, message.guild, ch, lang);
                return message.reply(L('panelPosted', { channel: ch.toString() })).catch(() => {});
            }
            if (sub === 'acceptrole') {
                const role = message.mentions.roles.first();
                if (!role) { saveStyle(db, gid, { accept_role_id: null }); return message.reply(L('acceptRoleCleared')).catch(() => {}); }
                saveStyle(db, gid, { accept_role_id: role.id });
                return message.reply(L('acceptRoleSet', { role: role.toString() })).catch(() => {});
            }
        }

        const row = getRow(db, gid);
        const rulesText = row.rules_text || L('defaultRules');
        const style = { color: row.color, title: row.title, welcome_on: row.welcome_on };
        const already = db.prepare('SELECT 1 FROM rules_acceptance WHERE guild_id = ? AND user_id = ?').get(gid, message.author.id);
        const sent = await message.channel.send({ ...buildCard(client, message.guild, rulesText, lang, !!row.rules_text, style, !!already), allowedMentions: { parse: [] } }).catch(() => null);
        if (sent) attachAcceptCollector(sent, client, gid);
    },
};
