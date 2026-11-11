// lib/handlers/welcome.js — Welcome, Profile, and Birthday buttons
const { t } = require('../i18n');
const em = (k, fb) => { try { return require('../../config/emojis')[k] || fb; } catch { return fb; } };

module.exports = async function(interaction, client, memberChoice, initializeUser, cacheUserData) {
    if (interaction.isButton() && interaction.customId === 'welcome_help') {
        const _ssH = interaction.guild ? (client.getServerSettings?.(interaction.guild.id) || {}) : {};
        const _langH = _ssH.language && _ssH.language !== 'auto'
            ? _ssH.language
            : (memberChoice(interaction.user.id, interaction.guildId || 'DM') || ['fr', 'zh', 'ar'].find((l) => String(interaction.locale || '').toLowerCase().startsWith(l)) || 'en');
        try {
            await interaction.reply(require('../welcome-help').buildWelcomeHelp({
                lang: _langH, prefix: _ssH.prefix || process.env.PREFIX || '.', guildName: interaction.guild?.name,
            }));
        } catch (e) { console.error('[WELCOME HELP]', e.message); }
        return;
    }

    // ================= AI ASSISTANT BUTTON HANDLER (COMPONENTS V2) =================
    if (interaction.isButton() && interaction.customId === 'welcome_ai_assistant') {
        try {
                        
            let activeChannels = [];
            if (client.lydiaChannels && interaction.guild) {
                activeChannels = Object.keys(client.lydiaChannels).filter(id => interaction.guild.channels.cache.has(id));
            }
            
            // Use custom emoji if available, fallback to default robot emoji
            const aiEmoji = require('../../config/emojis').ai_assistant || require('../../config/emojis').ai_assitant || '🤖';
            
            const card = new ContainerBuilder()
                .setAccentColor(0x9b59b6) // Purple accent
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`## ${aiEmoji} AI Assistant`)
                )
                .addSeparatorComponents(
                    new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
                );
                
            if (activeChannels.length > 0) {
                const channelMentions = activeChannels.map(id => `<#${id}>`).join(', ');
                card.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`I'm here to help! Lydia is currently active in:\n\n${channelMentions}\n\nHead over there and mention me with your message, like <@${client.user.id}> hello to chat!`)
                );
            } else {
                card.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`I'm here to help! However, Lydia hasn't been activated in any channel yet.\n\nPlease ask a moderator to enable her.`)
                );
            }

            await interaction.reply({
                components: [card],
                flags: MessageFlags.IsComponentsV2 | 64 // Ephemeral
            });
        } catch (e) { console.error('[AI ASSISTANT BTN]', e.message); }
        return;
    }

    // ================= PROFILE BUTTON HANDLER (COMPOSITE KEY AWARE) =================
    if (interaction.isButton() && interaction.customId.startsWith('welcome_profile_')) {
        const _ssP = interaction.guild ? (client.getServerSettings?.(interaction.guild.id) || {}) : {};
        const lang = _ssP.language && _ssP.language !== 'auto' ? _ssP.language : (memberChoice(interaction.user.id, interaction.guildId || 'DM') || (interaction.locale?.startsWith('fr') ? 'fr' : 'en'));
        
        try {
            const clicker = interaction.user;
            const clickerId = clicker.id;
            // Resolve guildId from interaction context for composite key lookup
            const profileGuildId = interaction.guild?.id || 'DM';
            
            // Get the CLICKER'S data from database using composite key
            let userData = client.getUserData(clickerId, profileGuildId) || client.getUser(clickerId, profileGuildId);
            
            if (!userData) {
                userData = initializeUser(clickerId, profileGuildId, clicker.username);
                cacheUserData(clickerId, profileGuildId, userData);
            }
            
            const xp = userData?.xp || 0;
            const level = client.calculateLevel ? client.calculateLevel(xp) : 1;
            const credits = userData?.credits || 0;
            const streakDays = userData?.streak_days || 0;
            const totalMessages = userData?.total_messages || 0;
            const gamesPlayed = userData?.games_played || 0;
            const gamesWon = userData?.games_won || 0;
            const totalDailies = userData?.total_dailies || 0;
            const highestStreak = userData?.highest_streak || 0;
            
            const creationUnix = Math.floor(clicker.createdTimestamp / 1000);
            const ageDays = Math.floor((Date.now() - clicker.createdTimestamp) / 86400000);
            
            let joinUnix = null;
            let joinDays = null;
            if (interaction.guild) {
                const member = await interaction.guild.members.fetch(clickerId).catch(() => null);
                if (member?.joinedAt) {
                    joinUnix = Math.floor(member.joinedAt.getTime() / 1000);
                    joinDays = Math.floor((Date.now() - member.joinedAt.getTime()) / 86400000);
                }
            }
            
            let gamingInfo = '';
            try {
                const gaming = typeof userData?.gaming === 'string' 
                    ? JSON.parse(userData.gaming) 
                    : (userData?.gaming || { game: 'CODM', rank: 'Unranked' });
                gamingInfo = `🎮 ${gaming.game || 'CODM'} | ${gaming.rank || 'Unranked'}`;
            } catch (e) {
                gamingInfo = '🎮 CODM | Unranked';
            }
            
            const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
            const nextLevelXP = Math.pow(level / 0.1, 2);
            const xpProgress = xp - currentLevelXP;
            const xpNeeded = nextLevelXP - currentLevelXP;
            const progressPercent = Math.min(100, Math.floor((xpProgress / xpNeeded) * 100));
            
            const barLength = 10;
            const filledBars = Math.floor((progressPercent / 100) * barLength);
            const emptyBars = barLength - filledBars;
            const progressBar = '🟦'.repeat(filledBars) + '⬜'.repeat(emptyBars);
            
            // --- V2 CARD PROFILE ---
                        
            const c = new ContainerBuilder().setAccentColor(0x3498db);
            
            const pTitle = t('index.profile_title', lang, { username: clicker.username }).replace('👤', '').trim();
            const pStats = t('index.profile_stats_header', lang).replace('📊', '').replace('###', '').trim();
            
            const section = new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${em('myprofile', '👤')} ${pTitle}\n### ${em('ic_chart', '📊')} ${pStats}`))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(clicker.displayAvatarURL({ size: 256 })));
            c.addSectionComponents(section);
            
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            
            const cleanBar = progressBar.replace(/🟦/g, '█').replace(/⬜/g, '░');
            const statsText = 
                `**${t('index.stat_level', lang)}:** ${level}  ·  **XP:** ${xp.toLocaleString()} / ${Math.floor(nextLevelXP).toLocaleString()}\n` +
                `\`${cleanBar}\` **${progressPercent}%**\n\n` +
                `${em('ic_credit', '🪙')} **${t('index.stat_credits', lang)}:** ${credits.toLocaleString()}\n` +
                `${em('ic_streak', '🔥')} **${t('index.stat_daily_streak', lang)}:** ${streakDays}  ·  ${em('trophy', '💎')} **${t('index.stat_best_streak', lang)}:** ${highestStreak}\n` +
                `${em('ic_chart', '📊')} **${t('index.stat_total_dailies', lang)}:** ${totalDailies}\n\n` +
                `${em('ic_general', '💬')} **${t('index.stat_messages', lang)}:** ${totalMessages.toLocaleString()}\n` +
                `${em('gameController', '🎮')} **${t('index.stat_games_played', lang)}:** ${gamesPlayed}  ·  🥇 **${t('index.stat_wins', lang)}:** ${gamesWon}`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(statsText));
            
            c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
            
            const footerText = 
                `${em('ic_calendar', '📅')} **${t('index.stat_account_created', lang)}:** <t:${creationUnix}:D> *(${ageDays} ${t('index.stat_days', lang)})*\n` +
                `${em('role', '🏛️')} **${t('index.stat_joined_server', lang)}:** ` + (joinUnix ? `<t:${joinUnix}:D> *(${joinDays} ${t('index.stat_days', lang)})*` : t('index.stat_na', lang)) + `\n` +
                `${em('gameController', '🎮')} **Gaming:** ${gamingInfo.replace('🎮 ', '')}`;
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
            
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${em('developericon', '🏗️')} Architect CG-223 • ${interaction.guild?.name || 'DM'}`));
            
            await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | 1 << 6 });
            
        } catch (err) {
            console.error('[PROFILE BUTTON ERROR]', err);
            await interaction.reply({ 
                content: t('index.profile_error', lang), 
                flags: MessageFlags.Ephemeral 
            });
        }
        return;
    }
    
    // ================= BIRTHDAY CELEBRATION BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_celebrate_')) {
        const userId = interaction.customId.replace('bday_celebrate_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: MessageFlags.Ephemeral });
        }
        
        const messages = {
            en: [
                `${em('party', '🎉')} **${interaction.user.username}** celebrates **${user.username}**'s birthday! ${em('cake', '🎂')}`,
                `${em('party', '🎈')} **${interaction.user.username}** sends birthday wishes to **${user.username}**! ${em('ic_gift', '🎁')}`,
                `${em('party', '🎊')} **${interaction.user.username}** joins the birthday celebration for **${user.username}**! ${em('party', '🎉')}`
            ],
            fr: [
                `${em('party', '🎉')} **${interaction.user.username}** celebre l'anniversaire de **${user.username}**! ${em('cake', '🎂')}`,
                `${em('party', '🎈')} **${interaction.user.username}** envoie ses veux a **${user.username}**! ${em('ic_gift', '🎁')}`,
                `${em('party', '🎊')} **${interaction.user.username}** se joint a la fete de **${user.username}**! ${em('party', '🎉')}`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    
    // ================= BIRTHDAY GIFT BUTTON =================
    if (interaction.isButton() && interaction.customId.startsWith('bday_gift_')) {
        const userId = interaction.customId.replace('bday_gift_', '');
        const user = await client.users.fetch(userId).catch(() => null);
        
        if (!user) {
            return interaction.reply({ content: 'User not found!', flags: MessageFlags.Ephemeral });
        }
        
        const messages = {
            en: [
                `🎁 **${interaction.user.username}** sends a virtual gift to **${user.username}**! ${em('cake', '🎂')}`,
                `💝 **${interaction.user.username}** sends birthday love to **${user.username}**! 🎈`,
                `${em('star', '🌟')} **${interaction.user.username}** celebrates with **${user.username}**! Happy Birthday! ${em('party', '🎉')}`
            ],
            fr: [
                `🎁 **${interaction.user.username}** envoie un cadeau virtuel a **${user.username}**! ${em('cake', '🎂')}`,
                `💝 **${interaction.user.username}** envoie de l'amour a **${user.username}**! 🎈`,
                `${em('star', '🌟')} **${interaction.user.username}** fait la fete avec **${user.username}**! Joyeux anniversaire! ${em('party', '🎉')}`
            ]
        };
        
        const lang = interaction.locale?.startsWith('fr') ? 'fr' : 'en';
        const randomMsg = messages[lang][Math.floor(Math.random() * messages[lang].length)];
        
        await interaction.reply({ content: randomMsg });
        return;
    }
    

    return false;
};
