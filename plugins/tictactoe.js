// plugins/tictactoe.js
// Tic-tac-toe on a Components V2 card. The opponent must accept before anyone pays.
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const EMOJIS  = require('../config/emojis');
const i18n    = require('../lib/i18n');
const v2      = require('../lib/games/v2');
const mention = require('../lib/mentions');

const FEE       = 50;
const REWARD    = 100;
const WIN_XP    = 100;
const LOSS_XP   = 25;
const ACCEPT_MS = 60000;
const GAME_MS   = 120000;

const COLORS = { play: 0x9b59b6, win: 0x57f287, draw: 0xfee75c, loss: 0xed4245, neutral: 0x99aab5 };

const AGENT_RANKS = [
    { minLevel: 1,  maxLevel: 5,        key: 'rank_1', emoji: '🌱' },
    { minLevel: 6,  maxLevel: 15,       key: 'rank_2', emoji: '🔹' },
    { minLevel: 16, maxLevel: 30,       key: 'rank_3', emoji: '💠' },
    { minLevel: 31, maxLevel: 50,       key: 'rank_4', emoji: '⚜️' },
    { minLevel: 51, maxLevel: Infinity, key: 'rank_5', emoji: '👑' },
];
const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

// Players currently in a challenge or a match, so nobody plays two at once
const busy = new Set();

const calculateLevel = (xp) => Math.floor(0.1 * Math.sqrt(xp)) + 1;
const getRank = (level) => AGENT_RANKS.find(r => level >= r.minLevel && level <= r.maxLevel) || AGENT_RANKS[AGENT_RANKS.length - 1];
const unix = (ms) => Math.floor(ms / 1000);

function checkWinner(board) {
    for (const line of LINES) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) return { mark: board[a], line };
    }
    return board.includes(null) ? null : { mark: 'tie', line: [] };
}

// Board rows for the card; the winning line turns green
function boardRows(board, active, line = []) {
    const rows = [];
    for (let r = 0; r < 3; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 3; c++) {
            const idx = r * 3 + c;
            let style = ButtonStyle.Secondary;
            let label = '▫️';
            if (board[idx] === 'X') { style = ButtonStyle.Danger;  label = '❌'; }
            if (board[idx] === 'O') { style = ButtonStyle.Primary; label = '⭕'; }
            if (line.includes(idx)) style = ButtonStyle.Success;
            row.addComponents(new ButtonBuilder()
                .setCustomId(`ttt_c${idx}`)
                .setLabel(label)
                .setStyle(style)
                .setDisabled(!active || !!board[idx]));
        }
        rows.push({ row });
    }
    return rows;
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
        const t = (key, vars) => i18n.t(`tictactoe.${key}`, lang, vars);

        const challenger = message.author;
        const opponent   = message.mentions.users.first();

        // A player's row: RAM cache first, database as fallback
        const read = (id) => (client.getUserData
            ? client.getUserData(id, guildId)
            : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(id, guildId)) || {};

        // Change credits, XP and game counts for one player (only the fields that move)
        const apply = (user, { credits = 0, xp = 0, played = 0, won = 0 }) => {
            if (client.queueUserUpdate && client.getUserData) {
                const d = client.getUserData(user.id, guildId) || {};
                const patch = { ...d, username: user.username };
                if (credits) patch.credits      = (d.credits || 0) + credits;
                if (xp)      patch.xp           = (d.xp || 0) + xp;
                if (played)  patch.games_played = (d.games_played || 0) + played;
                if (won)     patch.games_won    = (d.games_won || 0) + won;
                client.queueUserUpdate(user.id, guildId, patch);
            } else {
                db.prepare(`UPDATE users SET credits = credits + ?, xp = xp + ?, games_played = games_played + ?, games_won = games_won + ?
                            WHERE id = ? AND guild_id = ?`).run(credits, xp, played, won, user.id, guildId);
            }
        };

        // Clickable link to the daily reward command, whichever name it uses here
        const dailyCmd = () => {
            const found = ['daily', 'claim'].find(n => client.application?.commands?.cache?.some(c => c.name === n));
            return mention(client, found || 'daily');
        };

        // ── Guards ──
        if (!opponent)                     return message.reply(t('invalid_target')).catch(() => {});
        if (opponent.id === challenger.id) return message.reply(t('cant_challenge_self')).catch(() => {});
        if (opponent.bot)                  return message.reply(t('cant_challenge_bot')).catch(() => {});
        if (busy.has(challenger.id))       return message.reply(t('you_are_playing')).catch(() => {});
        if (busy.has(opponent.id))         return message.reply(t('already_playing')).catch(() => {});
        if ((read(challenger.id).credits || 0) < FEE) {
            return message.reply(t('insufficient_credits', { daily: dailyCmd() })).catch(() => {});
        }
        if ((read(opponent.id).credits || 0) < FEE) {
            return message.reply(t('opponent_insufficient_credits', { name: opponent.username })).catch(() => {});
        }

        busy.add(challenger.id);
        busy.add(opponent.id);
        const release = () => { busy.delete(challenger.id); busy.delete(opponent.id); };

        // ── Challenge card ──
        const acceptEnds = unix(Date.now() + ACCEPT_MS);
        const challengeCard = () => v2.card(COLORS.play, [
            { text: `### ${EMOJIS.duel_sword} ${t('challenge_title')}\n`
                  + `${t('challenge_desc', { challenger: `<@${challenger.id}>`, opponent: `<@${opponent.id}>` })}\n`
                  + `-# ${t('entry_fee')} · ${t('ends', { time: `<t:${acceptEnds}:R>` })}` },
            { row: new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ttt_accept').setLabel(t('accept')).setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('ttt_decline').setLabel(t('decline')).setStyle(ButtonStyle.Secondary),
            ) },
        ]);
        const noticeCard = (body) => v2.card(COLORS.neutral, [
            { text: `### ${EMOJIS.duel_sword} ${t('challenge_title')}\n${body}` },
        ]);

        const msg = await message.reply(challengeCard()).catch(() => null);
        if (!msg) { release(); return; }

        let accepted = false;
        const invite = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: ACCEPT_MS });

        invite.on('collect', async (i) => {
            const isPlayer = i.user.id === challenger.id || i.user.id === opponent.id;
            if (i.customId === 'ttt_decline' && isPlayer) {
                invite.stop('declined');
                return i.update(noticeCard(t('declined', { name: `<@${i.user.id}>` }))).catch(() => {});
            }
            if (i.customId !== 'ttt_accept' || i.user.id !== opponent.id || accepted) {
                return i.reply({ content: t('not_for_you'), flags: 64 }).catch(() => {});
            }
            accepted = true;

            // Credits may have changed while the invite was open
            const cData = read(challenger.id);
            const oData = read(opponent.id);
            const broke = (cData.credits || 0) < FEE ? challenger : (oData.credits || 0) < FEE ? opponent : null;
            if (broke) {
                invite.stop('broke');
                return i.update(noticeCard(t('opponent_insufficient_credits', { name: broke.username }))).catch(() => {});
            }

            apply(challenger, { credits: -FEE });
            apply(opponent,   { credits: -FEE });
            invite.stop('accepted');
            startGame(i, cData, oData);
        });

        invite.on('end', (_, reason) => {
            if (reason === 'accepted') return;
            release();
            if (reason === 'time') msg.edit(noticeCard(t('expired'))).catch(() => {});
        });

        // ── The match ──
        function startGame(i, cData, oData) {
            const board  = Array(9).fill(null);
            let turn     = challenger.id;
            let active   = true;
            const cLevel = calculateLevel(cData.xp || 0);
            const oLevel = calculateLevel(oData.xp || 0);
            const cRank  = getRank(cLevel);
            const oRank  = getRank(oLevel);
            const gameEnds = unix(Date.now() + GAME_MS);
            const markOf = (id) => (id === challenger.id ? EMOJIS.small_cross : EMOJIS.small_check);

            const header  = `### ${EMOJIS.duel_sword} ${t('arena')}\n-# ${t('entry_fee')}`;
            const players = `${EMOJIS.small_cross} <@${challenger.id}> · ${cRank.emoji} ${t(cRank.key)} · Lv.${cLevel}\n`
                          + `${EMOJIS.small_check} <@${opponent.id}> · ${oRank.emoji} ${t(oRank.key)} · Lv.${oLevel}`;

            const playCard = () => v2.card(COLORS.play, [
                { text: header },
                { rule: true },
                { text: players },
                { rule: true },
                { text: `**${t('turn_label', { mark: markOf(turn), name: `<@${turn}>` })}**\n-# ${t('ends', { time: `<t:${gameEnds}:R>` })}` },
                ...boardRows(board, true),
            ]);

            i.update(playCard()).catch(() => {});
            const game = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: GAME_MS });

            game.on('collect', async (b) => {
                if (!active) return b.deferUpdate().catch(() => {});
                if (b.user.id !== challenger.id && b.user.id !== opponent.id) {
                    return b.reply({ content: t('not_for_you'), flags: 64 }).catch(() => {});
                }
                if (b.user.id !== turn) return b.reply({ content: t('not_your_turn'), flags: 64 }).catch(() => {});

                const idx = Number(b.customId.replace('ttt_c', ''));
                if (!Number.isInteger(idx) || idx < 0 || idx > 8) return b.deferUpdate().catch(() => {});
                if (board[idx]) return b.reply({ content: t('cell_taken'), flags: 64 }).catch(() => {});

                // Apply the move before any await, so a fast double tap can't play twice
                board[idx] = turn === challenger.id ? 'X' : 'O';
                const result = checkWinner(board);

                if (!result) {
                    turn = turn === challenger.id ? opponent.id : challenger.id;
                    return b.update(playCard()).catch(() => {});
                }

                active = false;
                game.stop('done');

                // ── Draw ──
                if (result.mark === 'tie') {
                    apply(challenger, { credits: FEE });
                    apply(opponent,   { credits: FEE });
                    return b.update(v2.card(COLORS.draw, [
                        { text: `### 🤝 ${t('draw_title')}\n<@${challenger.id}> · <@${opponent.id}>\n${t('draw_desc')}\n-# ${t('credits_returned')}` },
                        { rule: true },
                        ...boardRows(board, false),
                    ])).catch(() => {});
                }

                // ── Win ──
                const winner   = result.mark === 'X' ? challenger : opponent;
                const loser    = result.mark === 'X' ? opponent   : challenger;
                const before   = read(winner.id);
                const oldLevel = calculateLevel(before.xp || 0);
                const level    = calculateLevel((before.xp || 0) + WIN_XP);
                const rank     = getRank(level);
                const rate     = (((before.games_won || 0) + 1) / ((before.games_played || 0) + 1) * 100).toFixed(1);

                apply(winner, { credits: REWARD, xp: WIN_XP, played: 1, won: 1 });
                apply(loser,  { xp: LOSS_XP, played: 1 });
                giveDuelistRole(winner.id);

                const lines = [
                    `${t('prize')}: **+${REWARD} 🪙 · +${WIN_XP} XP**`,
                    `${t('consolation', { loser: `<@${loser.id}>` })}: **+${LOSS_XP} XP**`,
                    `${t('win_rate')}: **${rate}%** · ${rank.emoji} ${t(rank.key)} · Lv.${level}`,
                ];
                if (level > oldLevel) {
                    lines.push(`-# ${t('levelup_desc', { username: winner.username, level, emoji: rank.emoji, rank: t(rank.key) })}`);
                }

                return b.update(v2.card(COLORS.win, [
                    { text: `### ${EMOJIS.trophy} ${t('win_title', { winner: `<@${winner.id}>` })}\n-# ${t('arena')}` },
                    { rule: true },
                    { text: lines.join('\n') },
                    { rule: true },
                    ...boardRows(board, false, result.line),
                ])).catch(() => {});
            });

            game.on('end', (_, reason) => {
                release();
                if (reason !== 'time' || !active) return;
                active = false;
                apply(challenger, { credits: FEE });
                apply(opponent,   { credits: FEE });
                msg.edit(v2.card(COLORS.loss, [
                    { text: `### ${EMOJIS.duel_wait} ${t('timeout_title')}\n${t('timeout')}` },
                    { rule: true },
                    ...boardRows(board, false),
                ])).catch(() => {});
            });
        }

        async function giveDuelistRole(winnerId) {
            if (!message.guild) return;
            try {
                const settings = client.getServerSettings ? client.getServerSettings(message.guild.id) : null;
                const roleId = settings?.duelistRoleId || (message.guild.id === process.env.GUILD_ID ? process.env.DUELIST_ROLE_ID : null);
                if (!roleId) return;
                const member = await message.guild.members.fetch(winnerId).catch(() => null);
                const role   = message.guild.roles.cache.get(roleId);
                if (member && role && !member.roles.cache.has(roleId)) {
                    await member.roles.add(role, 'Tic-tac-toe winner').catch(() => {});
                }
            } catch (_) {}
        }

        console.log(`[TTT] ${challenger.tag} challenged ${opponent.tag} | lang: ${lang}`);
    },
};
