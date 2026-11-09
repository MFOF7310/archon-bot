const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');
const { pickLang } = require('../lib/pick-lang');
const v2 = require('../lib/games/v2');
const mention = require('../lib/mentions');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');

// Texts: lang/{en,fr,zh,ar}/setlang.json  (Bambara servers read English until its texts are written)

const LANGUAGES = {
    auto: { name: 'Auto-detect', flag: EMOJIS.globe || '🌐', native: 'Auto-Detect' },
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    fr: { name: 'French', flag: '🇫🇷', native: 'Français' },
    ar: { name: 'Arabic', flag: '🇸🇦', native: 'العربية' },
    bm: { name: 'Bambara', flag: '🇲🇱', native: 'Bamanankan' },
    zh: { name: 'Chinese', flag: '🇨🇳', native: '中文' },
};

const TEXT_LANGS = ['en', 'fr', 'zh', 'ar'];
const textLang = (l) => (TEXT_LANGS.includes(l) ? l : 'en');


// What "Auto" gives for a server: its Discord language when we have it, English otherwise.
function resolveAuto(guild) {
    const { LANGS } = require('../lib/pick-lang');
    const locale = String((guild && guild.preferredLocale) || 'en-US').toLowerCase();
    return LANGS.find((l) => locale.startsWith(l)) || 'en';
}



function buildEmbed(code, guild = null, isAlreadySet = false) {
    const entry = LANGUAGES[code] || LANGUAGES.en;
    const L = code === 'auto' ? resolveAuto(guild) : textLang(code);
    
    // Résolution des emojis custom avec fallback
    const checkEmoji = EMOJIS.small_check || EMOJIS.check || em('ic_ok', '✅');
    const warnEmoji = EMOJIS.warning || EMOJIS.error || em('ic_warn', '⚠️');
    const customFlag = EMOJIS[`flag_${code}`] || entry.flag; // Si un emoji custom existe (ex: flag_fr)

    const c = new ContainerBuilder().setAccentColor(isAlreadySet ? 0xf1c40f : 0x2ecc71);
    
    if (isAlreadySet) {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${warnEmoji} ${customFlag} ${entry.native}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('setlang.already_set', L, { native: entry.native })));
    } else {
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${checkEmoji} ${customFlag} ${entry.native}`));
        c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
        
        if (code === 'auto') {
            const shown = resolveAuto(guild);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('setlang.autoSuccess', shown, {}) + '\n' + t('setlang.autoNow', shown, { language: LANGUAGES[shown].native })));
        } else {
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('setlang.success', L, { native: entry.native })));
        }
    }
    
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱`));
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

function listEmbed(L, currentCode, client, prefix, guild) {
    const current = LANGUAGES[currentCode] || LANGUAGES.auto;
    
    // Affichage dynamique pour "Auto"
    let currentDisplay = '';
    if (currentCode === 'auto') {
        const resolved = resolveAuto(guild);
        const resolvedName = LANGUAGES[resolved] ? LANGUAGES[resolved].native : 'English';
        currentDisplay = `**${resolvedName}** (Auto-Detect)`;
    } else {
        currentDisplay = `**${current.native}** (\`${currentCode}\`)`;
    }

    // Liste propre sans doublon
    const lines = Object.entries(LANGUAGES).map(([k, v]) => {
        const dynamicFlag = EMOJIS[`flag_${k}`] || v.flag;
        const label = k === 'auto' ? 'Auto-Detect' : v.native;
        return `\`${k}\` ${dynamicFlag} ${label}`;
    }).join('\n');
    
    const globeEmoji = EMOJIS.globe || '🌐';
    
    const c = new ContainerBuilder().setAccentColor(0x00f0ff);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${globeEmoji} ${t('setlang.title', L, {})}`));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(t('setlang.current', L, { value: currentDisplay })));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${t('setlang.available', L, {})}**\n\n${lines}`));
    c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
    
    const setCmd = mention(client, 'setlang', 'set');
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# BAMAKO_223 🇲🇱 • ${t('setlang.footer', L, {})} : ${setCmd}`));
    
    return { components: [c], flags: MessageFlags.IsComponentsV2 };
}

// Returns true when the new language was saved.
async function setLanguage(client, guildId, code, guildName) {
    try {
        const db = client.db;
        const current = client.getServerSettings?.(guildId)?.language || 'auto';
        
        // GUARD: On vérifie si la langue est déjà celle sélectionnée
        if (current === code) return 'already_set';

        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
        db.prepare(`UPDATE server_settings SET language = ? WHERE guild_id = ?`).run(code, guildId);
        client.settings?.delete(guildId);
        console.log(`[LANG] ${guildName} → ${code}`);
        return 'saved';
    } catch (e) {
        console.error('[LANG] Error:', e.message);
        return 'error';
    }
}

// The language of the person typing, never failing: English is the safe answer.
function languageOf(client, guildId, interaction, userId = null) {
    try { return textLang(pickLang(client, guildId, interaction, userId)); } catch (e) { return 'en'; }
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
            return message.reply({ ...listEmbed(L, currentCode, client, prefix, message.guild) });
        }

        const status = await setLanguage(client, message.guild.id, typed, message.guild.name);
        if (status === 'error') return message.reply({ content: t('setlang.saveFailed', L, {}) });
        return message.reply({ ...buildEmbed(typed, message.guild, status === 'already_set') });
    },

    async execute(interaction, client) {
        const L = languageOf(client, interaction.guildId, interaction);
        if (!interaction.guild) return interaction.reply({ content: t('setlang.guildOnly', L, {}), flags: 64 });
        if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: t('setlang.need', L, {}), flags: 64 });
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            await interaction.deferReply({ flags: 64 });
            const currentCode = client.getServerSettings?.(interaction.guild.id)?.language || 'auto';
            return interaction.editReply({ ...listEmbed(L, currentCode, client, '', interaction.guild), flags: MessageFlags.IsComponentsV2 });
        }

        if (subcommand === 'set') {
            const code = interaction.options.getString('language');
            if (!code || !LANGUAGES[code]) return interaction.reply({ content: t('setlang.invalid', L, {}), flags: 64 });
            
            await interaction.deferReply({ flags: 64 });
            const status = await setLanguage(client, interaction.guild.id, code, interaction.guild.name);
            if (status === 'error') return interaction.editReply({ content: t('setlang.saveFailed', L, {}) });
            return interaction.editReply({ ...buildEmbed(code, interaction.guild, status === 'already_set'), flags: MessageFlags.IsComponentsV2 });
        }
    },

    _internal: { LANGUAGES, buildEmbed, resolveAuto },
};
