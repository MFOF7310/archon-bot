const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const EMOJIS = require('../config/emojis');

const LANGUAGES = {
    auto: { name: 'Auto-detect', flag: EMOJIS.globe || '🌐', native: 'Auto' },
    en: { name: 'English', flag: '🇬🇧', native: 'English' },
    fr: { name: 'French', flag: '🇫🇷', native: 'Français' },
    ar: { name: 'Arabic', flag: '🇸🇦', native: 'العربية' },
    bm: { name: 'Bambara', flag: '🇲🇱', native: 'Bamanankan' },
    zh: { name: 'Chinese', flag: '🇨🇳', native: '中文' },
};

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

    async run(client, message, args) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return message.reply({ content: `⛔ You need **Manage Server** permission.`, flags: 64 });

        const code = args[0]?.toLowerCase();
        if (!code || !LANGUAGES[code]) {
            const list = Object.entries(LANGUAGES).map(([k,v]) => `\`${k}\` ${v.flag} ${v.native}`).join('\n\n');
            const currentLang = client.getServerSettings?.(message.guild.id)?.language || 'auto';
            const current = LANGUAGES[currentLang] || LANGUAGES['auto'];
            return message.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle('🌐 Server Language')
                    .setDescription(
                        `**Current:** ${EMOJIS.globe} ${current.native} (\`${currentLang}\`)\n\n` +
                        `**Available:**\n\n${list}`
                        `Usage: \`.setlang fr\``
                    )]
            });
        }
        await setLanguage(client, message.guild.id, code, message.guild.name);
        return message.reply({
            embeds: [buildEmbed(code, message.guild)]
        });
    },

    async execute(interaction, client) {
        if (!interaction.member?.permissions.has(PermissionFlagsBits.ManageGuild))
            return interaction.reply({ content: '⛔ You need **Manage Server** permission.', flags: 64 });

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'show') {
            const currentLang = client.getServerSettings?.(interaction.guild.id)?.language || 'auto';
            const current = LANGUAGES[currentLang] || LANGUAGES['auto'];
            const list = Object.entries(LANGUAGES).map(([k,v]) => `\`${k}\` ${v.flag} ${v.native}`).join('\n\n');
            return interaction.reply({
                embeds: [new EmbedBuilder().setColor('#00f0ff')
                    .setTitle('🌐 Server Language')
                    .setDescription(
                        `**Current:** ${EMOJIS.globe} ${current.native} (\`${currentLang}\`)\n\n` +
                        `**Available:**\n\n${list}`
                    )],
                flags: 64
            });
        }

        if (subcommand === 'set') {
            const code = interaction.options.getString('language');
            if (!code || !LANGUAGES[code]) return interaction.reply({ content: '❌ Invalid language.', flags: 64 });
            await setLanguage(client, interaction.guild.id, code, interaction.guild.name);
            return interaction.reply({ embeds: [buildEmbed(code, interaction.guild)], flags: 64 });
        }
    }
};

async function setLanguage(client, guildId, code, guildName) {
    try {
        const db = client.db;
        db.prepare(`INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)`).run(guildId);
        db.prepare(`UPDATE server_settings SET language = ? WHERE guild_id = ?`).run(code, guildId);
        // Clear settings cache so detectLanguage picks up new value
        client.settings?.delete(guildId);
        console.log(`[LANG] ${guildName} → ${code}`);
    } catch(e) {
        console.error('[LANG] Error:', e.message);
    }
}

function buildEmbed(code, guild = null) {
    const lang = LANGUAGES[code] || LANGUAGES['en'];
    // config/emojis stores ':globe:'-style shortcodes for some names — Discord does
    // NOT parse shortcodes in bot messages, so fall back to real unicode chars.
    const globe = (EMOJIS.globe && !String(EMOJIS.globe).startsWith(':')) ? EMOJIS.globe : '🌐';
    const check = (EMOJIS.check && !String(EMOJIS.check).startsWith(':')) ? EMOJIS.check : '✅';
    let confirmMsg = {
        en: `Server language set to **${lang.native}**\n\nAll bot responses will now appear in **${lang.native}**.`,
        fr: `Langue du serveur définie sur **${lang.native}**\n\nToutes les réponses apparaîtront en **${lang.native}**.`,
        bm: `Serveur ka kan sɛbɛnni bɛ **${lang.native}** na\n\nJaabiw bɛɛ bɛna kɛ **${lang.native}** na.`,
        ar: `تم تعيين لغة السيرفر إلى **${lang.native}**\n\nستظهر جميع الردود باللغة **${lang.native}**.`,
        zh: `服务器语言已设置为 **${lang.native}**\n\n所有回复将以 **${lang.native}** 显示。`,
    }[code] || `Server language set to **${lang.native}**\n\nAll bot responses will now appear in **${lang.native}**.`;

    // Under Auto: show what language actually resolves right now (Discord native setting)
    let autoNote = '';
    if (code === 'auto' && guild) {
        const autoMsg = {
            en: "Server language set to **Auto** — I follow Discord's native server language, with command detection as fallback.",
            fr: "Langue définie sur **Auto** — je suis la langue native du serveur Discord, avec détection par commande en secours.",
            bm: "Serveur ka kan sɛbɛnni bɛ **Auto** na — ne bɛ Discord serveur kan na to, command detection fana bɛ se ka kɛ.",
            ar: "تم التعيين على **Auto** — أتبع لغة السيرفر الأصلية في Discord، مع كشف الأوامر كاحتياطٍ.",
            zh: "已设置为 **Auto**——我将跟随 Discord 服务器原生语言，并以命令检测作为后备。",
        };
        const pl = guild.preferredLocale || 'en-US';
        let det = 'en';
        if (pl.startsWith('fr')) det = 'fr';
        else if (pl.startsWith('zh')) det = 'zh';
        else if (pl.startsWith('ar')) det = 'ar';
        const detName = { fr: '🇫🇷 Français', zh: '🇨🇳 中文', ar: '🇸🇦 العربية', en: '🇬🇧 English' }[det];
        autoNote = `\n\n🔎 **Auto** currently resolves to **${detName}**\n\`\`\`\n▸ SOURCE   Discord server language (\`${pl}\`)\n▸ FALLBACK Command-language detection\n\`\`\``;
        confirmMsg = autoMsg[code] || autoMsg.en;
    }

    return new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: '🌐 Language Updated' })
        .setTitle(`${lang.flag} ${lang.native} (${lang.name})`)
        .setDescription(globe + ' ' + check + ' ' + confirmMsg + autoNote)
        .setFooter({ text: 'ARCHON CG-223  •  Language Settings' });
}
