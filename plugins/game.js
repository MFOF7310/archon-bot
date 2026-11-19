const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
const { iconObj } = require('../lib/ui/icons');
const { icon } = require('../lib/ui/icons');
const { resolveEmoji } = require('../lib/emoji-resolver');
const { t } = require('../lib/i18n');
const EMOJIS = require('../config/emojis');
const v2 = require('../lib/games/v2');
const ui = require('../lib/games/ui');


// ================= RANKS =================
const RANKS = [
    { name: 'Unranked', min: 0, max: 0 }, { name: 'Bronze I', min: 1, max: 200 }, { name: 'Bronze II', min: 201, max: 400 },
    { name: 'Bronze III', min: 401, max: 600 }, { name: 'Silver I', min: 601, max: 900 }, { name: 'Silver II', min: 901, max: 1200 },
    { name: 'Silver III', min: 1201, max: 1500 }, { name: 'Gold I', min: 1501, max: 1900 }, { name: 'Gold II', min: 1901, max: 2300 },
    { name: 'Gold III', min: 2301, max: 2700 }, { name: 'Platinum I', min: 2701, max: 3200 }, { name: 'Platinum II', min: 3201, max: 3700 },
    { name: 'Platinum III', min: 3701, max: 4200 }, { name: 'Diamond I', min: 4201, max: 4800 }, { name: 'Diamond II', min: 4801, max: 5400 },
    { name: 'Diamond III', min: 5401, max: 6000 }, { name: 'Master I', min: 6001, max: 6800 }, { name: 'Master II', min: 6801, max: 7600 },
    { name: 'Master III', min: 7601, max: 8400 }, { name: 'Grandmaster', min: 8401, max: 9400 },
    { name: 'Legendary', min: 9401, max: 11000 }, { name: 'Mythic', min: 11001, max: 13000 },
    { name: 'Mythic II', min: 13001, max: 15000 }, { name: 'Mythic III', min: 15001, max: 20000 },
    { name: 'Titan', min: 20001, max: 30000 }, { name: 'Bamako Legend', min: 30001, max: 50000 },
    { name: 'Supreme Architect', min: 50001, max: Infinity }
];

function getRank(points) { return RANKS.find(r => points >= r.min && points <= r.max) || RANKS[RANKS.length - 1]; }
function nextRankPoints(currentPoints) { const idx = RANKS.findIndex(r => currentPoints >= r.min && currentPoints <= r.max); return idx < RANKS.length - 1 ? RANKS[idx + 1].min : 'MAX'; }
function calculateLevel(xp) { return Math.floor(0.1 * Math.sqrt(xp)) + 1; }

// ================= CONTEXT WRAPPER =================
class GameContext {
    constructor(source) {
        // Detect ALL interaction types: slash, button, select menu, modal
        this.isInteraction = !!source.isChatInputCommand || !!source.isMessageComponent || !!source.isButton || !!source.isUserContextMenuCommand || !!source.isMessageContextMenuCommand;
        this.source = source;
        this.user = this.isInteraction ? source.user : source.author;
        this.member = source.member;
        this.guild = source.guild;
        this.channel = source.channel;
        this.client = source.client;
    }
    async reply(options) {
        if (this.isInteraction) {
            if (this.source.deferred) return this.source.editReply(options);
            if (this.source.replied) return this.source.followUp(options);
            return this.source.reply({ ...options });
        }
        return this.source.reply(options);
    }
    async defer() {
        if (this.isInteraction && !this.source.deferred && !this.source.replied) return this.source.deferReply();
    }
    async update(options) {
        if (this.isInteraction) return this.source.update(options);
        return null;
    }
}

// ================= DB SETUP =================
function setupGameDB(database) {
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS game_scores (
            user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
            games_played INTEGER DEFAULT 0, games_won INTEGER DEFAULT 0, total_winnings INTEGER DEFAULT 0,
            codm_played INTEGER DEFAULT 0, slots_played INTEGER DEFAULT 0, ttt_played INTEGER DEFAULT 0,
            bj_played INTEGER DEFAULT 0, roulette_played INTEGER DEFAULT 0, trivia_played INTEGER DEFAULT 0,
            PRIMARY KEY (user_id, guild_id)
        )`).run();
        console.log('\x1b[32m[GAME]\x1b[0m Game scores table initialized');
    } catch (e) { console.error('\x1b[31m[GAME DB]\x1b[0m', e.message); }
}

// Money goes through client.changeUser (index.js): it starts from the newest balance (cache and waiting writes
// included), refuses to go below zero and updates memory and the database together. The old code wrote the whole
// row from a copy taken at the start of the game, so a daily or a vote paid during a blackjack hand could be put
// back, and two games started at once could both spend the same credits.
function deductBet(db, client, userId, guildId, bet, userData, username = 'Unknown') {
    if (client.changeUser) {
        const r = client.changeUser(userId, guildId, { add: { credits: -bet } }, username);
        return r.ok ? r.user.credits : null;
    }
    const res = db.prepare('UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ? AND credits >= ?').run(bet, userId, guildId, bet);
    client.userDataCache?.delete(`${userId}:${guildId}`);
    return res.changes ? Math.max(0, (userData?.credits || 0) - bet) : null;
}

function updateGameStats(db, client, userId, guildId, won, winnings, xpGain, ctx, lang, gameType) {
    const before = (client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)) || { level: 1 };
    const add = { games_played: 1, games_won: won ? 1 : 0, total_winnings: winnings > 0 ? winnings : 0, xp: xpGain, credits: Math.max(0, winnings) };
    let after;
    if (client.changeUser) {
        const r = client.changeUser(userId, guildId, { add, set: { level: (u) => calculateLevel(u.xp || 0) } }, ctx.user?.username || 'Unknown');
        if (!r.ok) { console.error(`[GAME] payout failed for ${userId}@${guildId}: ${r.error}`); return; }
        after = r.user;
    } else {
        db.prepare('UPDATE users SET games_played = games_played + 1, games_won = games_won + ?, total_winnings = total_winnings + ?, xp = xp + ?, credits = credits + ? WHERE id = ? AND guild_id = ?')
            .run(add.games_won, add.total_winnings, add.xp, add.credits, userId, guildId);
        client.userDataCache?.delete(`${userId}:${guildId}`);
        after = { ...before, xp: (before.xp || 0) + xpGain, games_played: (before.games_played || 0) + 1, games_won: (before.games_won || 0) + add.games_won };
    }
    const newLevel = calculateLevel(after.xp || 0);
    const gamesPlayed = after.games_played || 0, gamesWon = after.games_won || 0;
    const userData = before;
    if (newLevel > (userData.level || 1) && ctx.channel) {
        // v8: level-up on CV2, every emoji from the registry, no hardcoded ids
        const GAME_EMOJI = {
            slots:     EMOJIS.gameSlots,
            tictactoe: EMOJIS.gameTicTacToe,
            blackjack: EMOJIS.gameBlackjack,
            roulette:  EMOJIS.gameRoulette,
            trivia:    EMOJIS.gameTrivia,
            codm:      EMOJIS.gameCodm,
        };
        const gameEm = GAME_EMOJI[gameType] || EMOJIS.gamer || EMOJIS.gameController || '';
        const lines = [
            `${gameEm} ${t('game.gameText', lang)}: **${gameType.toUpperCase()}**`,
            `${EMOJIS.star} ${t('game.xpGained', lang)}: **+${xpGain}**`,
            `${EMOJIS.gameController} ${t('game.gamesPlayed', lang)}: **${gamesPlayed}**`,
            `${EMOJIS.crown} ${t('game.gamesWon', lang)}: **${gamesWon}**`,
        ].join('\n');
        const card = v2.card(0x00fbff, [
            { text: `<@${userId}>` },
            { text: `## ${EMOJIS.level} ${t('game.levelUp', lang)}` },
            { text: `### ${t('game.reachedLevel', lang)} **${newLevel}**!` },
            { rule: true },
            { text: lines },
            { rule: true },
            { text: `-# ${t('game.footer', lang)} • v${ctx.client.version || '2.0.0'}` },
        ]);
        card.allowedMentions = { parse: [], users: [userId] };
        ctx.channel.send(card).catch(() => {});
    }
}

// The "not enough credits" card (private), with the real balance
function noFunds(lang, client, userId, guildId) {
    const bal = client.liveCredits ? client.liveCredits(userId, guildId) : 0;
    const c = v2.card(0xE24B4A, [{ text: `${t('game.insufficientCredits', lang)} **${Number(bal).toLocaleString()}** ${EMOJIS.coins || '🪙'}` }]);
    c.flags = 64 | 32768;
    return c;
}

// ================= TRIVIA BRIDGE =================
async function bridgeToTrivia(interaction, client) {
    try {
                delete require.cache[require.resolve('./trivia.js')];
        const trivia = require('./trivia.js');
        return await trivia.execute(interaction, client);
    } catch (e) {
        console.error('[TRIVIA BRIDGE]', e.message);
        const serverLang = client.getServerSettings?.(interaction.guild?.id)?.language;
        const lang = serverLang === 'fr' ? 'fr' : serverLang === 'en' ? 'en' : (require('../lib/i18n').slashLang(interaction));
        const c = v2.card(0x9b59b6, [{ text: `⚡ ${t('game.triviaBridge', lang)}` }]);
        c.flags = 64 | 32768;
        return interaction.reply(c);
    }
}

// ================= CODM =================
async function playCODM(ctx, client, db, lang, guildId, userId, bet) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        return ctx.reply(noFunds(lang, client, userId, guildId));
    }
    if (deductBet(db, client, userId, guildId, bet, userData, ctx.user.username) === null) return ctx.reply(noFunds(lang, client, userId, guildId));

    // Half the matches are won; a win returns 1.85× to 2× the bet with the score (about 96 % back on average: the
    // old odds gave the player +2 % per game, so playing in a loop printed credits)
    const won = Math.random() < 0.5;
    const kills = won ? Math.floor(Math.random() * 15) + 10 : Math.floor(Math.random() * 8) + 2;
    const deaths = won ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 10) + 5;
    const kd = (kills / Math.max(deaths, 1)).toFixed(2);
    const score = won ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 40) + 20;
    const winnings = won ? Math.floor(bet * (1.5 + score / 200)) : 0;
    const isMVP = won && score > 90;
    const balance = client.liveCredits ? client.liveCredits(userId, guildId) + winnings : null;

    const card = v2.card(won ? 0x2ecc71 : 0xe74c3c, [
        { text: `-# ${EMOJIS.gameCodm || '🔫'} CODM · ${t('game.codmRanked', lang)}\n## ${won ? t('game.codmVictory', lang) : t('game.codmDefeat', lang)}${isMVP ? `\n${t('game.codmMVP', lang)}` : ''}` },
        { rule: true },
        { text: `**${t('game.codmScore', lang)}** ${score}  ·  **${t('game.codmKills', lang)}** ${kills}  ·  **${t('game.codmDeaths', lang)}** ${deaths}  ·  **${t('game.codmKDRatio', lang)}** ${kd}` },
        { text: `${EMOJIS.coins || '🪙'} ${won ? t('game.winnings', lang) : t('game.loss', lang)}: **${won ? '+' + winnings.toLocaleString() : '-' + bet.toLocaleString()}**${balance != null ? `  ·  ${t('game.newBalance', lang)}: **${balance.toLocaleString()}**` : ''}` },
    ]);
    await ctx.reply(card);
    updateGameStats(db, client, userId, guildId, won, winnings, won ? 50 : 20, ctx, lang, 'codm');
}

// ================= SLOTS =================
async function playSlots(ctx, client, db, lang, guildId, userId, bet) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const card = v2.card(0xff4757, [{ text: `${t('game.insufficientCredits', lang)} **${userData.credits.toLocaleString()} 🪙**` }]);
        card.flags = 64 | 32768;
        return ctx.reply(card);
    }
    if (deductBet(db, client, userId, guildId, bet, userData, ctx.user.username) === null) return ctx.reply(noFunds(lang, client, userId, guildId));

    const symbols = ['🍎', '🍊', '🍋', '🍇', '💎', '7️⃣', '🎰'];
    const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
    const line = [spin(), spin(), spin()];
    const allSame = line[0] === line[1] && line[1] === line[2];
    const twoMatch = line[0] === line[1] || line[1] === line[2] || line[0] === line[2];
    const isJackpot = allSame && line[0] === '💎';
    const won = allSame || twoMatch;
    const winnings = isJackpot ? bet * 10 : allSame ? bet * 5 : twoMatch ? bet * 2 : 0;

    // v8: slots on CV2
    const reel = `# ${line.join('  │  ')}`;
    const headline = isJackpot ? `## 🎰 ${t('game.jackpot', lang)}` : won ? `## ✨ ${t('game.slotsWin', lang)}` : `## 💨 ${t('game.slotsLoss', lang)}`;
    const delta = won ? `+${winnings.toLocaleString()}` : `-${bet.toLocaleString()}`;
    const balance = (userData.credits - bet + winnings).toLocaleString();
    const footer = `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'ARCHON CG-223'} • v${ctx.client.version || '2.0.0'}`;
    const color = isJackpot ? 0xf1c40f : won ? 0x2ecc71 : 0xe74c3c;
    const card = v2.card(color, [
        { text: headline },
        { text: reel },
        { rule: true },
        { text: `💰 ${won ? t('game.winnings', lang) : t('game.loss', lang)}: **${delta}** 🪙   ·   ${t('game.newBalance', lang)}: **${balance}** 🪙` },
        { rule: true },
        { text: footer },
    ]);
    await ctx.reply(card);
    updateGameStats(db, client, userId, guildId, won, winnings, 25, ctx, lang, 'slots');
}

// ================= TIC TAC TOE =================
async function playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent) {
    // v9.2: tictactoe on CV2
    const tttFooter = () => `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'ARCHON CG-223'} • v${ctx.client.version || '2.0.0'}`;
    const errCard = (msg) => {
        const c = v2.card(0xff4757, [{ text: msg }]);
        c.flags = 64 | 32768;
        return c;
    };

    if (!opponent) return ctx.reply(errCard(t('game.usage', lang, { prefix: ctx.client.PREFIX || '.' })));
    if (opponent.id === userId) return ctx.reply(errCard(t('game.noSelfChallenge', lang)));
    if (opponent.bot) return ctx.reply(errCard(t('game.cannotChallengeBot', lang)));

    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) return ctx.reply(errCard(`${t('game.insufficientCredits', lang)} **${userData.credits.toLocaleString()} ${EMOJIS.coins}**`));
    // Both players stake the same amount, taken only when the challenge is accepted. The old code took the
    // challenger's bet at once and never gave it back on a decline, a timeout or a draw; and an opponent who won
    // received twice a bet they never paid.

    const challengeCard = v2.card(0x9b59b6, [
        { text: `<@${opponent.id}>` },
        { text: `## ${EMOJIS.gameTicTacToe} ${t('game.newTicTacToe', lang)}` },
        { text: t('game.challenge', lang, { user: ctx.user.username }) },
        { rule: true },
        { text: tttFooter() },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ttt_accept').setLabel(t('game.accept', lang)).setStyle(ButtonStyle.Success).setEmoji(icon('ok')),
            new ButtonBuilder().setCustomId('ttt_decline').setLabel(t('game.decline', lang)).setStyle(ButtonStyle.Danger).setEmoji(icon('no')),
        ) },
    ]);
    challengeCard.allowedMentions = { users: [opponent.id] };

    const _resp = await ctx.reply(challengeCard);
    const sent = (typeof _resp?.fetch === 'function' ? await _resp.fetch().catch(() => null) : _resp);
    if (!sent?.channel?.awaitMessageComponent) {
        console.error('[TTT] reply is not a fetchable Message:', _resp && Object.keys(_resp));
        return;
    }

    let gameStarted = false;
    try {
        const response = await sent.channel.awaitMessageComponent({
            filter: (i) => i.message.id === sent.id && i.user.id === opponent.id && ['ttt_accept', 'ttt_decline'].includes(i.customId),
            time: 30000,
        });
        await response.deferUpdate().catch(() => {});

        if (response.customId === 'ttt_decline') {
            return sent.edit(v2.card(0x95a5a6, [
                { text: `## ${resolveEmoji('error', ctx)} ${t('game.challengeDeclined', lang)}` },
                { rule: true },
                { text: tttFooter() },
            ])).catch(() => {});
        }

        // the stakes: the opponent first (the challenger's balance was checked a moment ago), then the challenger
        const oppPaid = deductBet(db, client, opponent.id, guildId, bet, null, opponent.username) !== null;
        const mePaid = oppPaid && deductBet(db, client, userId, guildId, bet, null, ctx.user.username) !== null;
        if (!mePaid) {
            if (oppPaid) client.changeUser?.(opponent.id, guildId, { add: { credits: bet } }, opponent.username);
            return sent.edit(v2.card(0x95a5a6, [
                { text: `## ${resolveEmoji('error', ctx)} ${t('game.insufficientCredits', lang)}` },
                { text: `-# ${oppPaid ? ctx.user.username : opponent.username}` },
            ])).catch(() => {});
        }
        gameStarted = true;
        let board = [' ', ' ', ' ', ' ', ' ', ' ', ' ', ' ', ' '];
        let currentPlayer = userId;
        const players = { [userId]: { symbol: 'X', name: ctx.user.username }, [opponent.id]: { symbol: 'O', name: opponent.username } };

        const checkWin = (b) => {
            const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
            for (const [a,b1,c] of wins) if (b[a] !== ' ' && b[a] === b[b1] && b[b1] === b[c]) return b[a];
            if (!b.includes(' ')) return 'draw';
            return null;
        };

        const renderBoard = () => '```\n' +
            ` ${board[0]} \u2502 ${board[1]} \u2502 ${board[2]} \n\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u253c\u2500\u2500\u2500\n ${board[3]} \u2502 ${board[4]} \u2502 ${board[5]} \n\u2500\u2500\u2500\u253c\u2500\u2500\u2500\u253c\u2500\u2500\u2500\n ${board[6]} \u2502 ${board[7]} \u2502 ${board[8]} \n` +
            '```';

        const makeRows = (disabled = false) => {
            const rows = [];
            for (let r = 0; r < 3; r++) {
                const row = new ActionRowBuilder();
                for (let c = 0; c < 3; c++) {
                    const idx = r * 3 + c;
                    const val = board[idx];
                    row.addComponents(new ButtonBuilder()
                        .setCustomId('ttt_' + idx)
                        .setLabel(val === ' ' ? '\u200b' : val)
                        .setStyle(val === ' ' ? ButtonStyle.Secondary : (val === 'X' ? ButtonStyle.Primary : ButtonStyle.Danger))
                        .setDisabled(disabled || val !== ' '));
                }
                rows.push(row);
            }
            return rows;
        };

        const turnCard = () => {
            const you = currentPlayer === userId;
            const p = players[currentPlayer];
            const turnLine = you
                ? `**${t('game.yourTurn', lang)}** \u2014 ${p.name} (${p.symbol})`
                : `**${t('game.opponentTurn', lang)}** \u2014 ${p.name} (${p.symbol})`;
            const items = [
                { text: `## ${EMOJIS.gameTicTacToe} ${t('game.newTicTacToe', lang)}` },
                { text: turnLine },
                { text: renderBoard() },
                { rule: true },
                { text: tttFooter() },
                ...makeRows().map(r => ({ row: r })),
            ];
            return v2.card(0x9b59b6, items);
        };

        await sent.edit(turnCard()).catch(() => {});

        while (true) {
            try {
                const move = await sent.channel.awaitMessageComponent({
                    filter: (i) => i.message.id === sent.id && i.user.id === currentPlayer && i.customId.startsWith('ttt_'),
                    time: 60000,
                });
                const idx = parseInt(move.customId.split('_')[1], 10);
                if (board[idx] !== ' ') {
                    await move.reply({ content: t('game.spotTaken', lang), flags: 64 }).catch(() => {});
                    continue;
                }

                board[idx] = players[currentPlayer].symbol;
                await move.deferUpdate().catch(() => {});

                const result = checkWin(board);
                if (result) {
                    const won = result !== 'draw';
                    const winnerName = won ? players[currentPlayer].name : null;
                    const winnings = won ? bet * 2 : 0;
                    const headline = won
                        ? `## ${EMOJIS.trophy} ${t('game.wonTicTacToe', lang, { winner: winnerName })}`
                        : `## ${EMOJIS.gameTicTacToe} ${t('game.draw', lang)}`;
                    const finalItems = [
                        { text: headline },
                        { text: renderBoard() },
                        { rule: true },
                    ];
                    if (won) finalItems.push({ text: `${EMOJIS.coins} ${t('game.winnings', lang)}: **+${winnings.toLocaleString()}**` });
                    finalItems.push({ rule: true }, { text: tttFooter() });
                    finalItems.push(...makeRows(true).map(r => ({ row: r })));
                    await sent.edit(v2.card(won ? 0x2ecc71 : 0xf1c40f, finalItems)).catch(() => {});

                    // winner: both stakes · draw: each gets their own back · loser: nothing
                    const iWon = won && currentPlayer === userId, theyWon = won && currentPlayer !== userId;
                    updateGameStats(db, client, userId, guildId, iWon, iWon ? winnings : won ? 0 : bet, iWon ? 75 : 25, ctx, lang, 'ttt');
                    updateGameStats(db, client, opponent.id, guildId, theyWon, theyWon ? winnings : won ? 0 : bet, theyWon ? 75 : 25, { ...ctx, user: opponent }, lang, 'ttt');
                    break;
                }

                currentPlayer = currentPlayer === userId ? opponent.id : userId;
                await sent.edit(turnCard()).catch(() => {});
            } catch (e) {
                client.changeUser?.(userId, guildId, { add: { credits: bet } }, ctx.user.username);
                client.changeUser?.(opponent.id, guildId, { add: { credits: bet } }, opponent.username);
                await sent.edit(v2.card(0x95a5a6, [
                    { text: `## ${resolveEmoji('error', ctx)} ${t('game.timeout', lang)}` },
                    { rule: true },
                    { text: tttFooter() },
                    ...makeRows(true).map(r => ({ row: r })),
                ])).catch(() => {});
                break;
            }
        }
    } catch (e) {
        if (!gameStarted) {
            await sent.edit(v2.card(0x95a5a6, [
                { text: `## ${resolveEmoji('error', ctx)} ${t('game.challengeDeclined', lang)}` },
                { rule: true },
                { text: tttFooter() },
            ])).catch(() => {});
        } else {
            console.error('[TTT] game-loop error:', e.message);
        }
    }
}

// ================= BLACKJACK =================
async function playBlackjack(ctx, client, db, lang, guildId, userId, bet) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const card = v2.card(0xff4757, [{ text: `${t('game.insufficientCredits', lang)} **${userData.credits.toLocaleString()} ${EMOJIS.coins}**` }]);
        card.flags = 64 | 32768;
        return ctx.reply(card);
    }
    if (deductBet(db, client, userId, guildId, bet, userData, ctx.user.username) === null) return ctx.reply(noFunds(lang, client, userId, guildId));

    const cards = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    const suits = ['♠', '♥', '♦', '♣'];
    const drawCard = () => ({ card: cards[Math.floor(Math.random() * cards.length)], suit: suits[Math.floor(Math.random() * suits.length)] });
    const handValue = (hand) => {
        let val = 0, aces = 0;
        for (const c of hand) { if (c.card === 'A') aces++; else val += Math.min(10, parseInt(c.card) || 10); }
        for (let i = 0; i < aces; i++) val += (val + 11 <= 21) ? 11 : 1;
        return val;
    };
    const formatHand = (hand) => hand.map(c => `${c.card}${c.suit}`).join(' ');
    const fmtCard = (c) => `\`${c.card}${c.suit}\``;
    const fmtHand = (h) => h.map(fmtCard).join(' ');
    const bjDesc = (reveal) =>
        `**${t('game.yourHand', lang)}** ${fmtHand(playerHand)}  ·  **${handValue(playerHand)}**\n` +
        `**${t('game.dealerHand', lang)}** ${reveal ? fmtHand(dealerHand) : fmtCard(dealerHand[0]) + ' `??`'}  ·  **${reveal ? handValue(dealerHand) : '?'}**`;

    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];

    // v9: blackjack on CV2
    const bjFooter = () => `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'ARCHON CG-223'} • v${ctx.client.version || '2.0.0'}`;
    const bjRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel(t('game.hit', lang)).setStyle(ButtonStyle.Primary).setEmoji(iconObj('gameBlackjack', null, '🃏')),
        new ButtonBuilder().setCustomId('bj_stand').setLabel(t('game.stand', lang)).setStyle(ButtonStyle.Secondary).setEmoji(iconObj('mc_stop', null, '⏹️'))
    );
    const bjCard = ({ reveal = false, withButtons = true } = {}) => v2.card(0x9b59b6, [
        { text: `## ${EMOJIS.gameBlackjack} ${t('game.blackjack', lang)}` },
        { text: bjDesc(reveal) },
        { rule: true },
        { text: bjFooter() },
        ...(withButtons ? [{ row: bjRow() }] : []),
    ]);

    // v9.1: ctx.reply returns InteractionResponse — fetch it to get a real Message
    const _resp = await ctx.reply(bjCard());
    const sent = (typeof _resp?.fetch === 'function' ? await _resp.fetch().catch(() => null) : _resp);
    if (!sent?.channel?.awaitMessageComponent) {
        console.error('[BJ] reply is not a fetchable Message:', _resp && Object.keys(_resp));
        return;
    }

    // Player turn
    let playerDone = false;
    while (!playerDone) {
        try {
            const move = await sent.channel.awaitMessageComponent({
                filter: (i) => i.message.id === sent.id && i.user.id === userId && ['bj_hit', 'bj_stand'].includes(i.customId),
                time: 60000
            });
            await move.deferUpdate().catch(() => {});

            if (move.customId === 'bj_hit') {
                playerHand.push(drawCard());
                if (handValue(playerHand) > 21) playerDone = true;
            } else playerDone = true;

            if (!playerDone || handValue(playerHand) <= 21) {
                await sent.edit(bjCard({ withButtons: !playerDone })).catch(() => {});
            }
        } catch (e) { playerDone = true; }
    }

    // Dealer turn
    while (handValue(dealerHand) < 17) dealerHand.push(drawCard());

    const pVal = handValue(playerHand);
    const dVal = handValue(dealerHand);
    const playerBust = pVal > 21;
    const dealerBust = dVal > 21;
    const blackjack = pVal === 21 && playerHand.length === 2;
    const dealerBJ = dVal === 21 && dealerHand.length === 2;
    const draw = (blackjack && dealerBJ) || (!blackjack && !dealerBJ && pVal === dVal && !playerBust);
    const won = !draw && !playerBust && (blackjack || (!dealerBJ && (dealerBust || pVal > dVal)));
    const winnings = blackjack ? Math.floor(bet * 2.5) : won ? bet * 2 : draw ? bet : 0;

    const outcome = blackjack ? t('game.blackjackWin', lang) : won ? t('game.youWon', lang) : draw ? t('game.draw', lang) : t('game.youLost', lang);
    const bustNote = playerBust ? `\n_${t('game.youBusted', lang)}_` : dealerBust ? `\n_${t('game.dealerBusted', lang)}_` : '';
    const deltaStr = draw ? '±0' : won ? `+${(winnings - bet).toLocaleString()}` : `-${bet.toLocaleString()}`;
    await sent.edit(v2.card(won ? 0x2ecc71 : draw ? 0xf1c40f : 0xe74c3c, [
        { text: `## ${EMOJIS.gameBlackjack} ${outcome}` },
        { text: bjDesc(true) + bustNote },
        { rule: true },
        { text: `${EMOJIS.coins} ${t('game.bet', lang)}: **${bet.toLocaleString()}**  ·  ${won ? t('game.winnings', lang) : t('game.loss', lang)}: **${deltaStr}**` },
        { rule: true },
        { text: bjFooter() },
    ])).catch(() => {});
    updateGameStats(db, client, userId, guildId, won, winnings, won ? 100 : 50, ctx, lang, 'blackjack');
}

// ================= ROULETTE =================
async function playRoulette(ctx, client, db, lang, guildId, userId, bet) {
    // The table lives in lib/games/roulette.js (Components V2). The older code below is no longer reached.
    return require('../lib/games/roulette').play({
        ctx, client, db, lang, guildId, userId, bet,
        getUser: () => (client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)),
        charge: (amount) => {
            const user = client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
            if (!user || (user.credits || 0) < amount) return false;
            return deductBet(db, client, userId, guildId, amount, user, ctx.user.username) !== null;
        },
        settle: (won, returned, xp) => updateGameStats(db, client, userId, guildId, won, returned, xp, ctx, lang, 'roulette'),
    });
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
    .setName('game').setDescription('🎮 Game center: CODM, slots, tic-tac-toe, blackjack, roulette and trivia')
    .addSubcommand(sub => sub.setName('menu').setDescription('🎮 Open the game center'))
    .addSubcommand(sub => sub.setName('codm').setDescription('🔫 Simulate a CODM ranked match').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('slots').setDescription('🎰 Spin the slots').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('tictactoe').setDescription('⭕ Challenge someone to Tic Tac Toe').addUserOption(o => o.setName('opponent').setDescription('Who to challenge').setRequired(true)).addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('blackjack').setDescription('🃏 Beat the dealer').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('roulette').setDescription('🎲 Bet on the wheel').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('trivia').setDescription('🧠 Play trivia'));

// ================= EXECUTE =================
async function executeSlashCommand(interaction, client) {
    const db = client.db;
    const ss = client.getServerSettings?.(interaction.guild?.id) || {};
    const lang = ss.language && ss.language !== 'auto' ? ss.language : (require('../lib/i18n').slashLang(interaction));
    if (!db) return interaction.reply({ content: t('game.db_unavailable', lang), flags: 64 });
    setupGameDB(db);

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guildId || 'DM';
    const userId = interaction.user.id;
    const ctx = new GameContext(interaction);

        if (sub === 'menu') {
        const hub = require('../lib/games/hub').buildHub({
            lang, guildName: interaction.guild?.name, user: interaction.user,
            stats: (client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId)) || null,
        });
        return interaction.reply(hub);
    }

    const bet = interaction.options.getInteger('bet') || 100;
    if (bet < 10) return interaction.reply({ content: t('game.invalidBet', lang) + '\n*' + t('game.minBet', lang) + '*', flags: 64 });
    if (bet > 10000) return interaction.reply({ content: t('game.invalidBet', lang) + '\n*' + t('game.maxBet', lang) + '*', flags: 64 });

    if (sub === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'tictactoe') {
        const opponent = interaction.options.getUser('opponent');
        return playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent);
    }
    if (sub === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    if (sub === 'trivia') return bridgeToTrivia(interaction, client);
}

// ================= PREFIX FALLBACK =================
async function run(client, message, args, db, serverSettings, usedCommand, lang) {
        // The language was used here without being defined, so this command always failed ("lang is not defined")
        if (!lang) lang = require('../lib/pick-lang').pickLang(client, message?.guild?.id, message, message?.author?.id);

    const guildId = message.guild?.id || 'DM';
    const userId = message.author.id;
    const prefix = serverSettings?.prefix || '.';
    const ctx = new GameContext(message);

    // Route direct aliases
    const cmd = usedCommand?.toLowerCase() || '';
    const directMap = { codm: 'codm', slots: 'slots', slot: 'slots', tictactoe: 'tictactoe', ttt: 'tictactoe', morpion: 'tictactoe', blackjack: 'blackjack', bj: 'blackjack', roulette: 'roulette' };
    const directGame = directMap[cmd];

    if (directGame) {
        const bet = parseInt(args[0]) || 100;
        if (bet < 10) return message.reply(`${t('game.invalidBet', lang)}\n*${t('game.minBet', lang)}*`).catch(() => {});
        if (bet > 10000) return message.reply(`${t('game.invalidBet', lang)}\n*${t('game.maxBet', lang)}*`).catch(() => {});
        if (directGame === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'tictactoe') {
            const opponent = message.mentions.users.first();
            return playTicTacToe(ctx, client, db, lang, guildId, userId, bet, opponent);
        }
        if (directGame === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
        if (directGame === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    }

    // Default: the game hub (the same card as /game menu)
    const stats = client.getUserData ? client.getUserData(userId, guildId) : db.prepare('SELECT * FROM users WHERE id = ? AND guild_id = ?').get(userId, guildId);
    return message.reply(require('../lib/games/hub').buildHub({ lang, guildName: message.guild?.name, user: message.author, stats: stats || null })).catch(() => {});
}

// ================= BUTTON HANDLER =================
async function handleComponent(interaction, client) {
    if (!interaction.customId.startsWith('game_')) return false;
    const db = client.db;
    const ss = client.getServerSettings?.(interaction.guild?.id) || {};
    const lang = ss.language && ss.language !== 'auto' ? ss.language : (require('../lib/i18n').slashLang(interaction));
    if (!db) return interaction.reply({ content: t('game.db_unavailable', lang), flags: 64 });

    const parts = interaction.customId.split('_');
    const action = parts[1];
    const game = parts[2];

    if (action !== 'play') return false;

    const guildId = interaction.guildId || 'DM';
    const userId = interaction.user.id;
    const bet = 100;

    // Trivia has its own reply flow — don't defer
    if (game === 'trivia') return bridgeToTrivia(interaction, client);

    // Tic-tac-toe needs an opponent — quick reply
    if (game === 'tictactoe') {
        const c = v2.card(0x9b59b6, [{ text: t('game.ttt_use_slash', lang) }]);
        c.flags = 64 | 32768;
        return interaction.reply(c);
    }

    // CRITICAL: Defer immediately so DB lookups + game logic don't expire the token
    await interaction.deferReply();

    const ctx = new GameContext(interaction);

    if (game === 'codm') return playCODM(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'slots') return playSlots(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'blackjack') return playBlackjack(ctx, client, db, lang, guildId, userId, bet);
    if (game === 'roulette') return playRoulette(ctx, client, db, lang, guildId, userId, bet);
    return false;
}

// ================= EXPORTS =================
module.exports = {
    name: 'game',
    aliases: ['jouer', 'slots', 'slot', 'ttt', 'blackjack', 'bj', 'roulette'],
    description: '🎮 Game center: CODM, slots, tic-tac-toe, blackjack, roulette and trivia',
    category: 'GAMING',
    usage: '/game <subcommand>',
    cooldown: 3000,
    data: slashCommand,
    execute: executeSlashCommand,
    run,
    handleComponent,
    setupGameDB
};
