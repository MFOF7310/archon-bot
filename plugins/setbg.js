const path = require('path');
const fs = require('fs');
const { SlashCommandBuilder } = require('discord.js');

const BG_DIR = path.join(__dirname, '../assets/backgrounds');
const BG_PRESETS = [
    { file: path.join(BG_DIR, 'bg1.jpg'), name: 'Manga Eye' },
    { file: path.join(BG_DIR, 'bg2.jpg'), name: 'Ninja' },
    { file: path.join(BG_DIR, 'bg3.jpg'), name: 'Dark Warrior' },
    { file: path.join(BG_DIR, 'bg4.jpg'), name: 'Shadow' },
    { file: path.join(BG_DIR, 'bg5.jpg'), name: 'Phantom' },
];

const RESPONSES = {
    saved: [
        '✅ Looking sharp! Background saved — run `.profile` to see it.',
        '🎨 Done! Your profile just got an upgrade. Try `.profile`.',
        '💾 Saved. Run `.profile` and see the magic.',
        '✅ Background locked in. `.profile` to preview.',
    ],
    preset: (name) => [
        `✅ Preset **${name}** set as your background!`,
        `🖼️ **${name}** looks clean — check it with \`.profile\`.`,
        `💠 Background switched to **${name}**. Run \`.profile\` to see it.`,
    ],
    reset: [
        '🔄 Background cleared — back to your default.',
        '✅ Reset done. Your profile is back to its original look.',
    ],
    noInput: [
        '📎 Send an image with this command to set it as your background.',
        '🖼️ Attach an image, or pick a preset: `.setbg 1` through `.setbg 5`.\nReset anytime with `.setbg reset`.',
    ],
    failed: [
        '❌ Could not save that image — make sure it\'s a valid jpg, png, or webp.',
        '⚠️ Something went wrong grabbing that image. Try again or use a preset.',
    ],
    badUrl: [
        '❌ That doesn\'t look like a valid image URL.',
        '⚠️ Couldn\'t read that URL. Attach the image directly instead.',
    ],
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function downloadToFile(url, dest) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; ARCHON-Bot/2.0)',
            'Accept': 'image/*,*/*'
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`Not an image: ${ct}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error('File too small — likely not a valid image');
    fs.writeFileSync(dest, buffer);
    return dest;
}

function getUserBgPath(userId, guildId) {
    const dir = path.join(BG_DIR, 'users', guildId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${userId}.jpg`);
}

function clearOldBg(userId, guildId) {
    const dest = getUserBgPath(userId, guildId);
    if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch(e) {}
    }
}

function saveBgToDB(db, userId, guildId, bgPath) {
    // Try UPDATE first, then INSERT OR IGNORE as fallback
    const updated = db.prepare(
        'UPDATE users SET profile_bg = ? WHERE id = ? AND guild_id = ?'
    ).run(bgPath, userId, guildId);
    if (updated.changes === 0) {
        // User row doesn't exist — insert minimal row
        db.prepare(
            'INSERT OR IGNORE INTO users (id, guild_id, username, xp, credits, level, profile_bg) VALUES (?, ?, ?, 0, 0, 1, ?)'
        ).run(userId, guildId, userId, bgPath);
    }
}

async function handleSetBg(client, message, args, db) {
    try {
        const guildId = message.guild?.id || 'DM';
        const userId = message.author.id;
        const attachment = message.attachments?.first();
        const urlArg = args[0]?.trim();

        // No input at all
        if (!attachment && !urlArg) {
            return message.reply(pick(RESPONSES.noInput)).catch(() => {});
        }

        // Reset
        if (urlArg === 'reset') {
            clearOldBg(userId, guildId);
            saveBgToDB(db, userId, guildId, null);
            return message.reply(pick(RESPONSES.reset)).catch(() => {});
        }

        // Preset number 1-5
        if (urlArg && /^[1-5]$/.test(urlArg)) {
            const preset = BG_PRESETS[parseInt(urlArg) - 1];
            clearOldBg(userId, guildId);
            saveBgToDB(db, userId, guildId, preset.file);
            return message.reply(pick(RESPONSES.preset(preset.name))).catch(() => {});
        }

        // Custom image — attachment takes priority over URL arg
        let srcUrl = null;
        if (attachment) {
            // Validate it's an image
            const ct = attachment.contentType || '';
            if (!ct.startsWith('image/') && !attachment.name?.match(/\.(jpg|jpeg|png|webp|gif)$/i)) {
                return message.reply(pick(RESPONSES.badUrl)).catch(() => {});
            }
            srcUrl = attachment.url;
        } else if (urlArg?.startsWith('http')) {
            srcUrl = urlArg;
        } else {
            return message.reply(pick(RESPONSES.badUrl)).catch(() => {});
        }

        await message.react('⏳').catch(() => {});

        // Clear old file first
        clearOldBg(userId, guildId);

        const dest = getUserBgPath(userId, guildId);
        await downloadToFile(srcUrl, dest);

        saveBgToDB(db, userId, guildId, dest);

        await message.reply(pick(RESPONSES.saved)).catch(() => {});
    } catch(err) {
        console.error('[SETBG]', err.message);
        message.reply(pick(RESPONSES.failed)).catch(() => {});
    }
}

module.exports = {
    name: 'setbg',
    aliases: ['profilebg', 'setbackground', 'bg'],
    description: '🖼️ Set your profile card background image.',
    category: 'PROFILE',
    usage: '.setbg [1-5 | reset] OR .setbg + attach image',
    cooldown: 10000,
    data: new SlashCommandBuilder()
        .setName('setbg')
        .setDescription('Set your profile card background image')
        .addIntegerOption(opt =>
            opt.setName('preset')
                .setDescription('Pick a preset background (1-5)')
                .setRequired(false)
                .addChoices(
                    { name: 'Manga Eye', value: 1 },
                    { name: 'Ninja', value: 2 },
                    { name: 'Dark Warrior', value: 3 },
                    { name: 'Shadow', value: 4 },
                    { name: 'Phantom', value: 5 }
                ))
        .addStringOption(opt =>
            opt.setName('reset')
                .setDescription('Type reset to remove your background')
                .setRequired(false)),


    run: async (client, message, args, db) => {
        await handleSetBg(client, message, args, db);
    },

    execute: async (interaction, client) => {
        try {
            const guildId = interaction.guild?.id || 'DM';
            const userId = interaction.user.id;
            const db = client.db;
            const preset = interaction.options.getInteger('preset');
            const action = interaction.options.getString('action');
            const attachment = interaction.options.getAttachment('image');

            await interaction.deferReply({ flags: 64 });

            // Reset
            if (action === 'reset') {
                clearOldBg(userId, guildId);
                saveBgToDB(db, userId, guildId, null);
                return interaction.editReply(pick(RESPONSES.reset));
            }

            // Preset
            if (preset) {
                const bg = BG_PRESETS[preset - 1];
                clearOldBg(userId, guildId);
                saveBgToDB(db, userId, guildId, bg.file);
                return interaction.editReply(pick(RESPONSES.preset(bg.name)));
            }

            // Custom attachment
            if (attachment) {
                const ct = attachment.contentType || '';
                if (!ct.startsWith('image/')) {
                    return interaction.editReply(pick(RESPONSES.badUrl));
                }
                clearOldBg(userId, guildId);
                const dest = getUserBgPath(userId, guildId);
                await downloadToFile(attachment.url, dest);
                saveBgToDB(db, userId, guildId, dest);
                return interaction.editReply(pick(RESPONSES.saved));
            }

            // Nothing provided
            return interaction.editReply(pick(RESPONSES.noInput));
        } catch(err) {
            console.error('[SETBG SLASH]', err);
            interaction.editReply(pick(RESPONSES.failed)).catch(() => {});
        }
    }
};
