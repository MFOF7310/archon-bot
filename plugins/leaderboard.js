const {
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType
} = require('discord.js');


// ================= SYNCED HELPERS =================

// Level formula (MATCHES rank.js)
function calculateLevel(xp) {
    return Math.floor(0.1 * Math.sqrt(xp));
}

// XP curve inverse
function calculateProgress(xp, level) {

    const xpCurrent =
        Math.pow(level, 2) * 100;

    const xpNext =
        Math.pow(level + 1, 2) * 100;

    const percent =
        Math.floor(
            ((xp - xpCurrent) /
            (xpNext - xpCurrent)) * 100
        );

    return Math.max(
        0,
        Math.min(percent, 100)
    );
}

// Progress bar
function createProgressBar(percent, length = 12) {

    const filled =
        Math.floor((percent / 100) * length);

    const empty =
        length - filled;

    return (
        '█'.repeat(filled) +
        '░'.repeat(empty)
    );
}

// Rank icons
function getRankIcon(rank) {

    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';

    if (rank <= 10) return '🔹';

    if (rank <= 50) return '▪️';

    return '▫️';
}



// ================= LANGUAGE PACK =================

const LANG = {

    fr: {

        scanning:
            "🔍 Analyse des fréquences neurales... classement acquis.",

        totalAgents:
            "AGENTS TOTAUX",

        syncStatus:
            "STATUT SYNC",

        pos:
            "VOTRE POSITION",

        next:
            "pour dépasser",

        apex:
            "👑 **AGENT APEX:** Vous dominez actuellement le secteur.",

        empty:
            "📊 **BASE VIDE:** Aucune donnée détectée.",

        gaming:
            "📊 CLASSEMENTS GAMING"
    },

    en: {

        scanning:
            "🔍 Scanning neural frequencies... standings acquired.",

        totalAgents:
            "TOTAL AGENTS",

        syncStatus:
            "SYNC STATUS",

        pos:
            "YOUR POSITION",

        next:
            "to overtake",

        apex:
            "👑 **APEX AGENT:** You are currently leading the sector.",

        empty:
            "📊 **DATABASE EMPTY:** No data detected.",

        gaming:
            "📊 GAMING LEADERBOARDS"
    }

};



// ================= MAIN COMMAND =================

module.exports = {

    name: 'leaderboard',

    aliases: [
        'lb',
        'top',
        'rankings',
        'classement',
        'paliers'
    ],

    category: 'SYSTEM',

    run: async (
        client,
        message,
        args,
        db
    ) => {

        // Detect language
        const cmdUsed =
            message.content
            .split(' ')[0]
            .toLowerCase();

        const isFrench =
            cmdUsed.includes('classement') ||
            cmdUsed.includes('paliers');

        const lang =
            isFrench ? 'fr' : 'en';

        const t =
            LANG[lang];



        // Gaming triggers
        const sub =
            args[0]?.toLowerCase();

        const gamingTriggers = [

            'games',
            'wins',
            'gaming',
            'played',
            'winnings',

            'gains',
            'victoires',
            'argent',

            'wr',
            'taux'

        ];

        if (gamingTriggers.includes(sub)) {

            return showGameLeaderboard(
                client,
                message,
                sub,
                db,
                lang
            );

        }



        // Fetch leaderboard
        const entries =
            db.prepare(`
            SELECT id, username, xp
            FROM users
            ORDER BY xp DESC
            LIMIT 100
            `).all();

        if (entries.length === 0)
            return message.reply(t.empty);



        // Total users (single query)
        const totalUsers =
            db.prepare(
                "SELECT COUNT(*) as count FROM users"
            ).get().count;



        // Current user data
        const userData =
            db.prepare(`
            SELECT xp
            FROM users
            WHERE id = ?
            `).get(
                message.author.id
            );

        const userXP =
            userData?.xp || 0;

        const userLevel =
            calculateLevel(userXP);

        const rankData =
            db.prepare(`
            SELECT COUNT(*) as rank
            FROM users
            WHERE xp > ?
            `).get(userXP);

        const userRank =
            (rankData?.rank || 0) + 1;



        // Gap calculation
        let motive = "";

        const aheadUser =
            db.prepare(`
            SELECT xp, username
            FROM users
            WHERE xp > ?
            ORDER BY xp ASC
            LIMIT 1
            `).get(userXP);

        if (
            aheadUser &&
            userRank > 1
        ) {

            const gap =
                aheadUser.xp - userXP;

            motive =
                `▫️ ${t.next} **${aheadUser.username}** (#${userRank - 1}): **+${gap.toLocaleString()} XP**`;

        }

        else if (
            userRank === 1
        ) {

            motive =
                t.apex;

        }



        // Pagination
        const pageSize = 5;

        const maxPage =
            Math.ceil(
                entries.length / pageSize
            ) - 1;

        let currentPage = 0;



        // Generate Embed
        const generateEmbed =
            (page) => {

            const start =
                page * pageSize;

            const pageEntries =
                entries.slice(
                    start,
                    start + pageSize
                );

            let desc =
                `**NODE:** \`BKO-223\`\n` +
                `**${t.totalAgents}:** \`${totalUsers}\`\n` +
                `**${t.syncStatus}:** \`🟢 ACTIVE\`\n\n`;



            pageEntries.forEach(
                (user, idx) => {

                const globalRank =
                    start + idx + 1;

                const icon =
                    getRankIcon(
                        globalRank
                    );

                const level =
                    calculateLevel(
                        user.xp
                    );

                const percent =
                    calculateProgress(
                        user.xp,
                        level
                    );

                const bar =
                    createProgressBar(
                        percent,
                        10
                    );

                desc +=
                    `${icon} **${user.username || 'Unknown'}**\n`;

                desc +=
                    `╰ \`LVL ${level}\` • \`${user.xp.toLocaleString()} XP\`\n`;

                desc +=
                    `╰ \`[${bar}]\` **${percent}%**\n\n`;

            });



            return new EmbedBuilder()

                .setColor('#00fbff')

                .setAuthor({

                    name:
                        `📊 ARCHITECT | ` +
                        (isFrench
                            ? 'CLASSEMENT SYNC'
                            : 'HIGH-SYNC STANDINGS'),

                    iconURL:
                        client.user.displayAvatarURL()

                })

                .setDescription(desc)

                .addFields({

                    name:
                        `🛰️ ${t.pos}`,

                    value:
                        `\`\`\`prolog\n` +
                        `Rank: #${userRank} | Level: ${userLevel}\n` +
                        `XP: ${userXP.toLocaleString()}\n` +
                        `${motive}\`\`\``

                })

                .setFooter({

                    text:
                        `Page ${page + 1}/${maxPage + 1} • Eagle Community`

                })

                .setTimestamp();

        };



        // Buttons
        const generateButtons =
            (page) => {

            return new ActionRowBuilder()

                .addComponents(

                    new ButtonBuilder()

                        .setCustomId('prev')

                        .setLabel('◀')

                        .setStyle(
                            ButtonStyle.Secondary
                        )

                        .setDisabled(
                            page === 0
                        ),

                    new ButtonBuilder()

                        .setCustomId('next')

                        .setLabel('▶')

                        .setStyle(
                            ButtonStyle.Primary
                        )

                        .setDisabled(
                            page === maxPage
                        )

                );

        };



        const lbMsg =
            await message.reply({

                content:
                    `> **${t.scanning}**`,

                embeds: [
                    generateEmbed(0)
                ],

                components: [
                    generateButtons(0)
                ]

            });



        // Collector
        const collector =
            lbMsg.createMessageComponentCollector({

                componentType:
                    ComponentType.Button,

                filter:
                    i =>
                        i.user.id ===
                        message.author.id,

                time: 60000

            });



        collector.on(
            'collect',
            async (i) => {

            if (
                i.customId === 'prev'
            )
                currentPage--;

            if (
                i.customId === 'next'
            )
                currentPage++;

            await i.update({

                embeds: [
                    generateEmbed(
                        currentPage
                    )
                ],

                components: [
                    generateButtons(
                        currentPage
                    )
                ]

            });

        });



        collector.on(
            'end',
            () => {

            lbMsg
                .edit({
                    components: []
                })
                .catch(() => null);

        });

    }

};



// ================= GAMING LEADERBOARD =================

async function showGameLeaderboard(
    client,
    message,
    type,
    db,
    lang
) {

    const orderBy =
        ['winnings','gains','argent']
        .includes(type)

        ? 'total_winnings DESC'

        : 'games_won DESC';



    const players =
        db.prepare(`
        SELECT username,
               games_played,
               games_won,
               total_winnings
        FROM users
        WHERE games_played > 0
        ORDER BY ${orderBy}
        LIMIT 10
        `).all();



    if (players.length === 0) {

        return message.reply(
            "📊 No gaming data yet."
        );

    }



    const list =
        players.map((p, i) => {

        const medal =
            getRankIcon(i + 1);

        return (
            `${medal} **${p.username || 'Unknown'}** ` +
            `• 🏆 ${p.games_won} ` +
            `• 💰 ${(p.total_winnings || 0).toLocaleString()}`
        );

    }).join('\n');



    const embed =
        new EmbedBuilder()

        .setColor('#FEE75C')

        .setTitle(
            '═ GAMING LEADERBOARD ═'
        )

        .setDescription(
            `\`\`\`yaml\n${list}\`\`\``
        )

        .setTimestamp();



    message.reply({
        embeds: [embed]
    });

}