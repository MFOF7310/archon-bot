const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['st', 'stat', 'statistiques'],
    description: 'Display detailed agent statistics and global rank.',
    category: 'PROFILE',

    run: async (client, message, args, db) => {

        let target = message.mentions.users.first();

        // Reply detection
        if (!target && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(
                    message.reference.messageId
                );
                target = repliedMsg.author;
            } catch {}
        }

        if (!target) target = message.author;

        // ===============================
        // LANGUAGE DETECTION
        // ===============================

        const cmdUsed = message.content
            .split(' ')[0]
            .toLowerCase();

        const isFrench = ['st','stat','statistiques']
            .some(a => cmdUsed.includes(a));

        const lang = isFrench ? 'fr' : 'en';

        // ===============================
        // DATABASE FETCH
        // ===============================

        let targetData =
            db.prepare("SELECT * FROM users WHERE id = ?")
            .get(target.id);

        if (!targetData) {

            return message.reply(
                lang === 'fr'
                ? `❌ **Agent ${target.username}** n'a aucune donnée enregistrée.`
                : `❌ **Agent ${target.username}** has no recorded data.`
            );
        }

        // ===============================
        // PARSE GAMING DATA
        // ===============================

        let gameData = null;

        if (targetData?.gaming) {

            try {

                gameData =
                    typeof targetData.gaming === 'string'
                    ? JSON.parse(targetData.gaming)
                    : targetData.gaming;

            } catch {}
        }

        // ===============================
        // XP + LEVEL CALCULATION
        // ===============================

        const xp = targetData?.xp || 0;

        const level =
            Math.floor(0.1 * Math.sqrt(xp)) + 1;

        const totalMessages =
            targetData?.total_messages || 0;

        // ===============================
        // GLOBAL RANK
        // ===============================

        const rankData =
            db.prepare(
                "SELECT COUNT(*) as rank FROM users WHERE xp > ?"
            ).get(xp);

        const globalRank =
            (rankData?.rank || 0) + 1;

        const totalUsersData =
            db.prepare(
                "SELECT COUNT(*) as count FROM users"
            ).get();

        const totalUsers =
            totalUsersData?.count || 1;

        // ===============================
        // XP PROGRESSION CURVE
        // ===============================

        const xpCurrentLevel =
            Math.pow((level - 1) / 0.1, 2);

        const xpNextLevel =
            Math.pow(level / 0.1, 2);

        const xpNeededTotal =
            xpNextLevel - xpCurrentLevel;

        const xpGainedInLevel =
            xp - xpCurrentLevel;

        const progressPercent =
            Math.min(
                100,
                Math.max(
                    0,
                    Math.floor(
                        (xpGainedInLevel / xpNeededTotal) * 100
                    )
                )
            );

        const xpNeeded =
            Math.ceil(xpNextLevel - xp);

        // ===============================
        // PROGRESS BAR
        // ===============================

        const createBar = (percent) => {

            const size = 15;

            const progress =
                Math.round(
                    (size * percent) / 100
                );

            return (
                '█'.repeat(progress) +
                '░'.repeat(size - progress)
            );
        };

        // ===============================
        // TIER SYSTEM (Bilingual)
        // ===============================

        let tierColor = '#5865F2';
        let tierLabel =
            isFrench ? 'RECRUE' : 'RECRUIT';
        let tierEmoji = '🌱';

        if (level >= 5) {

            tierColor = '#57F287';
            tierLabel =
                isFrench
                ? "OPÉRATEUR"
                : "OPERATIVE";

            tierEmoji = '⚡';
        }

        if (level >= 10) {

            tierColor = '#FEE75C';
            tierLabel =
                isFrench
                ? "AGENT ÉLITE"
                : "ELITE AGENT";

            tierEmoji = '✨';
        }

        if (level >= 25) {

            tierColor = '#EB459E';
            tierLabel =
                isFrench
                ? "SPÉCIALISTE"
                : "SPECIALIST";

            tierEmoji = '💠';
        }

        if (level >= 50) {

            tierColor = '#ED4245';
            tierLabel =
                isFrench
                ? "COMMANDANT BKO"
                : "BKO COMMANDER";

            tierEmoji = '🔱';
        }

        if (level >= 100) {

            tierColor = '#F1C40F';
            tierLabel =
                isFrench
                ? "ARCHITECTE SYSTÈME"
                : "SYSTEM ARCHITECT";

            tierEmoji = '👑';
        }

        // ===============================
        // EMBED BUILD
        // ===============================

        const statsEmbed =
            new EmbedBuilder()

            .setColor(tierColor)

            .setAuthor({
                name:
                    `${tierEmoji} ${target.username}`,
                iconURL:
                    target.displayAvatarURL({
                        dynamic: true,
                        size: 1024
                    })
            })

            .setTitle(
                lang === 'fr'
                ? '═ PROFIL NEURAL ═'
                : '═ NEURAL PROFILE ═'
            )

            .setThumbnail(
                target.displayAvatarURL({
                    dynamic: true,
                    size: 512
                })
            )

            .addFields(

                {
                    name:
                        lang === 'fr'
                        ? '📊 STATISTIQUES'
                        : '📊 GLOBAL STATS',

                    value:
`Level: ${level}
Rank: #${globalRank}/${totalUsers}
XP: ${xp.toLocaleString()}
Messages: ${totalMessages.toLocaleString()}`,

                    inline: false
                },

                {
                    name:
                        lang === 'fr'
                        ? '🌀 PROGRESSION XP'
                        : '🌀 XP PROGRESS',

                    value:
`\
\`\`\`
${createBar(progressPercent)} ${progressPercent}%
${xpNeeded.toLocaleString()} XP → Level ${level + 1}
\`\`\`
`,

                    inline: false
                }

            );

        // ===============================
        // COMBAT MATRIX
        // ===============================

        if (gameData && gameData.game) {

            statsEmbed.addFields({

                name: '🎮 COMBAT MATRIX',

                value:
`\
\`\`\`
Game: ${gameData.game}
Mode: ${gameData.mode || 'Standard'}
Rank: ${gameData.rank}
\`\`\`
`,

                inline: false
            });

        } else {

            statsEmbed.addFields({

                name: '🎮 COMBAT MATRIX',

                value:
`\
\`\`\`
NO DATA
Use: .setgame Game | Mode | Rank
\`\`\`
`,

                inline: false
            });
        }

        // ===============================
        // FINAL RESPONSE
        // ===============================

        message.reply({

            content:
                `> ${tierEmoji} ${tierLabel}`,

            embeds: [statsEmbed]

        });

    }
};