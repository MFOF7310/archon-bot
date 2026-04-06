const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'rang', 'niveau', 'dossier', 'profile', 'agent'],
    description: '📊 Display neural synchronization level and agent dossier.',
    category: 'PROFILE',
    usage: '.rank [@user]',
    cooldown: 3000,
    examples: ['.rank', '.rank @user'],

    run: async (client, message, args, db) => {

        // --- INTELLIGENT LANGUAGE DETECTION ---
        let lang = 'en';
        const guildSettings = client.settings?.get(message.guild?.id);
        if (guildSettings?.language) {
            lang = guildSettings.language;
        } else {
            const frenchKeywords = ['fr', 'francais', 'français', 'french', 'rang', 'niveau'];
            const content = message.content.toLowerCase();
            if (frenchKeywords.some(word => content.includes(word)) || message.guild?.preferredLocale === 'fr') {
                lang = 'fr';
            }
        }

        // --- TARGET USER ---
        const target = message.mentions.users.first() || message.author;
        const isSelf = target.id === message.author.id;
        const version = client.version || '1.3.2';

        // --- LANGUAGE PACK (Full Bilingual) ---
        const t = {
            fr: {
                title: (name) => `📜 DOSSIER AGENT: ${name.toUpperCase()}`,
                node: 'Nœud',
                status: 'Statut',
                syncOk: '🟢 SYNC_OK',
                classification: 'Classification',
                syncTelemetry: '📊 TÉLÉMÉTRIE NEURALE',
                level: 'Niveau',
                rank: 'Classement',
                total: 'Total',
                xp: 'XP',
                messages: 'Messages',
                games: 'Parties',
                winRate: '% VICTOIRES',
                progress: '🚀 PROGRESSION',
                syncGap: 'XP requis',
                combat: '🎮 MATRICE DE COMBAT',
                primarySector: 'SECTEUR PRINCIPAL',
                combatMode: 'MODE COMBAT',
                rankTier: 'RANG/ÉCHELON',
                awaiting: 'EN_ATTENTE_DE_DONNÉES',
                setGame: 'Utilisez .setgame',
                noData: (name) => `❌ **Agent ${name}** n'a aucune donnée enregistrée dans le système.`,
                footer: 'COMMUNAUTÉ EAGLE • BKO-223',
                agentSince: 'Agent depuis',
                neuralEfficiency: 'Efficacité Neurale',
                commandStats: 'STATS COMMANDES',
                dailyStreak: 'Série Quotidienne',
                credits: 'Crédits',
                wealthTier: 'Niveau de Richesse'
            },
            en: {
                title: (name) => `📜 AGENT DOSSIER: ${name.toUpperCase()}`,
                node: 'Node',
                status: 'Status',
                syncOk: '🟢 SYNC_OK',
                classification: 'Classification',
                syncTelemetry: '📊 NEURAL TELEMETRY',
                level: 'Level',
                rank: 'Rank',
                total: 'Total',
                xp: 'XP',
                messages: 'Messages',
                games: 'Games',
                winRate: 'WIN %',
                progress: '🚀 PROGRESS',
                syncGap: 'XP needed',
                combat: '🎮 COMBAT MATRIX',
                primarySector: 'PRIMARY SECTOR',
                combatMode: 'COMBAT MODE',
                rankTier: 'RANK/TIER',
                awaiting: 'AWAITING_DATA',
                setGame: 'Use .setgame',
                noData: (name) => `❌ **Agent ${name}** has no recorded data in the system.`,
                footer: 'EAGLE COMMUNITY • BKO-223',
                agentSince: 'Agent Since',
                neuralEfficiency: 'Neural Efficiency',
                commandStats: 'COMMAND STATS',
                dailyStreak: 'Daily Streak',
                credits: 'Credits',
                wealthTier: 'Wealth Tier'
            }
        }[lang];

        // --- DATABASE FETCH ---
        let targetData = db.prepare(`
            SELECT id, xp, credits, streak_days, created_at, 
                   games_played, games_won, total_messages, total_winnings 
            FROM users WHERE id = ?
        `).get(target.id);

        if (!targetData) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setDescription(t.noData(target.username))
                .setTimestamp();
            return message.reply({ embeds: [errorEmbed] });
        }

        // --- XP & LEVEL SYNC (Matches game.js formula) ---
        const xp = targetData.xp || 0;
        const level = Math.floor(0.1 * Math.sqrt(xp)) + 1;
        
        // --- CREDITS & WEALTH ---
        const credits = targetData.credits || 0;
        const streakDays = targetData.streak_days || 0;
        const totalWinnings = targetData.total_winnings || 0;
        
        // --- GAME STATS ---
        const gamesPlayed = targetData.games_played || 0;
        const gamesWon = targetData.games_won || 0;
        const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
        
        // --- MESSAGE STATS ---
        const totalMessages = targetData.total_messages || 0;
        
        // --- ACCOUNT AGE ---
        const createdAt = targetData.created_at ? new Date(targetData.created_at) : new Date();
        const accountAgeDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        // --- RANK CALCULATION (Global leaderboard position) ---
        const rankData = db.prepare("SELECT COUNT(*) as rank FROM users WHERE xp > ?").get(xp);
        const rank = (rankData?.rank || 0) + 1;
        const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get()?.count || 1;
        
        // --- PROGRESS TO NEXT LEVEL ---
        // Formula: Level = floor(0.1 * sqrt(XP)) + 1
        // Reverse: XP_for_level = ((level - 1) / 0.1)^2
        const currentLevelXP = Math.pow((level - 1) / 0.1, 2);
        const nextLevelXP = Math.pow(level / 0.1, 2);
        const xpForCurrentLevel = xp - currentLevelXP;
        const xpNeededForNext = nextLevelXP - currentLevelXP;
        const percent = Math.min(100, Math.max(0, (xpForCurrentLevel / xpNeededForNext) * 100));
        const xpRemaining = Math.ceil(nextLevelXP - xp);
        
        // --- PROGRESS BAR ---
        const createBar = (p) => {
            const size = 15;
            const filled = Math.round((size * p) / 100);
            return '█'.repeat(filled) + '░'.repeat(size - filled);
        };
        
        // --- AGENT RANK TITLES (Matches game.js) ---
        function getAgentRank(level) {
            if (lang === 'fr') {
                if (level >= 51) return '👑 ARCHITECTE SYSTÈME';
                if (level >= 31) return '⚜️ COMMANDANT BKO';
                if (level >= 16) return '💠 SPÉCIALISTE CYBER';
                if (level >= 6) return '🔹 AGENT DE TERRAIN';
                return '🌱 RECRUE NEURALE';
            }
            if (level >= 51) return '👑 SYSTEM ARCHITECT';
            if (level >= 31) return '⚜️ BKO COMMANDER';
            if (level >= 16) return '💠 CYBER SPECIALIST';
            if (level >= 6) return '🔹 FIELD AGENT';
            return '🌱 NEURAL RECRUIT';
        }
        
        // --- WEALTH TIERS (Credit-based) ---
        function getWealthTier(credits) {
            if (lang === 'fr') {
                if (credits >= 100000) return '🏆 LÉGENDE FINANCIÈRE';
                if (credits >= 50000) return '👑 MAGNAT';
                if (credits >= 15000) return '🏦 BARON';
                if (credits >= 5000) return '📈 INVESTISSEUR';
                if (credits >= 1000) return '💰 COLLECTIONNEUR';
                if (credits >= 100) return '🪙 PETIT PORTEFEUILLE';
                return '💀 SANS LE SOU';
            }
            if (credits >= 100000) return '🏆 FINANCIAL LEGEND';
            if (credits >= 50000) return '👑 MAGNATE';
            if (credits >= 15000) return '🏦 BARON';
            if (credits >= 5000) return '📈 INVESTOR';
            if (credits >= 1000) return '💰 COLLECTOR';
            if (credits >= 100) return '🪙 SMALL WALLET';
            return '💀 BROKE';
        }
        
        const agentRank = getAgentRank(level);
        const wealthTier = getWealthTier(credits);
        
        // --- LEVEL COLOR ---
        function getLevelColor(lvl) {
            if (lvl >= 51) return '#e74c3c';
            if (lvl >= 31) return '#e67e22';
            if (lvl >= 16) return '#9b59b6';
            if (lvl >= 6) return '#3498db';
            return '#2ecc71';
        }
        
        // --- NEURAL EFFICIENCY CALCULATION ---
        const neuralEfficiency = Math.min(100, Math.floor((gamesPlayed * 0.5) + (totalMessages * 0.1) + (streakDays * 2)));
        
        // --- COMBAT MATRIX (Gaming Data) ---
        let combatMatrixValue;
        if (targetData.gaming) {
            try {
                const gameData = JSON.parse(targetData.gaming);
                combatMatrixValue = `\`\`\`yaml\n${t.primarySector}: ${gameData.game}\n${t.combatMode}: ${gameData.mode || 'Standard'}\n${t.rankTier}: ${gameData.rank}\`\`\``;
            } catch {
                combatMatrixValue = `\`\`\`fix\nSTATUS: ${t.awaiting}\n${t.setGame}\`\`\``;
            }
        } else {
            combatMatrixValue = `\`\`\`fix\nSTATUS: ${t.awaiting}\n${t.setGame}\`\`\``;
        }
        
        // --- BUILD DOSSIER EMBED ---
        const dossierEmbed = new EmbedBuilder()
            .setColor(getLevelColor(level))
            .setAuthor({
                name: t.title(target.username),
                iconURL: target.displayAvatarURL({ dynamic: true })
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(
                `\`\`\`prolog\n` +
                `${t.node}: BKO-223 • ${t.status}: ${t.syncOk}\n` +
                `${t.classification}: ${agentRank}\n` +
                `Core: Groq LPU™ 70B\`\`\``
            )
            .addFields(
                {
                    name: t.syncTelemetry,
                    value: `\`\`\`ansi\n` +
                           `\u001b[1;36m▣\u001b[0m ${t.level}: ${level}\n` +
                           `\u001b[1;34m▣\u001b[0m ${t.rank}: #${rank}/${totalUsers}\n` +
                           `\u001b[1;32m▣\u001b[0m ${t.total}: ${xp.toLocaleString()} ${t.xp}\n` +
                           `\u001b[1;33m▣\u001b[0m ${t.messages}: ${totalMessages.toLocaleString()}\n` +
                           `\u001b[1;35m▣\u001b[0m ${t.games}: ${gamesPlayed.toLocaleString()} (${winRate}% ${t.winRate})\`\`\``,
                    inline: false
                },
                {
                    name: `💰 ${t.credits}`,
                    value: `**${credits.toLocaleString()}** 🪙\n└─ ${t.wealthTier}: ${wealthTier}`,
                    inline: true
                },
                {
                    name: `🔥 ${t.dailyStreak}`,
                    value: `**${streakDays}** ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: `🏆 ${t.total}`,
                    value: `**${totalWinnings.toLocaleString()}** 🪙 ${lang === 'fr' ? 'gagnés' : 'won'}`,
                    inline: true
                },
                {
                    name: `🚀 ${t.progress}`,
                    value: `\`\`\`\n${createBar(percent)} ${percent.toFixed(1)}%\n└─ ${t.syncGap}: ${xpRemaining.toLocaleString()} XP\`\`\``,
                    inline: false
                },
                {
                    name: `🧠 ${t.neuralEfficiency}`,
                    value: `**${neuralEfficiency}%** ${lang === 'fr' ? '• Niveau optimal' : '• Optimal level'}`,
                    inline: true
                },
                {
                    name: `📅 ${t.agentSince}`,
                    value: `<t:${Math.floor(createdAt.getTime() / 1000)}:R>\n└─ ${accountAgeDays} ${lang === 'fr' ? 'jours' : 'days'}`,
                    inline: true
                },
                {
                    name: t.combat,
                    value: combatMatrixValue,
                    inline: false
                }
            )
            .setFooter({
                text: `${t.footer} • v${version}`,
                iconURL: message.guild?.iconURL() || client.user.displayAvatarURL()
            })
            .setTimestamp();

        // --- ADD ARCHITECT SPECIAL MESSAGE ---
        const ARCHITECT_ID = process.env.OWNER_ID;
        if (target.id === ARCHITECT_ID) {
            dossierEmbed.addFields({
                name: '🏛️ ARCHITECT RECOGNITION',
                value: `The Creator walks among us. System honors its Architect.`,
                inline: false
            });
        }

        message.reply({ embeds: [dossierEmbed] });
    }
};