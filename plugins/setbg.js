const path = require('path');
const https = require('https');
const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

const BG_DIR = path.join(__dirname, '../assets/backgrounds');
const BG_PRESETS = [
    path.join(BG_DIR, 'bg1.jpg'),
    path.join(BG_DIR, 'bg2.jpg'),
    path.join(BG_DIR, 'bg3.jpg'),
    path.join(BG_DIR, 'bg4.jpg'),
    path.join(BG_DIR, 'bg5.jpg'),
];

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, res => {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            res.pipe(file);
            file.on('finish', () => { file.close(); resolve(dest); });
        }).on('error', e => { fs.unlink(dest, () => {}); reject(e); });
    });
}

module.exports = {
    name: 'setbg',
    aliases: ['profilebg', 'setbackground', 'bg'],
    description: '🖼️ Set your profile card background.',
    category: 'PROFILE',
    usage: '.setbg [1-5] OR .setbg + attach image',
    cooldown: 10000,

    data: new SlashCommandBuilder()
        .setName('setbg')
        .setDescription('🖼️ Set your profile card background')
        .addIntegerOption(o => o
            .setName('preset')
            .setDescription('Choose a preset background (1-5)')
            .setRequired(false)
            .addChoices(
                { name: '1 — Manga Eye', value: 1 },
                { name: '2 — Ninja', value: 2 },
                { name: '3 — Background 3', value: 3 },
                { name: '4 — Background 4', value: 4 },
                { name: '5 — Background 5', value: 5 }
            )),

    run: async (client, message, args, db) => {
        try {
            const guildId = message.guild?.id || 'DM';
            const userId = message.author.id;
            const attachment = message.attachments?.first();
            const urlArg = args[0];

            // No args — show help
            if (!attachment && !urlArg) {
                return message.reply(
                    '🖼️ **Set your profile background:**\n' +
                    '• `.setbg 1` to `.setbg 5` — choose a preset\n' +
                    '• `.setbg` + attach any image — use your own\n' +
                    '• `.setbg reset` — back to default'
                ).catch(() => {});
            }

            // Reset
            if (urlArg === 'reset') {
                db.prepare('UPDATE users SET profile_bg = NULL WHERE id = ? AND guild_id = ?').run(userId, guildId);
                return message.reply('✅ Background reset to default.').catch(() => {});
            }

            // Preset number
            if (urlArg && /^[1-5]$/.test(urlArg.trim())) {
                const presetPath = BG_PRESETS[parseInt(urlArg) - 1];
                db.prepare('UPDATE users SET profile_bg = ? WHERE id = ? AND guild_id = ?').run(presetPath, userId, guildId);
                return message.reply(`✅ Background set to preset **#${urlArg}**! Run \`.profile\` to see it.`).catch(() => {});
            }

            // Custom image attachment
            const srcUrl = attachment
                ? attachment.url.split('?')[0] // strip expiry params, re-download fresh
                : urlArg;

            if (!srcUrl?.startsWith('http')) {
                return message.reply('❌ Invalid URL or argument.').catch(() => {});
            }

            // Check file type
            const ext = srcUrl.split('.').pop()?.toLowerCase().split('?')[0];
            if (!['jpg','jpeg','png','webp','gif'].includes(ext) && !attachment) {
                return message.reply('❌ Only jpg, png, webp or gif images allowed.').catch(() => {});
            }

            const userBgDir = path.join(BG_DIR, 'users');
            if (!fs.existsSync(userBgDir)) fs.mkdirSync(userBgDir, { recursive: true });
            const dest = path.join(userBgDir, `${userId}.jpg`);

            await message.react('⏳').catch(() => {});
            await downloadFile(srcUrl, dest);

            db.prepare('UPDATE users SET profile_bg = ? WHERE id = ? AND guild_id = ?').run(dest, userId, guildId);
            await message.reply('✅ Background saved! Run `.profile` to see it. 🎨').catch(() => {});
        } catch(err) {
            console.error('[SETBG]', err);
            message.reply('❌ Failed to save background. Make sure the image URL is accessible.').catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const guildId = interaction.guild?.id || 'DM';
            const userId = interaction.user.id;
            const db = client.db;
            const preset = interaction.options.getInteger('preset');

            await interaction.deferReply({ flags: 64 });

            if (preset) {
                const presetPath = BG_PRESETS[preset - 1];
                db.prepare('UPDATE users SET profile_bg = ? WHERE id = ? AND guild_id = ?').run(presetPath, userId, guildId);
                return interaction.editReply(`✅ Background set to preset **#${preset}**! Run \`/profile\` to see it.`);
            }

            return interaction.editReply(
                '🖼️ **Set your profile background:**\n' +
                '• `/setbg preset:1-5` — choose a preset\n' +
                '• `.setbg` (prefix) + attach image — use your own\n' +
                '• `.setbg reset` — back to default'
            );
        } catch(err) {
            console.error('[SETBG SLASH]', err);
            interaction.editReply('❌ Failed.').catch(() => {});
        }
    }
};
