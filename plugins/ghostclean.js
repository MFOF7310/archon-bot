const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const EMOJIS = require('../config/emojis');

const GHOST_DAYS = 50;
const WHITELIST = [process.env.GUILD_ID];

function getGhostCandidates(db) {
    const now = Math.floor(Date.now() / 1000);
    const threshold = GHOST_DAYS * 86400;
    return db.prepare(`
        SELECT guild_id, guild_name, total_members,
               CAST((? - last_active) / 86400 AS INTEGER) as days_inactive
        FROM global_server_stats
        WHERE (? - last_active) >= ? AND guild_id != 'DM'
        ORDER BY days_inactive DESC
    `).all(now, now, threshold).filter(r => !WHITELIST.includes(r.guild_id));
}

async function handleGhostClean(client, reply, args, db, isOwner) {
    const subcommand = args[0]?.toLowerCase() || 'list';

    if (!isOwner) {
        return reply({
            embeds: [new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle(`${EMOJIS.warning} Access Restricted`)
                .setDescription(
                    `Hey! ${EMOJIS.wave}\n\n` +
                    `This command is reserved for the **System Architect** only.\n` +
                    `Need server help? Reach out to a moderator instead.\n\n` +
                    `${EMOJIS.eagle} *ARCHON CG-223 — Neural Grid*`
                )],
            flags: 64
        });
    }

    const candidates = getGhostCandidates(db);

    // ── LIST ──
    if (subcommand === 'list') {
        if (candidates.length === 0) {
            return reply({
                embeds: [new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle(`${EMOJIS.online} Ghost Scan Clear`)
                    .setDescription(`No ghost servers found. All nodes active above ${GHOST_DAYS}-day threshold.`)],
                flags: 64
            });
        }

        const fields = candidates.map((r, i) => {
            const inCache = client.guilds.cache.has(r.guild_id);
            const dot = inCache ? EMOJIS.online : EMOJIS.offline;
            return {
                name: `${i + 1}. ${dot} ${r.guild_name}`,
                value: `\`\`${r.guild_id}\`\` • ${r.total_members} members • ${r.days_inactive}d inactive`,
                inline: false
            };
        });

        return reply({
            embeds: [new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle(`${EMOJIS.warning} Ghost Servers — ${candidates.length} candidates`)
                .addFields(fields)
                .setFooter({ text: `Threshold: ${GHOST_DAYS}+ days • /ghostclean leave <id> | /ghostclean leaveall` })],
            flags: 64
        });
    }

    // ── SERVERS (name + ID only) ──
    if (subcommand === 'servers') {
        if (candidates.length === 0) {
            return reply({ content: `${EMOJIS.online} No ghost servers found.`, flags: 64 });
        }
        const fields = candidates.map((r, i) => ({
            name: `${i + 1}. ${r.guild_name}`,
            value: `\`${r.guild_id}\``,
            inline: true
        }));
        return reply({
            embeds: [new EmbedBuilder()
                .setColor('#3498db')
                .setTitle(`${EMOJIS.eagle} Ghost Server IDs`)
                .addFields(fields)
                .setFooter({ text: 'Tap an ID to copy • Use /ghostclean leave <id> to remove' })],
            flags: 64
        });
    }

    // ── LEAVE <guild_id> ──
    if (subcommand === 'leave') {
        const targetId = args[1];
        if (!targetId) return reply({ content: '❌ Provide a guild ID.', flags: 64 });
        if (WHITELIST.includes(targetId)) return reply({ content: '❌ That guild is whitelisted.', flags: 64 });
        const guild = client.guilds.cache.get(targetId);
        if (!guild) return reply({ content: `⚠️ Guild \`${targetId}\` not in cache.`, flags: 64 });
        const name = guild.name;
        await guild.leave();
        console.log(`[GHOSTCLEAN] Left: ${name} (${targetId})`);
        return reply({
            embeds: [new EmbedBuilder()
                .setColor('#e74c3c')
                .setTitle(`${EMOJIS.offline} Left Ghost Server`)
                .setDescription(`Successfully left **${name}** (\`${targetId}\`)`)
                .setTimestamp()],
            flags: 64
        });
    }

    // ── LEAVEALL ──
    if (subcommand === 'leaveall') {
        const inCache = candidates.filter(r => client.guilds.cache.has(r.guild_id));
        if (inCache.length === 0) return reply({ content: '⚠️ No ghost candidates in cache.', flags: 64 });

        if (args[1] !== 'confirm') {
            const preview = inCache.map(r => `${EMOJIS.warning} **${r.guild_name}** — ${r.days_inactive}d`).join('\n');
            return reply({
                embeds: [new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle(`${EMOJIS.warning} Confirm Mass Leave`)
                    .setDescription(`About to leave **${inCache.length}** servers:\n\n${preview}\n\n**Add \`confirm\` to proceed.**`)],
                flags: 64
            });
        }

        let left = 0, failed = 0;
        const results = [];
        for (const row of inCache) {
            const guild = client.guilds.cache.get(row.guild_id);
            if (!guild) { failed++; continue; }
            try {
                await guild.leave();
                left++;
                results.push(`${EMOJIS.online} Left **${row.guild_name}**`);
                console.log(`[GHOSTCLEAN] Left: ${row.guild_name} (${row.guild_id})`);
            } catch (e) {
                failed++;
                results.push(`${EMOJIS.error} Failed: **${row.guild_name}**`);
            }
        }

        return reply({
            embeds: [new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle(`${EMOJIS.eagle} Ghost Clean Complete`)
                .setDescription(results.join('\n'))
                .addFields({ name: 'Summary', value: `✅ Left: ${left} • ❌ Failed: ${failed}` })
                .setTimestamp()],
            flags: 64
        });
    }

    return reply({ content: '❓ Usage: `list | servers | leave <id> | leaveall [confirm]`', flags: 64 });
}

module.exports = {
    name: 'ghostclean',
    aliases: ['ghostservers', 'cleanghosts'],
    description: '👻 Ghost server management (owner only).',
    category: 'OWNER',
    usage: '.ghostclean [list | servers | leave <guild_id> | leaveall]',
    cooldown: 5000,

    data: new SlashCommandBuilder()
        .setName('ghostclean')
        .setDescription('👻 Ghost server management (owner only)')
        .addStringOption(opt =>
            opt.setName('action')
                .setDescription('Action')
                .setRequired(false)
                .addChoices(
                    { name: 'List ghost servers', value: 'list' },
                    { name: 'Show IDs only', value: 'servers' },
                    { name: 'Leave one server', value: 'leave' },
                    { name: 'Leave all ghosts', value: 'leaveall' }
                ))
        .addStringOption(opt =>
            opt.setName('guild_id')
                .setDescription('Guild ID to leave')
                .setAutocomplete(true)
                .setRequired(false))
        .addStringOption(opt =>
            opt.setName('confirm')
                .setDescription('Type confirm for leaveall')
                .setRequired(false)),

    async autocomplete(interaction, client) {
        const focusedValue = interaction.options.getFocused();
        const db = client.db;
        const candidates = getGhostCandidates(db);
        const filtered = candidates
            .filter(r =>
                r.guild_name.toLowerCase().includes(focusedValue.toLowerCase()) ||
                r.guild_id.includes(focusedValue)
            )
            .slice(0, 25);
        await interaction.respond(
            filtered.map(r => ({
                name: `${r.guild_name} (${r.days_inactive}d inactive)`,
                value: r.guild_id
            }))
        );
    },

    run: async (client, message, args, db) => {
        const isOwner = message.author.id === process.env.OWNER_ID;
        await handleGhostClean(client, o => message.reply(o).catch(() => {}), args, db, isOwner);
    },

    execute: async (interaction, client) => {
        await interaction.deferReply({ ephemeral: true });
        const isOwner = interaction.user.id === process.env.OWNER_ID;
        const action = interaction.options.getString('action') || 'list';
        const guildId = interaction.options.getString('guild_id') || '';
        const confirm = interaction.options.getString('confirm') || '';
        const args = [action, guildId || confirm].filter(Boolean);
        await handleGhostClean(client, o => interaction.editReply(o).catch(() => {}), args, client.db, isOwner);
    }
};
