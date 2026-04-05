const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'rank',
    aliases: ['level', 'xp', 'rang', 'niveau', 'dossier'],
    description: 'Display neural synchronization level.',
    category: 'PROFILE',

    run: async (client, message, args, db) => {

        const target =
            message.mentions.users.first() ||
            message.author;

        // Detect language from alias used
        const cmdUsed = message.content
            .split(' ')[0]
            .replace('.', '')
            .toLowerCase();

        const isFrench =
            ['rang', 'niveau'].includes(cmdUsed);

        // Language pack
        const LANG = {
            noData: isFrench
                ? `❌ **Agent ${target.username}** n'a aucune donnée enregistrée.`
                : `❌ **Agent ${target.username}** has no recorded data.`,

            level: isFrench ? 'Niveau' : 'Level',
            rank: isFrench ? 'Classement' : 'Rank',
            total: isFrench ? 'Total' : 'Total',
            messages: isFrench ? 'Messages' : 'Messages',
            games: isFrench ? 'Parties' : 'Games',
            progress: isFrench
                ? 'PROGRESSION'
                : 'PROGRESS',
            combat: isFrench
                ? 'MATRICE DE COMBAT'
                : 'COMBAT MATRIX',

            syncGap: isFrench
                ? 'XP requis'
                : 'XP needed',

            awaiting: isFrench
                ? 'EN_ATTENTE_DE_DONNÉES'
                : 'AWAITING_DATA',

            setGame: isFrench
                ? 'Utilisez .setgame'
                : 'Use .setgame'
        };

        // Database fetch
        let targetData = db
            .prepare("SELECT * FROM users WHERE id = ?")
            .get(target.id);

        if (!targetData) {
            return message.reply(LANG.noData);
        }

        // XP + LEVEL sync formula
        const xp = targetData.xp || 0;

        const level =
            Math.floor(0.1 * Math.sqrt(xp));

        const totalMessages =
            targetData.total_messages || 0;

        const gamesPlayed =
            targetData.games_played || 0;

        const gamesWon =
            targetData.games_won || 0;

        const winRate =
            gamesPlayed > 0
                ? Math.round(
                      (gamesWon / gamesPlayed) * 100
                  )
                : 0;

        // Rank calculation
        const rankData = db
            .prepare(
                "SELECT COUNT(*) as rank FROM users WHERE xp > ?"
            )
            .get(xp);

        const rank =
            (rankData?.rank || 0) + 1;

        const totalUsers =
            db.prepare(
                "SELECT COUNT(*) as count FROM users"
            ).get()?.count || 1;

        // Progress to next level
        const nextLevelXP =
            Math.pow(level + 1, 2) * 100;

        const currentLevelXP =
            Math.pow(level, 2) * 100;

        const progressXP =
            xp - currentLevelXP;

        const xpNeeded =
            nextLevelXP - xp;

        const percent =
            Math.floor(
                (progressXP /
                    (nextLevelXP -
                        currentLevelXP)) *
                    100
            );

        // Progress Bar
        const createBar = (p) => {

            const size = 12;

            const filled =
                Math.round(
                    (size * p) / 100
                );

            return (
                '▰'.repeat(filled) +
                '▱'.repeat(size - filled)
            );
        };

        // Rank Title System
        function getTier(level) {

            if (isFrench) {

                if (level >= 100)
                    return '🏆 LÉGENDAIRE';

                if (level >= 75)
                    return '👑 SEIGNEUR';

                if (level >= 50)
                    return '🔱 COMMANDANT';

                if (level >= 25)
                    return '💠 SPÉCIALISTE';

                if (level >= 10)
                    return '✨ AGENT ÉLITE';

                if (level >= 5)
                    return '⚡ OPÉRATEUR';

                return '🌱 RECRUE';
            }

            // English

            if (level >= 100)
                return '🏆 LEGENDARY';

            if (level >= 75)
                return '👑 WARLORD';

            if (level >= 50)
                return '🔱 COMMANDER';

            if (level >= 25)
                return '💠 SPECIALIST';

            if (level >= 10)
                return '✨ ELITE AGENT';

            if (level >= 5)
                return '⚡ OPERATIVE';

            return '🌱 RECRUIT';
        }

        const tierBadge =
            getTier(level);

        // Gaming matrix
        let combatMatrixValue;

        if (targetData.gaming) {

            try {

                const gameData =
                    JSON.parse(
                        targetData.gaming
                    );

                combatMatrixValue =
                    `\`\`\`prolog\n` +
                    `┌─ PRIMARY SECTOR: ${gameData.game}\n` +
                    `├─ COMBAT MODE: ${gameData.mode || 'Standard'}\n` +
                    `└─ RANK/TIER: ${gameData.rank}\`\`\``;

            } catch {

                combatMatrixValue =
                    `\`\`\`fix\n` +
                    `STATUS: ${LANG.awaiting}\n` +
                    `${LANG.setGame}\`\`\``;
            }

        } else {

            combatMatrixValue =
                `\`\`\`fix\n` +
                `STATUS: ${LANG.awaiting}\n` +
                `${LANG.setGame}\`\`\``;
        }

        // Embed
        const dossierEmbed =
            new EmbedBuilder()

                .setColor(
                    getLevelColor(level)
                )

                .setAuthor({

                    name:
                        isFrench
                            ? `DOSSIER AGENT: ${target.username.toUpperCase()}`
                            : `AGENT DOSSIER: ${target.username.toUpperCase()}`,

                    iconURL:
                        target.displayAvatarURL({
                            dynamic: true
                        })
                })

                .setThumbnail(
                    target.displayAvatarURL({
                        dynamic: true,
                        size: 512
                    })
                )

                .setDescription(
                    `**Node:** \`BKO-223\`\n` +
                        `**Status:** \`🟢 SYNC_OK\`\n` +
                        `**Classification:** \`${tierBadge}\``
                )

                .addFields(

                    {
                        name:
                            '📊 SYNC TELEMETRY',

                        value:
                            `\`\`\`ansi\n` +
                            `\u001b[1;36m▣\u001b[0m ${LANG.level}: ${level}\n` +
                            `\u001b[1;34m▣\u001b[0m ${LANG.rank}: #${rank}/${totalUsers}\n` +
                            `\u001b[1;32m▣\u001b[0m ${LANG.total}: ${xp.toLocaleString()} XP\n` +
                            `\u001b[1;33m▣\u001b[0m ${LANG.messages}: ${totalMessages}\n` +
                            `\u001b[1;35m▣\u001b[0m ${LANG.games}: ${gamesPlayed} (${winRate}% WR)\`\`\``,

                        inline: false
                    },

                    {
                        name:
                            `🚀 ${LANG.progress}`,

                        value:
                            `\`\`\`ansi\n` +
                            `\u001b[1;33m${createBar(percent)}\u001b[0m ${percent}%\`\`\`\n` +
                            `*${LANG.syncGap}: ${xpNeeded} XP*`,

                        inline: false
                    },

                    {
                        name:
                            `🎮 ${LANG.combat}`,

                        value:
                            combatMatrixValue,

                        inline: false
                    }
                )

                .setFooter({

                    text:
                        'EAGLE COMMUNITY • BKO-223',

                    iconURL:
                        message.guild.iconURL() ||
                        client.user.displayAvatarURL()
                })

                .setTimestamp();

        message.reply({
            embeds: [dossierEmbed]
        });
    }
};

// Level color system
function getLevelColor(level) {

    if (level >= 100) return '#F1C40F';

    if (level >= 75) return '#9B59B6';

    if (level >= 50) return '#ED4245';

    if (level >= 25) return '#EB459E';

    if (level >= 10) return '#FEE75C';

    if (level >= 5) return '#57F287';

    return '#5865F2';
}