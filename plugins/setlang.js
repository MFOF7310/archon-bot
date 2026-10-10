const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');

// Texts: lang/{en,fr,zh,ar}/setlang.json  (Bambara servers read English until its texts are written)

const LANGUAGES = {
    auto: { name: 'Auto-detect', flag: EMOJIS.globe || '', native: 'Auto' },
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    fr: { name: 'French', flag: '🇫🇷', native: 'Français' },
    ar: { name: 'Arabic', flag: '🇸🇦', native: 'العربية' },
    bm: { name: 'Bambara', flag: '🇲🇱', native: 'Bamanankan' },
    zh: { name: 'Chinese', flag: '🇨🇳', native: '中文' },
};

const TEXT_LANGS = ['en', 'fr', 'zh', 'ar'];
const textLang = (l) => (TEXT_LANGS.includes(l) ? l : 'en');

// Bambara confirmation: kept exactly as it was written before. It has not been reviewed.
const bambaraConfirm = (native) => `Serveur ka kan sɛbɛnni bɛ **${native}** na\n\nJaabiw bɛɛ bɛna kɛ **${native}** na.`;

// What "Auto" gives for a server: its Discord language when we have it, English otherwise.
function resolveAuto(guild) {
    const locale = String((guild && guild.preferredLocale) || 'en-US').toLowerCase();
    return ['fr', 'zh', 'ar'].find((l) => locale.startsWith(l)) || 'en';
}

// The confirmation is written in the language that was just chosen.
function confirmText(code, guild) {
    if (code === 'bm') return bambaraConfirm(LANGUAGES.bm.native);
    if (code === 'auto') {
        const shown = resolveAuto(guild);
        return `${t('setlang.autoConfirm', shown, {})} ${t('setlang.autoNow', shown, { language: LANGUAGES[shown].native })}`;
    }
    return t('setlang.confirm', textLang(code), { native: LANGUAGES[code].native });
}

function buildEmbed(code, guild = null) {
    const entry = LANGUAGES[code] || LANGUAGES.en;
    const L = code === 'auto' ? resolveAuto(guild) : textLang(code);
    return new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: t('setlang.updated', L, {}) })
        .setTitle(`${entry.flag} ${entry.native} (${entry.name})`.trim())
        .setDescription(`${EMOJIS.globe || ''} ${EMOJIS.check || ''} ${confirmText(code, guild)}`.trim())
        .setFooter({ text: t('setlang.footer', L, {}) });
}

function listEmbed(L, currentCode, prefix) {
    const current = LANGUAGES[currentCode] || LANGUAGES.auto;
    const lines = Object.entries(LANGUAGES).map(([k, v]) => `\`${k}\` ${v.flag} ${v.native}`).join('\n');
    const value = `${EMOJIS.globe || ''} ${current.native} (\`${currentCode}\`)`.trim();
    return `${t('setlang.current', L, { value })}\n\n**${t('setlang.available', L, {})}**\n${lines}`
        + (prefix ? `\n\n${t('setlang.usage', L, { prefix })}` : '');
}

// Returns true when the new language was saved.
async function setLanguage(client, guildId, code, guildName) {
    try {
        const db = client.db;
        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
        db.prepare(`UPDATE server_settings SET language = ? WHERE guild_id = ?`).run(code, guildId);
        // Clear settings cache so detectLanguage picks up the new value
        client.settings?.delete(guildId);
        console.log(`[LANG] ${guildName} → ${code}`);
        return true;
    } catch (e) {
        console.error('[LANG] Error:', e.message);
        return false;
    }
}

// The language of the person typing, never failing: English is the safe answer.
function languageOf(client, guildId, interaction) {
    try { return textLang(pickLang(client, guildId, interaction)); } catch (e) { return 'en'; }
}

const cleanCode = (s) => String(s || '').replace(/[^\p{L}\p{N}_-]/gu, '').slice(0, 12);

module.exports = {
    name: 'setlang',
    aliases: ['setlanguage', 'language', 'lang'],
    description: 'Set the bot language for this server.',
    category: 'CONFIG',
    cooldown: 3000,
    usage: '.setlang <en|fr|ar|bm|zh>',

    data: new SlashCommandBuilder()
        .setName('setlang')
        .setDescription('🌐 Manage the bot language for this server')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Set the bot language for this server')
            .addStringOption(o => o
                .setName('language')
                .setDescription('Choose a language')
                .setRequired(true)
                .addChoices(
                    { name: '🌐 Auto-detect', value: 'auto' },
                    { name: '🇬🇧 English', value: 'en' },
                    { name: '🇫🇷 Français', value: 'fr' },
                    { name: '🇸🇦 العربية', value: 'ar' },
                    { name: '🇲🇱 Bamanankan', value: 'bm' },
                    { name: '🇨🇳 中文', value: 'zh' },
                )))
        .addSubcommand(sub => sub
            .setName('show')
            .setDescription('Show the current server language'))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    async run(client, message, args, db, serverSettings, usedCommand, lang) {
        const L = textLang(lang);
        if (!message.guild) return message.reply({ content: t('setlang.guildOnly', L, {}) });
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return message.reply({ content: t('setlang.need', L, {}) });
        }

        const prefix = (serverSettings && serverSettings.prefix) || process.env.PREFIX || '.';
        const typed = String((args && args[0]) || '').toLowerCase();
        if (!typed || !LANGUAGES[typed]) {
            const currentCode = client.getServerSettings?.(message.guild.id)?.language || 'auto';
            const intro = typed ? `${t('setlang.unknown', L, { code: cleanCode(typed) || '?' })}\n\n` : '';
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle(t('setlang.title', L, {}))
                    .setDescription(intro + listEmbed(L, currentCode, prefix))],
            });
        }

        const saved = await setLanguage(client, message.guild.id, typed, message.guild.name);
        if (!saved) return message.reply({ content: t('setlang.saveFailed', L, {}) });
        return message.reply({ embeds: [buildEmbed(typed, message.guild)] });
    },

    async execute(interaction, client) {
        const L = languageOf(client, interaction.guildId, interaction);
        if (!interaction.guild) return interaction.reply({ content: t('setlang.guildOnly', L, {}), flags: 64 });
        if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: t('setlang.need', L, {}), flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const currentCode = client.getServerSettings?.(interaction.guild.id)?.language || 'auto';
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle(t('setlang.title', L, {}))
                    .setDescription(listEmbed(L, currentCode, ''))],
                flags: 64,
            });
        }

        if (subcommand === 'set') {
            const code = interaction.options.getString('language');
            if (!code || !LANGUAGES[code]) return interaction.reply({ content: t('setlang.invalid', L, {}), flags: 64 });
            const saved = await setLanguage(client, interaction.guild.id, code, interaction.guild.name);
            if (!saved) return interaction.reply({ content: t('setlang.saveFailed', L, {}), flags: 64 });
            return interaction.reply({ embeds: [buildEmbed(code, interaction.guild)], flags: 64 });
        }
    },

    _internal: { LANGUAGES, buildEmbed, resolveAuto },
};
