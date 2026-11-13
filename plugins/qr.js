const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };

const T = {
    en: { title: '📱 QR Code', generating: '📱 Generating QR code...', usage: '`.qr <text>` or `.qr https://example.com`', footer: 'QR Code • Architect CG-223', download: 'Download PNG' },
    fr: { title: '📱 Code QR', generating: '📱 Génération du code QR...', usage: '`.qr <texte>` ou `.qr https://exemple.com`', footer: 'Code QR • Architect CG-223', download: 'Télécharger PNG' }
};

module.exports = {
    name: 'qr', aliases: ['qrcode', 'barcode', 'scan'],
    description: '📱 Generate QR codes from any text or URL instantly.',
    category: 'UTILITY', cooldown: 3000, usage: '.qr <text>', examples: ['.qr https://discord.com', '.qr Hello World!', '/qr text:Hello'],
    data: new SlashCommandBuilder().setName('qr').setDescription('📱 Generate a QR code').addStringOption(o => o.setName('text').setDescription('Text or URL to encode').setRequired(true)).addStringOption(o => o.setName('color').setDescription('QR colour: a name or #hex (default: black)').setRequired(false).setAutocomplete(true)).addIntegerOption(o => o.setName('size').setDescription('Size in pixels (100-1000, default: 500)').setRequired(false)),
    run: async (client, message, args, db, ss, used, lang) => {
        // The language was used here without being defined, so this command always failed ("lang is not defined")
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);

        const t = T[lang] || T.en, text = args.join(' ');
        if (!text) return message.reply(`${em('ic_off', '❌')} ${t.usage}`).catch(() => {});
        const loadingMsg = await message.reply(t.generating).catch(() => null);
        try {
            const size = 500;
            const color = '000000';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&margin=10`;
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(`\`\`\`\n${text.length > 200 ? text.substring(0, 200) + '...' : text}\n\`\`\``).setImage(qrUrl).setFooter({ text: `${size}×${size}px • ${t.footer}` }).setTimestamp();
            loadingMsg?.edit({ content: null, embeds: [embed] }).catch(() => {});
        } catch (e) { loadingMsg?.edit(em('ic_off', em('ic_off', '❌')) + ' Failed to generate QR code.').catch(() => {}); }
    },
    // colour names in the member's language, or the hex they typed (lib/colors)
    autocomplete: async (interaction, client) => {
        const lang = require('../lib/pick-lang').pickLang(client, interaction.guildId, interaction, interaction.user.id);
        const q = (() => { try { return interaction.options.getFocused(); } catch { return ''; } })();
        return interaction.respond(require('../lib/colors').suggest(q, ['en', 'fr', 'zh', 'ar'].includes(lang) ? lang : 'en')).catch(() => {});
    },
    execute: async (interaction) => {
        const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
        const t = T[lang] || T.en;
        const text = interaction.options.getString('text');
        const color = (require('../lib/colors').resolve(interaction.options.getString('color')) || '#000000').replace('#', '');
        const size = Math.min(1000, Math.max(100, interaction.options.getInteger('size') || 500));
        await interaction.deferReply();
        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&margin=10`;
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(`\`\`\`\n${text.length > 200 ? text.substring(0, 200) + '...' : text}\n\`\`\``).setImage(qrUrl).setFooter({ text: `${size}×${size}px • ${t.footer}` }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply(em('ic_off', em('ic_off', '❌')) + ' Failed to generate QR code.'); }
    }
};