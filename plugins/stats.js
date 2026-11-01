const { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');
const v2 = require('../lib/games/v2');
const { ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, MessageFlags } = require('discord.js');
const EMOJIS = require('../config/emojis');

// ================= BILINGUAL TRANSLATIONS =================

// ================= HELPER FUNCTIONS =================
function getEventLoopLag() {
    const start = Date.now();
    return new Promise(resolve => {
        setTimeout(() => {
            const lag = Date.now() - start - 100;
            resolve(Math.max(0, lag));
        }, 100);
    });
}

function getNetworkGraph(health) {
    const graphs = {
        '✅ HEALTHY': `${EMOJIS.screaminggreen || '🟢'}`.repeat(5),
        '⚠️ DEGRADED': `${EMOJIS.yellowcrown || '🟡'}`.repeat(3) + '⚪'.repeat(2),
        '🔴 CRITICAL': `${EMOJIS.red_color || '🔴'}`.repeat(2) + '⚪'.repeat(3)
    };
    return graphs[health] || '⚪⚪⚪⚪⚪⚪⚪⚪⚪⚪';
}

module.exports = {
    name: 'stats',
    aliases: ['botstats', 'statistiques', 'systemstats', 'sysinfo', 'diagnostics', 'status', 'etat'],
    description: '📊 Display live neural bot statistics and system telemetry.',
    category: 'SYSTEM',
    usage: '.stats',
    cooldown: 5000,
    examples: ['.stats', '.statistiques', '.status'],

    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('📊 Display live neural bot statistics and system telemetry'),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        
        
        const t = statsTranslations[lang] || statsTranslations['en'];
        const version = client.version || '1.8.0';
        const guildName = message.guild?.name?.toUpperCase() || 'NEURAL NODE';
        const guildIcon = message.guild?.iconURL() || client.user.displayAvatarURL();
        const prefix = serverSettings?.prefix || process.env.PREFIX || '.';

        let isDetailed = false;
        
        const generateStatsEmbed = async (detailed) => {
            const tr = (k) => t('stats.' + k, lang);
            
            // ================= SYSTEM METRICS =================
            const uptime = process.uptime();
            const d = Math.floor(uptime / 86400);
            const h = Math.floor((uptime % 86400) / 3600);
            const m = Math.floor((uptime % 3600) / 60);
            const uptimeStr = `${d}d ${h}h ${m}m`;

            const memory = process.memoryUsage();
            const heapUsed = (memory.heapUsed / 1024 / 1024).toFixed(1);
            const heapTotal = (memory.heapTotal / 1024 / 1024).toFixed(1);
            const rss = (memory.rss / 1024 / 1024).toFixed(1);

            const ping = Math.round(client.ws.ping);
            const totalUsers = client.guilds.cache.reduce((acc, g) => acc + g.memberCount, 0);
            const totalCommands = client.commands?.size || 0;
            const totalGuilds = client.guilds.cache.size;
            
            // ================= PER-SERVER STATS =================
            const currentGuild = message?.guild;
            let guildStats = '';
            if (currentGuild) {
                const guildMembers = currentGuild.memberCount;
                const guildOwner = await currentGuild.fetchOwner().catch(() => null);
                const guildOwnerName = guildOwner?.user?.username || 'Unknown';
                const guildBoostLevel = currentGuild.premiumTier || 0;
                const guildCreated = Math.floor(currentGuild.createdTimestamp / 1000);

                guildStats = `**${tr('servers')}** — ${currentGuild.name}\n**Owner** — ${guildOwnerName}\n**Members** — ${guildMembers}\n**Boost** — Tier ${guildBoostLevel}\n**Created** — <t:${guildCreated}:R>`;
            }

            // ================= API STATUS =================
            const groqStatus = process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY ? '✅' : '❌';
            const braveStatus = process.env.BRAVE_API_KEY ? '✅' : '❌';

            let dbStatus = '✅';
            try { db.prepare("SELECT 1").get(); } catch { dbStatus = '❌'; }

            // ================= CACHE STATS =================
            const cacheSize = client.userDataCache?.size || 0;
            const pendingWrites = client.pendingUserUpdates?.size || 0;

            // ================= EVENT LOOP LAG =================
            const eventLoopLag = await getEventLoopLag();

            // ================= SURPRISE: ECONOMY STATS =================
            const economyStats = db.prepare(`
                SELECT SUM(credits) as total_credits, AVG(credits) as avg_credits, MAX(credits) as max_credits
                FROM users
            `).get();

            let richestUser = 'N/A';
            if (economyStats.max_credits > 0) {
                const richest = db.prepare(`SELECT username, credits FROM users WHERE credits = ? LIMIT 1`).get(economyStats.max_credits);
                richestUser = richest ? `${richest.username} (${richest.credits.toLocaleString()} 🪙)` : 'N/A';
            }

            // ================= SURPRISE: GAME STATS =================
            const gameStats = db.prepare(`
                SELECT SUM(games_played) as total_games, SUM(games_won) as total_wins
                FROM users
            `).get();
            const totalGames = gameStats?.total_games || 0;
            const totalWins = gameStats?.total_wins || 0;
            const overallWinRate = totalGames > 0 ? Math.round((totalWins / totalGames) * 100) : 0;

            // ================= SURPRISE: BIRTHDAY STATS =================
            let birthdayCount = 0;
            let todayBirthdays = 0;
            const nowDate = new Date();
            try {
                birthdayCount = db.prepare(`SELECT COUNT(*) as count FROM birthdays`).get()?.count || 0;
                todayBirthdays = db.prepare(`SELECT COUNT(*) as count FROM birthdays WHERE day = ? AND month = ?`).get(nowDate.getDate(), nowDate.getMonth() + 1)?.count || 0;
            } catch (err) {}

            // ================= DETERMINE SYSTEM HEALTH =================
            let systemHealth = tr('healthy');
            let healthColor = 0x2ecc71;

            if (ping > 250 || groqStatus === '❌' || dbStatus === '❌' || eventLoopLag > 100) {
                systemHealth = tr('critical');
                healthColor = 0xe74c3c;
            } else if (ping > 100 || braveStatus === '❌' || pendingWrites > 50 || eventLoopLag > 50) {
                systemHealth = tr('degraded');
                healthColor = 0xf1c40f;
            }

            const networkGraph = getNetworkGraph(systemHealth);

            // ================= BUILD V2 CONTAINER =================
            const c = new ContainerBuilder().setAccentColor(healthColor);
            
            // Header
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJIS.developericon || '📊'} ${tr('title')}\n-# ${tr('desc')}`));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Core Stats
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**${tr('uptime')}** — \`${uptimeStr}\`\n` +
                `**${tr('latency')}** — \`${ping}ms\`\n` +
                `**${tr('memory')}** — \`${heapUsed}MB / ${heapTotal}MB\`\n` +
                `**${tr('platform')}** — \`${process.platform} (${process.arch})\``
            ));
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));

            // Server Info
            if (guildStats) {
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(guildStats));
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            }

            // API Status
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**${tr('apiStatus')}**\n` +
                `Groq: ${groqStatus} | Brave: ${braveStatus} | DB: ${dbStatus}`
            ));

            if (detailed) {
                c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**${EMOJIS.yellowcrown || '💰'} ${tr('economyStats')}**\n` +
                    `${tr('totalCredits')} — \`${(economyStats.total_credits || 0).toLocaleString()}\`\n` +
                    `${tr('richestAgent')} — ${richestUser}`
                ));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**${EMOJIS.boostericon || '🎮'} ${tr('gameStats')}**\n` +
                    `${tr('totalGames')} — \`${totalGames.toLocaleString()}\`\n` +
                    `${tr('winRate')} — \`${overallWinRate}%\``
                ));
                c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `**${EMOJIS.ownerroleicon || '🎂'} ${tr('birthdayCount')}**\n` +
                    `${tr('registered')} — \`${birthdayCount}\` | ${tr('today')} — \`${todayBirthdays}\``
                ));
            }

            // Network Health
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true));
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `**${tr('networkHealth')}** — ${systemHealth}\n` +
                `${networkGraph}\n` +
                `-# ${tr('eventLoop')}: ${eventLoopLag}ms`
            ));

            // Warnings
            if (groqStatus === '❌') c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${tr('missingGroq')}`));
            if (braveStatus === '❌') c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`⚠️ ${tr('missingBrave')}`));

            // Footer
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${guildName} • BAMAKO_223 🇲🇱 • v${version}`));

            return { components: [c], flags: MessageFlags.IsComponentsV2 };
        };
        
        const mainEmbed = await generateStatsEmbed(false);
        
        const refreshButton = new ButtonBuilder()
            .setCustomId('stats_refresh')
            .setLabel(t.refreshButton)
            .setStyle(ButtonStyle.Primary)
            .setEmoji('🔄');
            
        const toggleButton = new ButtonBuilder()
            .setCustomId('stats_toggle')
            .setLabel(t.detailedButton)
            .setStyle(ButtonStyle.Secondary)
            .setEmoji('📋');
        
        const row = new ActionRowBuilder().addComponents(refreshButton, toggleButton);
        
        const reply = await message.reply({
            ...mainEmbed,
            components: [...mainEmbed.components, row]
        }).catch(() => {});
        
        if (!reply) return;
        
        const collector = reply.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: 120000 
        });
        
        collector.on('collect', async (i) => {
            if (i.user.id !== (message.author?.id || message.user?.id)) {
                return i.reply({ content: lang === 'fr' ? `${resolveEmoji('error', i)} Ce menu ne vous appartient pas.` : `${resolveEmoji('error', i)} This menu is not yours.`, flags: 64 });
            }
            
            await i.deferUpdate();
            
            if (i.customId === 'stats_refresh') {
                const refreshedEmbed = await generateStatsEmbed(isDetailed);
                await i.editReply({ ...refreshedEmbed, components: [...refreshedEmbed.components, row] });
            }
            
            if (i.customId === 'stats_toggle') {
                isDetailed = !isDetailed;
                const newEmbed = await generateStatsEmbed(isDetailed);
                const newToggleButton = new ButtonBuilder()
                    .setCustomId('stats_toggle')
                    .setLabel(isDetailed ? t.summaryButton : t.detailedButton)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji(isDetailed ? '📊' : '📋');
                
                const newRow = new ActionRowBuilder().addComponents(refreshButton, newToggleButton);
                await i.editReply({ ...newEmbed, components: [...newEmbed.components, newRow] });
            }
        });
        
        collector.on('end', async () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                refreshButton.setDisabled(true),
                toggleButton.setDisabled(true)
            );
            await reply.edit({ components: [disabledRow] }).catch(() => {});
        });
    },

    // ================= SLASH COMMAND EXECUTION =================
    execute: async (interaction, client) => {
    const lang = require('../lib/i18n').slashLang(interaction, ['en', 'fr']);
    const t = statsTranslations[lang] || statsTranslations['en'];
    
    await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
    
    const fakeMessage = {
    user: interaction.user,
    author: interaction.user,
    guild: interaction.guild,
    channel: interaction.channel,
    reply: async (options) => interaction.editReply({ ...options }),
    react: () => Promise.resolve()
};

const serverSettings = interaction.guild ? client.getServerSettings(interaction.guild.id) : { prefix: '.' };

        await module.exports.run(client, fakeMessage, [], client.db, serverSettings, lang === 'fr' ? 'statistiques' : 'stats', lang);
    }
};