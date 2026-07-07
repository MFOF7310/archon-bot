const { EmbedBuilder, SlashCommandBuilder, AttachmentBuilder } = require('discord.js');

const T = {
    en: { title: '📱 QR Code', generating: '📱 Generating QR code...', usage: '`.qr <text>` or `.qr https://example.com`', footer: 'QR Code • Architect CG-223', download: 'Download PNG' },
    fr: { title: '📱 Code QR', generating: '📱 Génération du code QR...', usage: '`.qr <texte>` ou `.qr https://exemple.com`', footer: 'Code QR • Architect CG-223', download: 'Télécharger PNG' }
};

module.exports = {
    name: 'qr', aliases: ['qrcode', 'barcode', 'scan'],
    description: '📱 Generate QR codes from any text or URL instantly.',
    category: 'UTILITY', cooldown: 3000, usage: '.qr <text>', examples: ['.qr https://discord.com', '.qr Hello World!', '/qr text:Hello'],
    data: new SlashCommandBuilder().setName('qr').setDescription('📱 Generate a QR code').addStringOption(o => o.setName('text').setDescription('Text or URL to encode').setRequired(true)).addStringOption(o => o.setName('color').setDescription('QR color (hex, default: black)').setRequired(false)).addIntegerOption(o => o.setName('size').setDescription('Size in pixels (100-1000, default: 500)').setRequired(false)),
    run: async (client, message, args, db, ss, used) => {
        const lang = client.detectLanguage ? client.detectLanguage(used, message.guild?.id) : 'en';
        const t = T[lang], text = args.join(' ');
        if (!text) return message.reply(`❌ ${t.usage}`).catch(() => {});
        const loadingMsg = await message.reply(t.generating).catch(() => null);
        try {
            const size = 500;
            const color = '000000';
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&margin=10`;
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(`\`\`\`\n${text.length > 200 ? text.substring(0, 200) + '...' : text}\n\`\`\``).setImage(qrUrl).setFooter({ text: `${size}×${size}px • ${t.footer}` }).setTimestamp();
            loadingMsg?.edit({ content: null, embeds: [embed] }).catch(() => {});
        } catch (e) { loadingMsg?.edit('❌ Failed to generate QR code.').catch(() => {}); }
    },
    execute: async (interaction) => {
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const t = T[lang];
        const text = interaction.options.getString('text');
        const color = (interaction.options.getString('color') || '000000').replace('#', '');
        const size = Math.min(1000, Math.max(100, interaction.options.getInteger('size') || 500));
        await interaction.deferReply();
        try {
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&color=${color}&margin=10`;
            const embed = new EmbedBuilder().setColor('#00fbff').setTitle(t.title).setDescription(`\`\`\`\n${text.length > 200 ? text.substring(0, 200) + '...' : text}\n\`\`\``).setImage(qrUrl).setFooter({ text: `${size}×${size}px • ${t.footer}` }).setTimestamp();
            await interaction.editReply({ embeds: [embed] });
        } catch (e) { interaction.editReply('❌ Failed to generate QR code.'); }
    }
};