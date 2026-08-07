const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const fs = require('fs');

const LOADOUT_IMG_DIR = path.join(__dirname, '../assets/loadouts');
if (!fs.existsSync(LOADOUT_IMG_DIR)) fs.mkdirSync(LOADOUT_IMG_DIR, { recursive: true });

const WEAPON_KEYS = ['AK117','FFAR1','DLQ','KRM','TUNDRA','BP50','KN44','HS0405','RYTEC','HDR','BY15'];

const RESPONSES = {
    saved: (w) => [
        `✅ Image for **${w}** saved — it'll show up next time someone browses the armory.`,
        `🔫 **${w}** image locked in. Your server's loadout is looking sharp.`,
        `💾 Done! **${w}** now has a custom screenshot on this server.`,
    ],
    removed: (w) => [
        `🗑️ Image for **${w}** removed. Members will see a setup prompt instead.`,
        `✅ **${w}** image cleared from this server.`,
    ],
    noAttachment: [
        '📎 Attach a screenshot with this command — `.setloadout AK117` + image.',
        '🖼️ No image found. Send the command with a screenshot attached.',
    ],
    notFound: (w) => `❌ **${w}** isn\'t a recognized weapon. Available: \`${WEAPON_KEYS.join(', ')}\``,
    noPermission: '❌ You need **Manage Server** or **Administrator** permission to set loadout images.',
    failed: '⚠️ Something went wrong saving that image. Try again.',
    listTitle: '📋 **Loadout Images — This Server**\n',
};

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function downloadToFile(url, dest) {
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARCHON-Bot/2.0)', 'Accept': 'image/*,*/*' }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (!ct.startsWith('image/')) throw new Error(`Not an image: ${ct}`);
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length < 1000) throw new Error('File too small');
    fs.writeFileSync(dest, buffer);
    return dest;
}

function saveImageToDB(db, guildId, weaponKey, imagePath) {
    db.prepare(`INSERT OR REPLACE INTO loadout_images (guild_id, weapon_key, image_path, updated_at)
        VALUES (?, ?, ?, strftime('%s','now'))`).run(guildId, weaponKey, imagePath);
}

function removeImageFromDB(db, guildId, weaponKey) {
    db.prepare('DELETE FROM loadout_images WHERE guild_id = ? AND weapon_key = ?').run(guildId, weaponKey);
}

function clearOldImage(db, guildId, weaponKey) {
    try {
        const row = db.prepare('SELECT image_path FROM loadout_images WHERE guild_id = ? AND weapon_key = ?').get(guildId, weaponKey);
        if (row?.image_path && fs.existsSync(row.image_path)) fs.unlinkSync(row.image_path);
    } catch(e) {}
}

module.exports = {
    name: 'setloadout',
    aliases: ['setweapon', 'loadoutimg', 'weaponimg'],
    description: '🔫 Set or remove per-server weapon images for the loadout armory.',
    category: 'GAMING',
    cooldown: 5000,
    usage: '.setloadout <WEAPON> [remove] OR .setloadout list',

    data: new SlashCommandBuilder()
        .setName('setloadout')
        .setDescription('🔫 Set a custom weapon image for this server\'s loadout armory')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addStringOption(o => o
            .setName('weapon')
            .setDescription('Weapon name')
            .setRequired(true)
            .addChoices(...WEAPON_KEYS.map(k => ({ name: k, value: k })))
        )
        .addAttachmentOption(o => o
            .setName('image')
            .setDescription('Screenshot of the weapon loadout')
            .setRequired(false)
        )
        .addStringOption(o => o
            .setName('action')
            .setDescription('Remove the current image')
            .setRequired(false)
            .addChoices({ name: 'Remove image', value: 'remove' })
        ),

    run: async (client, message, args, db) => {
        try {
            const guildId = message.guild?.id;
            if (!guildId) return message.reply('❌ Server only.').catch(() => {});

            // Permission check
            const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
                || message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            if (!isAdmin) return message.reply(RESPONSES.noPermission).catch(() => {});

            const sub = args[0]?.toUpperCase();
            const action = args[1]?.toLowerCase();

            // List all set images
            if (sub === 'LIST' || !sub) {
                const rows = db.prepare('SELECT weapon_key, updated_at FROM loadout_images WHERE guild_id = ? ORDER BY weapon_key').all(guildId);
                if (!rows.length) {
                    return message.reply(
                        `${RESPONSES.listTitle}No weapon images set yet.\n\nUse \`.setloadout <WEAPON>\` + attach a screenshot to add one.\nAvailable weapons: \`${WEAPON_KEYS.join(', ')}\``
                    ).catch(() => {});
                }
                const set = rows.map(r => `✅ **${r.weapon_key}**`).join('\n');
                const missing = WEAPON_KEYS.filter(k => !rows.some(r => r.weapon_key === k)).map(k => `⬜ ${k}`).join('\n');
                return message.reply(`${RESPONSES.listTitle}\n${set}\n\n**Not set:**\n${missing}`).catch(() => {});
            }

            // Validate weapon
            if (!WEAPON_KEYS.includes(sub)) return message.reply(RESPONSES.notFound(sub)).catch(() => {});

            // Remove
            if (action === 'remove') {
                clearOldImage(db, guildId, sub);
                removeImageFromDB(db, guildId, sub);
                return message.reply(pick(RESPONSES.removed(sub))).catch(() => {});
            }

            // Save new image
            const attachment = message.attachments?.first();
            if (!attachment) return message.reply(pick(RESPONSES.noAttachment)).catch(() => {});

            const ct = attachment.contentType || '';
            if (!ct.startsWith('image/')) return message.reply('❌ That file doesn\'t look like an image.').catch(() => {});

            await message.react('⏳').catch(() => {});
            clearOldImage(db, guildId, sub);

            const guildDir = path.join(LOADOUT_IMG_DIR, guildId);
            if (!fs.existsSync(guildDir)) fs.mkdirSync(guildDir, { recursive: true });
            const dest = path.join(guildDir, `${sub}.jpg`);

            await downloadToFile(attachment.url, dest);
            saveImageToDB(db, guildId, sub, dest);
            await message.reply(pick(RESPONSES.saved(sub))).catch(() => {});

        } catch(err) {
            console.error('[SETLOADOUT]', err);
            message.reply(RESPONSES.failed).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const guildId = interaction.guild?.id;
            const db = client.db;
            const weapon = interaction.options.getString('weapon');
            const attachment = interaction.options.getAttachment('image');
            const action = interaction.options.getString('action');

            await interaction.deferReply({ flags: 64 });

            if (action === 'remove') {
                clearOldImage(db, guildId, weapon);
                removeImageFromDB(db, guildId, weapon);
                return interaction.editReply(pick(RESPONSES.removed(weapon)));
            }

            if (!attachment) {
                return interaction.editReply(
                    `${pick(RESPONSES.noAttachment)}\n\nTo set via slash command, use the \`image\` option to attach your screenshot.`
                );
            }

            const ct = attachment.contentType || '';
            if (!ct.startsWith('image/')) return interaction.editReply('❌ That file doesn\'t look like an image.');

            clearOldImage(db, guildId, weapon);
            const guildDir = path.join(LOADOUT_IMG_DIR, guildId);
            if (!fs.existsSync(guildDir)) fs.mkdirSync(guildDir, { recursive: true });
            const dest = path.join(guildDir, `${weapon}.jpg`);

            await downloadToFile(attachment.url, dest);
            saveImageToDB(db, guildId, weapon, dest);
            return interaction.editReply(pick(RESPONSES.saved(weapon)));

        } catch(err) {
            console.error('[SETLOADOUT SLASH]', err);
            interaction.editReply(RESPONSES.failed).catch(() => {});
        }
    }
};
