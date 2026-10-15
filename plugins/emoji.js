const { SlashCommandBuilder } = require('discord.js');
const { card } = require('../lib/games/v2');

// ================= BILINGUAL TRANSLATIONS =================
const i18n = require('../lib/i18n');
const I18N_KEYS = ["name","id","animated","guild","created","unknown","sizeNote","noEmoji","notFound","typeGuild","typeApp","typeExternal","typeUnicode","identifiers","originLabel","requestedBy"];
// Clés dans lang/<locale>/emoji.json ; '' retombe sur EN dans t().
function loadT(lang) {
    const o = {};
    for (const k of I18N_KEYS) o[k] = i18n.t(`emoji.${k}`, lang);
    return o;
}

module.exports = {
    name: 'emoji',
    aliases: ['emote', 'e', 'emojinfo', 'emojiinfo'],
    description: '😎 Display detailed information about any emoji.',
    category: 'UTILITY',
    cooldown: 3,
    usage: '.emoji <emoji>',
    examples: ['.emoji 😎', '.emoji :smile:', '.emoji <a:custom:123456789>'],

    // ================= SLASH COMMAND =================
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Get detailed information about an emoji')
        .addStringOption(option =>
            option.setName('emoji')
                .setDescription('The emoji to inspect (paste it directly)')
                .setRequired(true)),

    // ================= PREFIX COMMAND =================
    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        const t = loadT(lang);

        const input = args[0];
        if (!input) {
            return message.reply({ content: t.noEmoji, flags: 64 }).catch(() => {});
        }

        const embed = await buildEmojiEmbed(input, t, client, message.guild, message.author.id);
        if (!embed) {
            return message.reply({ content: t.notFound, flags: 64 }).catch(() => {});
        }

        await message.reply({ ...embed, allowedMentions: { parse: [] } }).catch(() => {});
    },

    // ================= SLASH EXECUTE =================
    execute: async (interaction) => {
        await interaction.deferReply();
        
        const input = interaction.options.getString('emoji');
        const lang = interaction.client.detectLanguage?.('/emoji', 'en') || 'en';
        const t = loadT(lang);

        const embed = await buildEmojiEmbed(input, t, interaction.client, interaction.guild, interaction.user.id);
        if (!embed) {
            return interaction.editReply({ content: t.notFound });
        }

        await interaction.editReply({ ...embed, allowedMentions: { parse: [] } });
    }
};

// ================= BUILD CARD (V2) =================
async function buildEmojiEmbed(input, t, client, guild, userId) {
    const customEmojiRegex = /<(a?):(\w+):(\d+)>/;
    const match = input.match(customEmojiRegex);

    let d = {};

    if (match) {
        const animated = match[1] === 'a';
        const name = match[2];
        const id = match[3];
        const ext = animated ? 'gif' : 'png';

        // 1. Chercher dans le serveur courant
        let guildEmoji = null;
        if (guild) guildEmoji = await guild.emojis.fetch(id).catch(() => null);

        // 2. Sinon chercher dans le cache global (tous les serveurs du bot)
        let otherGuildEmoji = null;
        if (!guildEmoji) {
            otherGuildEmoji = client.emojis.cache.get(id) || null;
            // Si pas dans le cache, tenter un fetch sur les guilds
            if (!otherGuildEmoji && client.guilds?.cache) {
                for (const [_, g] of client.guilds.cache) {
                    const e = g.emojis.cache.get(id);
                    if (e) { otherGuildEmoji = e; break; }
                }
            }
        }

        // 3. Sinon app emoji
        let appEmoji = null;
        if (!guildEmoji && !otherGuildEmoji && client.application?.emojis) {
            await client.application.emojis.fetch().catch(() => null);
            appEmoji = client.application.emojis.cache?.get(id) || null;
        }

        const found = guildEmoji || otherGuildEmoji || appEmoji;

        d = {
            name, id, animated,
            raw: `<${match[1]}:${name}:${id}>`,
            url: `https://cdn.discordapp.com/emojis/${id}.${ext}`,
            typeKey: found?.guildId ? 'typeGuild' : (appEmoji ? 'typeApp' : 'typeExternal'),
            origin: found?.guild?.name || (appEmoji ? 'Archon App' : 'Serveur externe'),
            created: found?.createdAt
                ? `<t:${Math.floor(found.createdAt.getTime() / 1000)}:D>`
                : t.unknown,
        };
    } else {
        const codePoints = [...input].map(c => c.codePointAt(0).toString(16)).join('-');
        d = {
            name: input, id: '\u2014', animated: false, raw: input,
            url: `https://twemoji.maxcdn.com/v/latest/72x72/${codePoints}.png`,
            typeKey: 'typeUnicode',
            origin: 'Discord',
            created: '\u2014',
            unicode: `U+${codePoints.toUpperCase()}`,
        };
    }

    const color = d.animated ? 0x9B59B6 : 0xFFD700;
    const items = [];

    // Header avec thumbnail (l'emoji lui-même)
    items.push({ thumbnail: [`# ${d.raw}\n*${t[d.typeKey]}*`, d.url] });

    // Identifiants
    items.push({ rule: true });
    items.push({ text:
        `\ud83d\udccc **${t.identifiers}**\n` +
        '```yaml\n' +
        `${t.name.padEnd(11)}: ${d.name}\n` +
        `${t.id.padEnd(11)}: ${d.id}\n` +
        `${t.animated.padEnd(11)}: ${d.animated ? '\u2728' : '\u2014'}\n` +
        '```'
    });

    // Origine
    items.push({ text:
        `\ud83c\udfe0 **${t.originLabel}**\n` +
        '```yaml\n' +
        `${t.guild.padEnd(11)}: ${d.origin}\n` +
        `${t.created.padEnd(11)}: ${d.created}\n` +
        '```'
    });

    if (d.unicode) {
        items.push({ text: `\ud83d\udd22 **Unicode** : \`${d.unicode}\`` });
    }

    // Lien direct
    items.push({ text: `\ud83d\udd17 [${t.sizeNote}](${d.url})` });

    // Footer
    items.push({ rule: true });
    items.push({ text: `-# ARCHON CG-223 \u2022 ${t.requestedBy} <@${userId}>` });

    return card(color, items);
}
