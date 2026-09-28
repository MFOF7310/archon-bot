const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { t } = require('../lib/i18n');

// ═══════════════════════════════════════════════════════
// ARCHON CG-223 — RULES SYSTEM v1.1
// Rules text: per-guild (server_rules table)
// Rules channel: SHARED registry — /channels set type:rules
// (read via getServerSettings.rulesChannel, incl. .env fallback)
// ═══════════════════════════════════════════════════════

const OKL = ['en', 'fr', 'bm', 'zh', 'ar'];
const GOLD = 0xffd700;

let _tableReady = false;
function ensureTable(db) {
    if (_tableReady) return;
    db.prepare(`CREATE TABLE IF NOT EXISTS server_rules (
        guild_id TEXT PRIMARY KEY,
        rules_text TEXT,
        updated_at INTEGER
    )`).run();
    _tableReady = true;
}

function getRulesText(db, gid) {
    ensureTable(db);
    return db.prepare('SELECT rules_text FROM server_rules WHERE guild_id = ?').get(gid)?.rules_text || null;
}

function saveRulesText(db, gid, text) {
    ensureTable(db);
    db.prepare(`INSERT INTO server_rules (guild_id, rules_text, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(guild_id) DO UPDATE SET rules_text = excluded.rules_text, updated_at = excluded.updated_at`)
        .run(gid, text, Math.floor(Date.now() / 1000));
}

// ── SHARED CHANNEL REGISTRY (single source of truth) ──
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
    // Fallback: direct DB write (upsert)
    try {
        const r = db.prepare('UPDATE server_settings SET rules_channel = ? WHERE guild_id = ?').run(channelId, gid);
        if (r.changes === 0) db.prepare('INSERT INTO server_settings (guild_id, rules_channel) VALUES (?, ?)').run(gid, channelId);
        client.settings?.delete(gid);
    } catch (e) {
        console.error('[RULES] channel write fallback failed:', e.message);
    }
}

function formatRules(text) {
    return text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
}

function buildRulesEmbeds(client, guild, rulesText, lang, custom) {
    const text = formatRules(rulesText);
    const chunks = [];
    if (text.length <= 3900) chunks.push(text);
    else {
        let cur = '';
        for (const line of text.split('\n')) {
            if ((cur + '\n' + line).length > 3900) { chunks.push(cur); cur = line; }
            else cur = cur ? cur + '\n' + line : line;
        }
        if (cur) chunks.push(cur);
    }
    return chunks.slice(0, 3).map((chunk, i) => {
        const embed = new EmbedBuilder()
            .setColor(GOLD)
            .setAuthor({ name: t('rules.author', lang), iconURL: client.user.displayAvatarURL() })
            .setTitle(t('rules.title', lang) + (chunks.length > 1 ? ` (${i + 1}/${chunks.length})` : ''))
            .setDescription(chunk)
            .setFooter({ text: `${guild.name} • ARCHON CG-223 • BAMAKO_223 🇲🇱`, iconURL: guild.iconURL() || client.user.displayAvatarURL() })
            .setTimestamp();
        if (i === chunks.length - 1) {
            const notes = [];
            if (!custom) notes.push(t('rules.noCustomRules', lang));
            notes.push(t('rules.acceptNote', lang));
            embed.addFields({ name: '', value: notes.join('\n'), inline: false });
        }
        return embed;
    });
}

async function sendRules(client, guild, channel, lang) {
    const custom = getRulesText(client.db, guild.id);
    const rulesText = custom || t('rules.defaultRules', lang);
    const embeds = buildRulesEmbeds(client, guild, rulesText, lang, !!custom);
    await channel.send({ content: t('rules.welcomeLine', lang, { server: guild.name }), embeds });
    return embeds.length;
}

module.exports = {
    name: 'rules',
    aliases: ['regles', 'règles', 'qawanin'],
    description: '📜 Display server rules (customizable per server)',
    category: 'SYSTEM',
    usage: '/rules | /rules set <text> | /rules channel #ch | /rules panel | /rules resetchannel',
    cooldown: 3000,

    data: new SlashCommandBuilder()
        .setName('rules').setDescription('📜 Display the server rules')
        .addSubcommand(s => s.setName('show').setDescription('Show rules here'))
        .addSubcommand(s => s.setName('panel').setDescription('Publish rules to the stored rules channel'))
        .addSubcommand(s => s.setName('set').setDescription('Set custom rules (admin)')
            .addStringOption(o => o.setName('text').setDescription('Full rules text, one rule per line').setRequired(true)))
        .addSubcommand(s => s.setName('channel').setDescription('Set the rules channel (admin) — same registry as /channels set type:rules')
            .addChannelOption(o => o.setName('channel').setDescription('Rules channel').setRequired(true)))
        .addSubcommand(s => s.setName('resetchannel').setDescription('Clear the rules channel setting (admin)')),

    execute: async (interaction, client) => {
        const db = client.db;
        const gid = interaction.guild.id;
        ensureTable(db);
        const lang = OKL.includes(client.getServerSettings?.(gid)?.language) ? client.getServerSettings(gid).language : 'en';
        const sub = interaction.options.getSubcommand();
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (sub === 'show') {
            const n = await sendRules(client, interaction.guild, interaction.channel, lang);
            const note = n > 1 ? t('rules.rulesTooLong', lang) : '';
            await interaction.reply({ content: note, flags: 64 }).catch(() => {});
            return;
        }

        if (sub === 'panel') {
            if (!isAdmin) return interaction.reply({ content: t('rules.needManageGuild', lang), flags: 64 });
            const chId = getRulesChannelId(client, gid);
            if (chId) {
                const ch = interaction.guild.channels.cache.get(chId)
                    || await interaction.guild.channels.fetch(chId).catch(() => null);
                if (ch) {
                    await sendRules(client, interaction.guild, ch, lang);
                    return interaction.reply({ content: t('rules.panelPosted', lang, { channel: ch.toString() }), flags: 64 });
                }
            }
            return interaction.reply({ content: t('rules.channelMissing', lang), flags: 64 });
        }

        if (sub === 'set') {
            if (!isAdmin) return interaction.reply({ content: t('rules.needManageGuild', lang), flags: 64 });
            const text = interaction.options.getString('text', true);
            saveRulesText(db, gid, text);
            return interaction.reply({ content: t('rules.setSuccess', lang, { extra: '' }), flags: 64 });
        }

        if (sub === 'channel') {
            if (!isAdmin) return interaction.reply({ content: t('rules.needManageGuild', lang), flags: 64 });
            const ch = interaction.options.getChannel('channel', true);
            setRulesChannel(client, db, gid, ch.id);
            return interaction.reply({ content: t('rules.channelSet', lang, { channel: ch.toString() }), flags: 64 });
        }

        if (sub === 'resetchannel') {
            if (!isAdmin) return interaction.reply({ content: t('rules.needManageGuild', lang), flags: 64 });
            setRulesChannel(client, db, gid, null);
            return interaction.reply({ content: t('rules.channelCleared', lang), flags: 64 });
        }
    },

    run: async (client, message, args, db, ss) => {
        const gid = message.guild?.id;
        if (!gid) return;
        ensureTable(db);
        const lang = OKL.includes(ss?.language) ? ss.language : 'en';
        const sub = args[0]?.toLowerCase();
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.ManageGuild);

        if (sub === 'set') {
            if (!isAdmin) return message.reply(t('rules.needManageGuild', lang)).catch(() => {});
            const text = args.slice(1).join(' ');
            if (!text) return message.reply(t('rules.setSuccess', lang, { extra: '' })).catch(() => {});
            saveRulesText(db, gid, text);
            return message.reply(t('rules.setSuccess', lang, { extra: '' })).catch(() => {});
        }

        if (sub === 'channel') {
            if (!isAdmin) return message.reply(t('rules.needManageGuild', lang)).catch(() => {});
            const ch = message.mentions.channels.first();
            if (!ch) return message.reply(t('rules.channelMissing', lang)).catch(() => {});
            setRulesChannel(client, db, gid, ch.id);
            return message.reply(t('rules.channelSet', lang, { channel: ch.toString() })).catch(() => {});
        }

        if (sub === 'panel') {
            if (!isAdmin) return message.reply(t('rules.needManageGuild', lang)).catch(() => {});
            const chId = getRulesChannelId(client, gid);
            if (chId) {
                const ch = message.guild.channels.cache.get(chId)
                    || await message.guild.channels.fetch(chId).catch(() => null);
                if (ch) {
                    await sendRules(client, message.guild, ch, lang);
                    return message.reply(t('rules.panelPosted', lang, { channel: ch.toString() })).catch(() => {});
                }
            }
            return message.reply(t('rules.channelMissing', lang)).catch(() => {});
        }

        if (sub === 'resetchannel') {
            if (!isAdmin) return message.reply(t('rules.needManageGuild', lang)).catch(() => {});
            setRulesChannel(client, db, gid, null);
            return message.reply(t('rules.channelCleared', lang)).catch(() => {});
        }

        await sendRules(client, message.guild, message.channel, lang);
    },
};
