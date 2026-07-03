const { EmbedBuilder, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    name: 'lookup',
    aliases: ['userinfo', 'investigate', 'scan'],
    description: '🔍 Owner-only: Deep scan a user across all databases',
    category: 'OWNER',
    cooldown: 3000,
    hidden: true,

    data: new SlashCommandBuilder()
        .setName('lookup')
        .setDescription('🔍 Deep scan a user across all databases')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to lookup')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('scope')
            .setDescription('Lookup scope')
            .addChoices(
                { name: '📊 Full Profile', value: 'full' },
                { name: '💰 Economy', value: 'economy' },
                { name: '⚠️ Moderation', value: 'mod' },
                { name: '🤖 AI Memory', value: 'ai' },
            )
        ),

    run: async (client, message, args, db, serverSettings) => {
        const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_DISCORD_ID;
        if (message.author.id !== OWNER_ID) {
            return message.reply('⛔ Owner only.').catch(() => {});
        }

        const target = message.mentions.users.first();
        if (!target) return message.reply('❌ Usage: `.lookup @user`').catch(() => {});

        const scope = args[1]?.toLowerCase() || 'full';
        const guildId = message.guild?.id;

        try {
            const embed = await buildLookupEmbed(client, db, target, guildId, scope);
            return message.reply({ embeds: [embed] }).catch(() => {});
        } catch (err) {
            console.error('[LOOKUP]', err.message);
            return message.reply('❌ Lookup failed: ' + err.message).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        const OWNER_ID = process.env.OWNER_ID || process.env.OWNER_DISCORD_ID;
        if (interaction.user.id !== OWNER_ID) {
            return interaction.reply({ content: '⛔ Owner only.', flags: 64 });
        }

        await interaction.deferReply({ flags: 64 });

        const target = interaction.options.getUser('user');
        const scope = interaction.options.getString('scope') || 'full';
        const guildId = interaction.guild?.id;

        try {
            const embed = await buildLookupEmbed(client, client.db, target, guildId, scope);
            return interaction.editReply({ embeds: [embed] });
        } catch (err) {
            console.error('[LOOKUP]', err.message);
            return interaction.editReply({ content: '❌ Lookup failed: ' + err.message });
        }
    }
};

async function buildLookupEmbed(client, db, target, guildId, scope) {
    const userId = target.id;

    // ── Fetch data ──
    const userData = guildId
        ? db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)
        : null;

    const allServers = db.prepare('SELECT guild_id, xp, level, credits, streak_days, total_dailies FROM users WHERE id = ?').all(userId);

    const warnings = db.prepare('SELECT reason, created_at, active FROM warnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 5').all(userId);

    const investments = db.prepare('SELECT amount, invested_at, claimed FROM investments WHERE user_id = ? ORDER BY invested_at DESC LIMIT 3').all(userId);

    const premium = db.prepare('SELECT * FROM user_premium WHERE user_id = ?').get(userId);

    const lydiaMem = db.prepare('SELECT COUNT(*) as cnt FROM lydia_memory WHERE user_id = ?').get(userId);

    const tickets = db.prepare('SELECT COUNT(*) as cnt FROM tickets WHERE user_id = ?').get(userId);

    // ── Build embed ──
    const lines = [];

    // Identity
    lines.push(
        '```ansi\n' +
        `\u001b[1;36m▸ USER     \u001b[0m${target.username}\n` +
        `\u001b[1;36m▸ ID       \u001b[0m${userId}\n` +
        `\u001b[1;36m▸ CREATED  \u001b[0m<t:${Math.floor(target.createdTimestamp / 1000)}:R>\n` +
        `\u001b[1;36m▸ SERVERS  \u001b[0m${allServers.length} servers tracked\n` +
        '```'
    );

    // Economy (current server)
    if (scope === 'full' || scope === 'economy') {
        if (userData) {
            lines.push(
                '```ansi\n' +
                '\u001b[1;33m── ECONOMY (this server) ──\u001b[0m\n' +
                `\u001b[1;36m▸ LEVEL    \u001b[0m${userData.level} (${userData.xp?.toLocaleString()} XP)\n` +
                `\u001b[1;36m▸ CREDITS  \u001b[0m${userData.credits?.toLocaleString()} 🪙\n` +
                `\u001b[1;36m▸ STREAK   \u001b[0m${userData.streak_days} days 🔥\n` +
                `\u001b[1;36m▸ DAILIES  \u001b[0m${userData.total_dailies} total\n` +
                '```'
            );
        }

        // Investments
        if (investments.length > 0) {
            const invLines = investments.map(i => {
                const age = Math.floor((Date.now() - i.invested_at) / 3600000);
                return `\u001b[1;36m▸\u001b[0m ${i.amount.toLocaleString()} 🪙 · ${age}h ago · ${i.claimed ? '✅' : '⏳'}`;
            }).join('\n');
            lines.push('```ansi\n\u001b[1;33m── INVESTMENTS ──\u001b[0m\n' + invLines + '\n```');
        }
    }

    // Moderation
    if (scope === 'full' || scope === 'mod') {
        const activeWarns = warnings.filter(w => w.active).length;
        if (warnings.length > 0) {
            const warnLines = warnings.map(w => {
                const date = `<t:${w.created_at}:R>`;
                return `${w.active ? '🔴' : '⚪'} ${w.reason?.slice(0, 40) || 'No reason'}`;
            }).join('\n');
            lines.push(`**⚠️ Warnings (${activeWarns} active)**\n${warnLines}`);
        } else {
            lines.push('✅ No warnings on record');
        }
    }

    // AI & Support
    if (scope === 'full' || scope === 'ai') {
        lines.push(
            '```ansi\n' +
            '\u001b[1;35m── AI & SUPPORT ──\u001b[0m\n' +
            `\u001b[1;36m▸ LYDIA MEM\u001b[0m ${lydiaMem?.cnt || 0} memories\n` +
            `\u001b[1;36m▸ TICKETS  \u001b[0m${tickets?.cnt || 0} created\n` +
            `\u001b[1;36m▸ PREMIUM  \u001b[0m${premium?.premium_active ? '✅ Active' : '❌ None'}\n` +
            '```'
        );
    }

    // Cross-server summary
    if (scope === 'full' && allServers.length > 1) {
        const totalXP = allServers.reduce((s, r) => s + (r.xp || 0), 0);
        const totalCredits = allServers.reduce((s, r) => s + (r.credits || 0), 0);
        lines.push(
            '```ansi\n' +
            '\u001b[1;32m── CROSS-SERVER TOTALS ──\u001b[0m\n' +
            `\u001b[1;36m▸ TOTAL XP \u001b[0m${totalXP.toLocaleString()}\n` +
            `\u001b[1;36m▸ TOTAL 🪙 \u001b[0m${totalCredits.toLocaleString()}\n` +
            '```'
        );
    }

    return new EmbedBuilder()
        .setColor('#00f0ff')
        .setAuthor({ name: `🔍 NEURAL SCAN · ${target.username}`, iconURL: target.displayAvatarURL() })
        .setThumbnail(target.displayAvatarURL({ size: 128 }))
        .setDescription(lines.join('\n'))
        .setFooter({ text: `BAMAKO_223 🇲🇱 · OWNER ONLY · scope: ${scope}` })
        .setTimestamp();
}
