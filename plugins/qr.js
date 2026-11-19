// ═══════════════════════════════════════════════════════════════════════════
// /qr <text> [color] [size] — a QR code card for any text or link (image from api.qrserver.com)
// The text is shown under the code; a link also gets an Open button. Texts: lang/<l>/qr.json
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`qr.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };

function card(lang, text, { color = '000000', size = 500 } = {}, where) {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=12&format=png&color=${color}&bgcolor=ffffff&data=${encodeURIComponent(text)}`;
    const shown = String(text).replace(/`/g, "'");
    const items = [
        { text: `### ${icon('qr', where)} ${T(lang, 'title')}` },
        { media: [url, T(lang, 'alt')] },
        { text: `-# ${shown.length > 300 ? shown.slice(0, 300) + '…' : shown}\n-# ${size}×${size} px · ${T(lang, 'hint')}` },
    ];
    if (/^https?:\/\/\S+$/i.test(text) && text.length <= 512) {
        items.push({ row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(text).setLabel(T(lang, 'open'))) });
    }
    return v2.card(0x1D9E75, items);
}

module.exports = {
    name: 'qr', aliases: ['qrcode', 'barcode', 'scan'],
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    description: 'A QR code for any text or link',
    category: 'UTILITY', cooldown: 3000, usage: '.qr <text>', examples: ['.qr https://discord.com', '.qr Hello World!'],
    data: new SlashCommandBuilder().setName('qr').setDescription('A QR code for any text or link').setDescriptionLocalizations({ fr: 'Un QR code pour un texte ou un lien' })
        .addStringOption((o) => o.setName('text').setDescription('Text or link to encode').setRequired(true).setMaxLength(900))
        .addStringOption((o) => o.setName('color').setDescription('Code colour: a name or #hex (default: black)').setRequired(false).setAutocomplete(true))
        .addIntegerOption((o) => o.setName('size').setDescription('Size in pixels (150-1000, default 500)').setRequired(false).setMinValue(150).setMaxValue(1000)),
    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        const text = args.join(' ').trim();
        if (!text) return message.reply(`${icon('warn', message)} ${T(lang, 'usage')}`).catch(() => {});
        return message.reply(card(lang, text.slice(0, 900), {}, message)).catch(() => {});
    },
    // colour names in the member's language, or the hex they typed (lib/colors)
    autocomplete: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const q = (() => { try { return interaction.options.getFocused(); } catch { return ''; } })();
        return interaction.respond(require('../lib/colors').suggest(q, lang)).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        const color = (require('../lib/colors').resolve(interaction.options.getString('color')) || '#000000').replace('#', '');
        const size = Math.min(1000, Math.max(150, interaction.options.getInteger('size') || 500));
        return interaction.reply(card(lang, interaction.options.getString('text'), { color, size }, interaction));
    },
};
