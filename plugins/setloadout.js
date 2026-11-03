// plugins/setloadout.js
// Per-server weapon images for the loadout armory. All text lives in lang/<locale>/setloadout.json.
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const fs = require('fs');
const i18n = require('../lib/i18n');

const LOADOUT_IMG_DIR = path.join(__dirname, '../assets/loadouts');
if (!fs.existsSync(LOADOUT_IMG_DIR)) fs.mkdirSync(LOADOUT_IMG_DIR, { recursive: true });

const WEAPON_KEYS = ['AK117','FFAR1','DLQ','KRM','TUNDRA','BP50','KN44','HS0405','RYTEC','HDR','BY15'];
const WEAPON_LIST = WEAPON_KEYS.join(', ');

// Prefix uses the server language (same as meta.js); slash uses slashLang, which also honours .mylang
const translator = (lang) => (k, v) => i18n.t(`setloadout.${k}`, lang, v);
const prefixLang = (client, guildId) =>
    client.detectLanguage ? client.detectLanguage('setloadout', guildId) : 'en';

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
    } catch (e) {}
}

function imagePathFor(guildId, weapon) {
    const dir = path.join(LOADOUT_IMG_DIR, guildId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `${weapon}.jpg`);
}

function listText(db, guildId, tr) {
    const rows = db.prepare('SELECT weapon_key FROM loadout_images WHERE guild_id = ? ORDER BY weapon_key').all(guildId);
    if (!rows.length) return `${tr('list_title')}\n\n${tr('list_empty', { list: WEAPON_LIST })}`;
    const setKeys = rows.map(r => r.weapon_key);
    const parts = [tr('list_title'), setKeys.map(w => tr('list_item_set', { weapon: w })).join('\n')];
    const missing = WEAPON_KEYS.filter(k => !setKeys.includes(k));
    if (missing.length) {
        parts.push(`${tr('list_missing')}\n${missing.map(w => tr('list_item_missing', { weapon: w })).join('\n')}`);
    }
    return parts.join('\n\n');
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
        .setDescription("🔫 Set a custom weapon image for this server's loadout armory")
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
        let tr = translator('en');
        try {
            const guildId = message.guild?.id;
            if (!guildId) return message.reply(tr('server_only')).catch(() => {});
            tr = translator(prefixLang(client, guildId));

            const isAdmin = message.member?.permissions?.has(PermissionFlagsBits.ManageGuild)
                || message.member?.permissions?.has(PermissionFlagsBits.Administrator);
            if (!isAdmin) return message.reply(tr('no_permission')).catch(() => {});

            const weapon = args[0]?.toUpperCase();
            const action = args[1]?.toLowerCase();

            if (!weapon || weapon === 'LIST') {
                return message.reply(listText(db, guildId, tr)).catch(() => {});
            }
            if (!WEAPON_KEYS.includes(weapon)) {
                return message.reply(tr('unknown_weapon', { weapon, list: WEAPON_LIST })).catch(() => {});
            }

            if (action === 'remove') {
                clearOldImage(db, guildId, weapon);
                removeImageFromDB(db, guildId, weapon);
                return message.reply(tr('removed', { weapon })).catch(() => {});
            }

            const attachment = message.attachments?.first();
            if (!attachment) return message.reply(tr('no_image_prefix')).catch(() => {});
            if (!(attachment.contentType || '').startsWith('image/')) {
                return message.reply(tr('not_image')).catch(() => {});
            }

            await message.react('⏳').catch(() => {});
            clearOldImage(db, guildId, weapon);
            const dest = imagePathFor(guildId, weapon);
            await downloadToFile(attachment.url, dest);
            saveImageToDB(db, guildId, weapon, dest);
            return message.reply(tr('saved', { weapon })).catch(() => {});
        } catch (err) {
            console.error('[SETLOADOUT]', err);
            message.reply(tr('failed')).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        let tr = translator('en');
        try {
            tr = translator(i18n.slashLang(interaction));
            const guildId = interaction.guild?.id;
            if (!guildId) return interaction.reply({ content: tr('server_only'), flags: 64 });

            const db = client?.db || interaction.client.db;
            const weapon = interaction.options.getString('weapon');
            const attachment = interaction.options.getAttachment('image');
            const action = interaction.options.getString('action');

            await interaction.deferReply({ flags: 64 });

            if (action === 'remove') {
                clearOldImage(db, guildId, weapon);
                removeImageFromDB(db, guildId, weapon);
                return interaction.editReply(tr('removed', { weapon }));
            }
            if (!attachment) return interaction.editReply(tr('no_image_slash'));
            if (!(attachment.contentType || '').startsWith('image/')) return interaction.editReply(tr('not_image'));

            clearOldImage(db, guildId, weapon);
            const dest = imagePathFor(guildId, weapon);
            await downloadToFile(attachment.url, dest);
            saveImageToDB(db, guildId, weapon, dest);
            return interaction.editReply(tr('saved', { weapon }));
        } catch (err) {
            console.error('[SETLOADOUT SLASH]', err);
            const reply = interaction.deferred || interaction.replied
                ? interaction.editReply(tr('failed'))
                : interaction.reply({ content: tr('failed'), flags: 64 });
            reply.catch(() => {});
        }
    }
};
