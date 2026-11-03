// plugins/tictactoe.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EMOJIS = require('../config/emojis');
const i18n   = require('../lib/i18n');

function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        key: 'rank_1', color: '#2ecc71', emoji: '🌱' },
    { minLevel: 6,  maxLevel: 15,       key: 'rank_2', color: '#3498db', emoji: '🔹' },
    { minLevel: 16, maxLevel: 30,       key: 'rank_3', color: '#9b59b6', emoji: '💠' },
    { minLevel: 31, maxLevel: 50,       key: 'rank_4', color: '#e67e22', emoji: '⚜️' },
    { minLevel: 51, maxLevel: Infinity, key: 'rank_5', color: '#e74c3c', emoji: '👑' },
];
function getRank(level) {
    return AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
}

function t(lang, key, vars) { return i18n.t(`tictactoe.${key}`, lang, vars); }

const activeGames = new Map();

function buildBoard(board, active) {
    const rows = [];
    for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
            const idx = i * 3 + j;
            let style = ButtonStyle.Secondary;
            let label = '▫️';
            if (board[idx] === 'X') { style = ButtonStyle.Danger;  label = '❌'; }
            if (board[idx] === 'O') { style = ButtonStyle.Primary; label = '⭕'; }
            row.addComponents(
                new ButtonBuilder()
                    .setCustomId(`ttt_${idx}`)
                    .setLabel(label)
                    .setStyle(style)
                    .setDisabled(!!board[idx] || !active)
            );
        }
        rows.push(row);
    }
    return rows;
}

function checkWinner(board) {
    const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (const [a,b,c] of wins) {
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return board[a];
    }
    return board.includes(null) ? null : 'tie';
}

function gameEmbed(challenger, opponent, turn, cLevel, oLevel, cRank, oRank, lang, client, guildName) {
    const rankName = (rank) => t(lang, rank.key);
    return new EmbedBuilder()
        .setColor('#9b59b6')
        .setAuthor({ name: t(lang, 'entry_label'), iconURL: client.user.displayAvatarURL() })
        .setTitle(`${EMOJIS.duel_sword} ${challenger.username}  vs  ${opponent.username}`)
        .addFields(
            { name: `❌ ${challenger.username}`, value: `${cRank.emoji} ${rankName(cRank)} · Lv.${cLevel}`, inline: true },
            { name: `⭕ ${opponent.username}`,   value: `${oRank.emoji} ${rankName(oRank)} · Lv.${oLevel}`, inline: true },
        )
        .setDescription(t(lang, 'turn_label', { mark: turn === challenger.id ? '❌' : '⭕', name: turn === challenger.id ? challenger.username : opponent.username }))
        .setFooter({ text: `${t(lang, 'winner_takes')} · ${t(lang, 'time_left')}` })
        .setTimestamp();
}

module.exports = {
    name: 'ttt',
    aliases: ['tictactoe', 'morpion', 'oxo', 'tic'],
    description: '⚔️ Challenge a friend to tic-tac-toe with credits on the line.',
    category: 'GAMING',
    usage: '.ttt @user',
    cooldown: 5000,
    examples: ['.ttt @friend'],

    run: async (client, message, args, db) => {
        const guildId = message.guild?.id ?? 'DM';
        const lang = client.detectLanguage ? client.detectLanguage('tictactoe', guildId) : 'en';

        const entryFee    = 50;
        const winnerReward = 100;
        const challenger  = message.author;
        const opponent    = message.mentions.users.first();

        // ── Guards ──
        if (!opponent || opponent.id === challenger.id || opponent.bot) {
            return message.reply(
                opponent?.id === challenger.id ? t(lang, 'cant_challenge_self')
                : opponent?.bot               ? t(lang, 'cant_challenge_bot')
                :                               t(lang, 'invalid_target')
            ).catch(() => {});
        }

        const gameKey    = `${challenger.id}_${opponent.id}`;
        const reverseKey = `${opponent.id}_${challenger.id}`;
        if (activeGames.has(gameKey) || activeGames.has(reverseKey)) {
            return message.reply(t(lang, 'already_playing')).catch(() => {});
        }

        const cData = client.getUserData ? client.getUserData(challenger.id, guildId) : db.prepare('SELECT * FROM users WHERE id=? AND guild_id=?').get(challenger.id, guildId);
        const oData = client.getUserData ? client.getUserData(opponent.id,  guildId) : db.prepare('SELECT * FROM users WHERE id=? AND guild_id=?').get(opponent.id,  guildId);

        if (!cData || (cData.credits || 0) < entryFee) return message.reply(t(lang, 'insufficient_credits')).catch(() => {});
        if (!oData || (oData.credits  || 0) < entryFee) return message.reply(t(lang, 'opponent_insufficient_credits', { name: opponent.username })).catch(() => {});

        // ── Deduct fees ──
        if (client.queueUserUpdate) {
            client.queueUserUpdate(challenger.id, guildId, { ...cData, credits: (cData.credits||0) - entryFee, username: challenger.username });
            client.queueUserUpdate(opponent.id,   guildId, { ...oData, credits: (oData.credits ||0) - entryFee, username: opponent.username  });
        } else {
            db.prepare('UPDATE users SET credits=credits-? WHERE id=? AND guild_id=?').run(entryFee, challenger.id, guildId);
            db.prepare('UPDATE users SET credits=credits-? WHERE id=? AND guild_id=?').run(entryFee, opponent.id,  guildId);
        }

        // ── Game state ──
        let board      = Array(9).fill(null);
        let turn       = challenger.id;
        let gameActive = true;
        activeGames.set(gameKey, { board, turn, gameActive, challenger, opponent, startTime: Date.now() });

        const cLevel = calculateLevel(cData?.xp || 0);
        const oLevel = calculateLevel(oData?.xp  || 0);
        const cRank  = getRank(cLevel);
        const oRank  = getRank(oLevel);
        const guildName = message.guild?.name || 'ARCHON';

        const msg = await message.reply({
            embeds: [gameEmbed(challenger, opponent, turn, cLevel, oLevel, cRank, oRank, lang, client, guildName)],
            components: buildBoard(board, true),
        }).catch(() => {});
        if (!msg) { activeGames.delete(gameKey); return; }

        const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

        collector.on('collect', async (i) => {
            if (!gameActive) return;
            if (i.user.id !== turn) return i.reply({ content: t(lang, 'not_your_turn'), flags: 64 }).catch(() => {});
            const idx = parseInt(i.customId.split('_')[1]);
            if (board[idx])   return i.reply({ content: t(lang, 'cell_taken'),    flags: 64 }).catch(() => {});

            await i.deferUpdate().catch(() => {});
            board[idx] = turn === challenger.id ? 'X' : 'O';
            const result = checkWinner(board);

            if (result) {
                gameActive = false;
                activeGames.delete(gameKey);
                collector.stop();

                // ── Tie ──
                if (result === 'tie') {
                    if (client.queueUserUpdate) {
                        client.queueUserUpdate(challenger.id, guildId, { ...(client.getUserData(challenger.id, guildId)||cData), credits: ((client.getUserData(challenger.id,guildId)||cData).credits||0)+entryFee });
                        client.queueUserUpdate(opponent.id,   guildId, { ...(client.getUserData(opponent.id,  guildId)||oData), credits: ((client.getUserData(opponent.id,  guildId)||oData).credits||0)+entryFee });
                    } else {
                        db.prepare('UPDATE users SET credits=credits+? WHERE id=? AND guild_id=?').run(entryFee, challenger.id, guildId);
                        db.prepare('UPDATE users SET credits=credits+? WHERE id=? AND guild_id=?').run(entryFee, opponent.id,  guildId);
                    }
                    const tieEmbed = new EmbedBuilder()
                        .setColor('#FEE75C')
                        .setAuthor({ name: t(lang, 'arena'), iconURL: client.user.displayAvatarURL() })
                        .setTitle(`🤝 ${t(lang, 'draw_title')}`)
                        .setDescription(t(lang, 'draw_desc'))
                        .addFields({ name: EMOJIS.duel_heart, value: t(lang, 'credits_returned'), inline: false })
                        .setTimestamp();
                    return i.editReply({ content: `🤝 <@${challenger.id}> <@${opponent.id}>`, embeds: [tieEmbed], components: buildBoard(board, false) }).catch(() => {});
                }

                // ── Win ──
                const winnerId = result === 'X' ? challenger.id : opponent.id;
                const loserId  = result === 'X' ? opponent.id   : challenger.id;
                const winner   = result === 'X' ? challenger     : opponent;
                const loser    = result === 'X' ? opponent       : challenger;

                const winnerData = client.getUserData ? (client.getUserData(winnerId, guildId) || (winnerId===challenger.id?cData:oData)) : db.prepare('SELECT * FROM users WHERE id=? AND guild_id=?').get(winnerId, guildId);
                const loserData  = client.getUserData ? (client.getUserData(loserId,  guildId) || (loserId ===challenger.id?cData:oData)) : db.prepare('SELECT * FROM users WHERE id=? AND guild_id=?').get(loserId,  guildId);

                const newWinnerXp    = (winnerData?.xp || 0) + 100;
                const newWinnerLevel = calculateLevel(newWinnerXp);
                const newWinnerRank  = getRank(newWinnerLevel);
                const winRate        = (((winnerData?.games_won||0)+1) / ((winnerData?.games_played||0)+1) * 100).toFixed(1);

                if (client.queueUserUpdate) {
                    client.queueUserUpdate(winnerId, guildId, { ...winnerData, credits: (winnerData.credits||0)+winnerReward, xp: newWinnerXp, games_played: (winnerData.games_played||0)+1, games_won: (winnerData.games_won||0)+1, username: winner.username });
                    client.queueUserUpdate(loserId,  guildId, { ...loserData,  xp: (loserData.xp||0)+25, games_played: (loserData.games_played||0)+1, username: loser.username });
                } else {
                    db.prepare('UPDATE users SET credits=credits+?,xp=xp+100,games_played=games_played+1,games_won=games_won+1 WHERE id=? AND guild_id=?').run(winnerReward, winnerId, guildId);
                    db.prepare('UPDATE users SET xp=xp+25,games_played=games_played+1 WHERE id=? AND guild_id=?').run(loserId, guildId);
                }

                // Duelist role
                if (message.guild) {
                    try {
                        const settings = client.getServerSettings ? client.getServerSettings(message.guild.id) : null;
                        const roleId   = settings?.duelistRoleId || process.env.DUELIST_ROLE_ID;
                        if (roleId) {
                            const member = await message.guild.members.fetch(winnerId).catch(() => null);
                            const role   = member && message.guild.roles.cache.get(roleId);
                            if (role && !member.roles.cache.has(roleId)) await member.roles.add(role, 'Neural arena winner').catch(() => {});
                        }
                    } catch (_) {}
                }

                const winEmbed = new EmbedBuilder()
                    .setColor('#57F287')
                    .setAuthor({ name: t(lang, 'arena'), iconURL: client.user.displayAvatarURL() })
                    .setTitle(`${EMOJIS.trophy} ${t(lang, 'win_title', { winner: winner.username })}`)
                    .addFields(
                        { name: t(lang, 'prize'),       value: `+${winnerReward} 🪙`,                                           inline: true },
                        { name: t(lang, 'xp_gain'),     value: '+100 XP',                                                        inline: true },
                        { name: t(lang, 'consolation', { loser: loser.username }), value: '+25 XP', inline: true },
                        { name: t(lang, 'win_rate'),    value: `${winRate}%`,                                                     inline: true },
                        { name: t(lang, 'rank'),        value: `${newWinnerRank.emoji} ${t(lang, newWinnerRank.key)} · Lv.${newWinnerLevel}`, inline: true },
                    )
                    .setTimestamp();

                // Level-up notice
                const oldLevel = calculateLevel(winnerData?.xp || 0);
                if (newWinnerLevel > oldLevel) {
                    winEmbed.setFooter({ text: `${t(lang, 'levelup_title')} — ${t(lang, 'levelup_desc', { username: winner.username, level: newWinnerLevel, emoji: newWinnerRank.emoji, rank: t(lang, newWinnerRank.key) })}` });
                }

                return i.editReply({ content: `🏆 <@${winnerId}>`, embeds: [winEmbed], components: buildBoard(board, false) }).catch(() => {});
            }

            // ── Next turn ──
            turn = turn === challenger.id ? opponent.id : challenger.id;
            await i.editReply({
                embeds: [gameEmbed(challenger, opponent, turn, cLevel, oLevel, cRank, oRank, lang, client, guildName)],
                components: buildBoard(board, true),
            }).catch(() => {});
        });

        collector.on('end', async (_, reason) => {
            if (!gameActive || reason !== 'time') return;
            gameActive = false;
            activeGames.delete(gameKey);

            if (client.queueUserUpdate) {
                client.queueUserUpdate(challenger.id, guildId, { ...(client.getUserData(challenger.id,guildId)||cData), credits: ((client.getUserData(challenger.id,guildId)||cData).credits||0)+entryFee });
                client.queueUserUpdate(opponent.id,   guildId, { ...(client.getUserData(opponent.id,  guildId)||oData), credits: ((client.getUserData(opponent.id,  guildId)||oData).credits||0)+entryFee });
            } else {
                db.prepare('UPDATE users SET credits=credits+? WHERE id=? AND guild_id=?').run(entryFee, challenger.id, guildId);
                db.prepare('UPDATE users SET credits=credits+? WHERE id=? AND guild_id=?').run(entryFee, opponent.id,  guildId);
            }

            const timeoutEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: t(lang, 'arena'), iconURL: client.user.displayAvatarURL() })
                .setTitle(`${EMOJIS.duel_wait} ${t(lang, 'timeout_title')}`)
                .setDescription(t(lang, 'timeout'))
                .setTimestamp();

            await msg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
        });

        console.log(`[TTT] ${challenger.tag} vs ${opponent.tag} | lang: ${lang}`);
    },
};
