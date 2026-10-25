const { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, SectionBuilder, ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp || 0)) + 1; }

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        key: 'recruit'    },
    { minLevel: 6,  maxLevel: 15,       key: 'agent'      },
    { minLevel: 16, maxLevel: 30,       key: 'specialist' },
    { minLevel: 31, maxLevel: 50,       key: 'commander'  },
    { minLevel: 51, maxLevel: Infinity, key: 'architect'  },
];

function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[0];
}

function getSortType(raw, lang) {
    const valid = ['xp','credits','messages','msg','streak','daily','wins','games'];
    const type = valid.includes(raw) ? raw : 'xp';
    let orderCol = 'xp';
    if (type === 'credits') orderCol = 'credits';
    else if (['messages','msg'].includes(type)) orderCol = 'total_messages';
    else if (['streak','daily'].includes(type)) orderCol = 'streak_days';
    else if (['wins','games'].includes(type))   orderCol = 'games_won';
    
    const tKey = { xp: 'xp', credits: 'credits', messages: 'messages', msg: 'messages', streak: 'streak', daily: 'streak', wins: 'wins', games: 'wins' }[type];
    return { orderCol, tKey };
}

async function getLeaderboardData(db, guildId, orderCol, userId) {
    const entries = db.prepare(
        `SELECT id, username, avatar, xp, credits, level, total_messages, streak_days, games_won
         FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC LIMIT 10`
    ).all(guildId);

    if (!entries.length) return null;

    const stats = db.prepare(
        'SELECT COUNT(*) as count, AVG(level) as avg_level FROM users WHERE guild_id = ?'
    ).get(guildId);

    const allIds = db.prepare(`SELECT id FROM users WHERE guild_id = ? ORDER BY ${orderCol} DESC`).all(guildId).map(r => r.id);
    const uIdx = allIds.indexOf(userId);
    const userRank = uIdx !== -1 ? `#${uIdx+1} / ${allIds.length}` : 'Not Ranked';

    return { entries, stats, userRank };
}

function buildV2Card(data, guildName, tKey, lang, context) {
    const { entries, stats, userRank } = data;
    
    const typeLabel = t(`leaderboard.types.${tKey}`, lang);
    const titleEmoji = resolveEmoji('trophy', context) || '🏆';

    const container = new ContainerBuilder()
        .setAccentColor(0x00f0ff)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`## ${titleEmoji} ${guildName} ${t('leaderboard.title', lang)}`)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`*${t('leaderboard.sortedBy', lang, { type: typeLabel })}*`)
        )
        .addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        const level = entry.level || calculateLevel(entry.xp);
        const rank = getRank(level);
        const rankName = t(`leaderboard.ranks.${rank.key}`, lang);
        
        // Custom Emojis for Top 3
        let medal = `**${i + 1}.**`;
        if (i === 0) medal = resolveEmoji('crown', context) || '🥇';
        if (i === 1) medal = '🥈';
        if (i === 2) medal = '🥉';

        // Better Avatar Fetching (Cache first, then CDN)
        let avatarUrl = `https://cdn.discordapp.com/embed/avatars/${parseInt(entry.id || '0') % 5}.png`;
        const cachedUser = context?.client?.users?.cache?.get(entry.id);
        if (cachedUser) {
            avatarUrl = cachedUser.displayAvatarURL({ extension: 'png', size: 128 });
        } else if (entry.avatar) {
            avatarUrl = `https://cdn.discordapp.com/avatars/${entry.id}/${entry.avatar}.png?size=128`;
        }

        const credStr = (entry.credits || 0) >= 1000
            ? `${((entry.credits||0)/1000).toFixed(1)}k`
            : String(entry.credits || 0);

        const coinsEmoji = resolveEmoji('coins', context) || '🪙';
        
        const statLine = t('leaderboard.stats', lang, {
            rank: rankName,
            level: level,
            xp: (entry.xp||0).toLocaleString(),
            coins: coinsEmoji,
            credits: credStr
        });

        // Fixed Spacing: Use standard line break instead of -#
        const text = `### ${medal} **${entry.username || 'Unknown'}**\n${statLine}`;

        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl))
        );
        
        if (i < entries.length - 1) {
            container.addSeparatorComponents(new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small));
        }
    }

    container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
    
    const footerText = t('leaderboard.footer', lang, {
        rank: userRank,
        count: stats.count,
        avg: (stats.avg_level || 0).toFixed(1)
    });
    
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${footerText}`));

    return { components: [container], flags: MessageFlags.IsComponentsV2 };
}

module.exports = {
    name: 'leaderboard',
    aliases: ['lb', 'top', 'classement', 'rich', 'richest', 'winners', 'gainers'],
    description: '🏆 See who is dominating the server.',
    category: 'ECONOMY',
    usage: '.leaderboard [xp|credits|messages|streak|wins]',
    cooldown: 8000,

    data: new SlashCommandBuilder().setName('leaderboard').setDescription('🏆 See who is dominating the server.')
        .addStringOption(o => o.setName('type').setDescription('Sort by').setRequired(false)
            .addChoices(
                { name: 'XP',          value: 'xp'       },
                { name: 'Credits',     value: 'credits'  },
                { name: 'Messages',    value: 'messages' },
                { name: 'Daily Streak',value: 'streak'   },
                { name: 'Games Won',   value: 'wins'     }
            )),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        try {
            if (!message.guild) return message.reply(`${resolveEmoji('error', message)} Server only.`).catch(() => {});

            const { orderCol, tKey } = getSortType((args[0] || 'xp').toLowerCase(), lang);
            const guildName = message.guild.name?.toUpperCase() || 'Neural Node';

            const data = await getLeaderboardData(db, message.guild.id, orderCol, message.author.id);
            
            if (!data) return message.reply(t('leaderboard.empty', lang)).catch(() => {});

            const card = buildV2Card(data, guildName, tKey, lang, message);
            await message.reply(card).catch(() => {});

        } catch(err) {
            console.error('[LEADERBOARD]', err);
            message.reply(`${resolveEmoji('error', message)} ${t('leaderboard.error', lang)}`).catch(() => {});
        }
    },

    execute: async (interaction, client) => {
        try {
            const lang = typeof client.detectLanguage === 'function' ? client.detectLanguage('leaderboard', interaction.guildId, interaction) : 'en';
            const { orderCol, tKey } = getSortType((interaction.options.getString('type') || 'xp').toLowerCase(), lang);
            const guildName = interaction.guild?.name?.toUpperCase() || 'Neural Node';

            const data = await getLeaderboardData(client.db, interaction.guild?.id, orderCol, interaction.user.id);
            
            if (!data) return interaction.reply({ content: t('leaderboard.empty', lang), flags: MessageFlags.Ephemeral });

            const card = buildV2Card(data, guildName, tKey, lang, interaction);
            await interaction.reply(card);

        } catch(err) {
            console.error('[LEADERBOARD SLASH]', err);
            const lang = typeof client.detectLanguage === 'function' ? client.detectLanguage('leaderboard', interaction.guildId, interaction) : 'en';
            const errorMsg = { content: `${resolveEmoji('error', interaction)} ${t('leaderboard.error', lang)}`, flags: MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) await interaction.editReply(errorMsg).catch(() => {});
            else await interaction.reply(errorMsg).catch(() => {});
        }
    }
};
