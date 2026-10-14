const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, ComponentType } = require('discord.js');
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
    { name: 'Neural God', min: 20001, max: 30000 }, { name: 'Bamako Legend', min: 30001, max: 50000 },
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

function deductBet(db, client, userId, guildId, bet, userData) {
    const newBal = Math.max(0, (userData.credits || 0) - bet);
    db.prepare("UPDATE users SET credits = ? WHERE id = ? AND guild_id = ?").run(newBal, userId, guildId);
    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, credits: newBal });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);
    return newBal;
}

function updateGameStats(db, client, userId, guildId, won, winnings, xpGain, ctx, lang, gameType) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) {
        db.prepare("INSERT INTO users (id, guild_id, username, xp, level, credits, streak_days, last_daily, total_dailies, highest_streak, games_played, games_won, total_winnings) VALUES (?, ?, ?, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0)").run(userId, guildId, ctx.user.username);
        userData = { games_played: 0, games_won: 0, total_winnings: 0, xp: 0, level: 1, credits: 0 };
    }
    const gamesPlayed = (userData.games_played || 0) + 1;
    const gamesWon = (userData.games_won || 0) + (won ? 1 : 0);
    const totalWinnings = (userData.total_winnings || 0) + (winnings > 0 ? winnings : 0);
    const newXP = (userData.xp || 0) + xpGain;
    const newLevel = calculateLevel(newXP);
    const newCredits = (userData.credits || 0) + winnings;

    db.prepare("UPDATE users SET games_played = ?, games_won = ?, total_winnings = ?, xp = ?, credits = ? WHERE id = ? AND guild_id = ?")
        .run(gamesPlayed, gamesWon, totalWinnings, newXP, newCredits, userId, guildId);

    if (client.queueUserUpdate) client.queueUserUpdate(userId, guildId, { ...userData, games_played: gamesPlayed, games_won: gamesWon, total_winnings: totalWinnings, xp: newXP, credits: newCredits });
    if (client.userDataCache) client.userDataCache.delete(`${userId}:${guildId}`);

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

// ================= HUB BUILDER =================
function buildHub(client, lang, guildName) {
    const dw = s => [...s].reduce((n, c) => {
        const cp = c.codePointAt(0);
        if (cp === 0xFE0F) return n;
        return n + ((cp > 0xFFFF || (cp >= 0x2600 && cp <= 0x27BF) || (cp >= 0x2B00 && cp <= 0x2BFF)) ? 2 : 1);
    }, 0);
    const W = 40;
    const border = (l, r) => `\u001b[1;36m${l}${'═'.repeat(W)}${r}\u001b[0m\n`;
    const headText = `  ◈ ${guildName || 'NEURAL NODE'}`;
    const head = `\u001b[1;36m║\u001b[0m  ◈ \u001b[1;33m${guildName || 'NEURAL NODE'}\u001b[0m${' '.repeat(Math.max(1, W - dw(headText)))}\u001b[1;36m║\u001b[0m\n`;
    const gameLine = (emoji, name) => {
        const left = emoji ? `  ▸ ${emoji} ${name}` : `  ▸ ${name}`;
        const gap = ' '.repeat(Math.max(1, W - dw(left) - 9));
        const shown = emoji
            ? `  \u001b[1;36m▸\u001b[0m ${emoji} \u001b[1;37m${name}\u001b[0m`
            : `  \u001b[1;36m▸\u001b[0m \u001b[1;37m${name}\u001b[0m`;
        return `\u001b[1;36m║\u001b[0m${shown}${gap}\u001b[1;32mAVAILABLE\u001b[0m\u001b[1;36m║\u001b[0m\n`;
    };
    const embed = new EmbedBuilder().setColor('#00d4ff')
        .setAuthor({ name: t('game.hubTitle', lang), iconURL: client.user.displayAvatarURL() })
        .setDescription(
            '```ansi\n' +
            border('╔', '╗') +
            head +
            border('╠', '╣') +
            gameLine('🔫', t('game.codm', lang)) +
            gameLine(null, t('game.slots', lang)) +
            gameLine(null, t('game.tictactoe', lang)) +
            gameLine(null, t('game.blackjack', lang)) +
            gameLine(null, t('game.roulette', lang)) +
            gameLine(null, t('game.trivia', lang)) +
            border('╚', '╝') +
            '```\n' +
            `> ${t('game.hubDesc', lang)}`
        )
        .setFooter({ text: `${t('game.footer', lang)} • ${guildName || 'NEURAL NODE'} • v${client.version || '2.0.0'}`, iconURL: client.user.displayAvatarURL() })
        .setTimestamp();

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_play_codm').setLabel('CODM').setStyle(ButtonStyle.Primary).setEmoji('🔫'),
        new ButtonBuilder().setCustomId('game_play_slots').setLabel('SLOTS').setStyle(ButtonStyle.Primary).setEmoji('🎰'),
        new ButtonBuilder().setCustomId('game_play_tictactoe').setLabel('TIC TAC TOE').setStyle(ButtonStyle.Primary).setEmoji('⭕')
    );
    const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('game_play_blackjack').setLabel('BLACKJACK').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
        new ButtonBuilder().setCustomId('game_play_roulette').setLabel('ROULETTE').setStyle(ButtonStyle.Primary).setEmoji('🎲'),
        new ButtonBuilder().setCustomId('game_play_trivia').setLabel('TRIVIA').setStyle(ButtonStyle.Secondary).setEmoji('🧠')
    );

    return { embeds: [embed], components: [row1, row2] };
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
        const embed = new EmbedBuilder().setColor('#9b59b6')
            .setAuthor({ name: t('game.trivia_bridge_author', lang), iconURL: client.user.displayAvatarURL() })
            .setDescription(`⚡ ${t('game.triviaBridge', lang)}`)
            .setFooter({ text: t('game.footer_center', lang) });
        return interaction.reply({ embeds: [embed], flags: 64 });
    }
}

// ================= CODM =================
async function playCODM(ctx, client, db, lang, guildId, userId, bet) {
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t('game.insufficientCredits', lang)} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const won = Math.random() > 0.45;
    const kills = won ? Math.floor(Math.random() * 15) + 10 : Math.floor(Math.random() * 8) + 2;
    const deaths = won ? Math.floor(Math.random() * 5) + 1 : Math.floor(Math.random() * 10) + 5;
    const kd = (kills / Math.max(deaths, 1)).toFixed(2);
    const score = won ? Math.floor(Math.random() * 30) + 70 : Math.floor(Math.random() * 40) + 20;
    const winnings = won ? Math.floor(bet * (1 + (score / 100))) : 0;
    const isMVP = won && score > 85;

    const rankPoints = won ? Math.floor(score * 0.5) + 10 : Math.floor(score * 0.2);
    const currentRP = (userData.total_winnings || 0) + rankPoints;
    const rank = getRank(currentRP);
    const nextPoints = nextRankPoints(currentRP);

    const embed = new EmbedBuilder().setColor(won ? '#2ecc71' : '#e74c3c')
        .setAuthor({ name: `${won ? t('game.codmVictory', lang) : t('game.codmDefeat', lang)}`, iconURL: ctx.user.displayAvatarURL() })
        .setDescription(
            '```ansi\n' +
            `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.codmScore', lang).padEnd(12)}\u001b[0m \u001b[1;33m${score}\u001b[0m\n` +
            `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.codmKills', lang).padEnd(12)}\u001b[0m \u001b[1;32m${kills}\u001b[0m\n` +
            `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.codmDeaths', lang).padEnd(12)}\u001b[0m \u001b[1;31m${deaths}\u001b[0m\n` +
            `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.codmKDRatio', lang).padEnd(12)}\u001b[0m \u001b[1;36m${kd}\u001b[0m\n` +
            '```' + (isMVP ? `\n${t('game.codmMVP', lang)}` : '')
        )
        .addFields(
            { name: `💰 ${won ? t('game.winnings', lang) : t('game.loss', lang)}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true },
            { name: `🏆 ${t('game.currentRank', lang)}`, value: `**${rank.name}**${nextPoints !== 'MAX' ? `\nNext: ${nextPoints.toLocaleString()} RP` : ''}`, inline: true }
        )
        .setFooter({ text: `${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();
    await ctx.reply({ embeds: [embed] });
    updateGameStats(db, client, userId, guildId, won, winnings, 50, ctx, lang, 'codm');
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
    deductBet(db, client, userId, guildId, bet, userData);

    const symbols = ['🍎', '🍊', '🍋', '🍇', '💎', '7️⃣', '🎰'];
    const spin = () => symbols[Math.floor(Math.random() * symbols.length)];
    const line = [spin(), spin(), spin()];
    const allSame = line[0] === line[1] && line[1] === line[2];
    const twoMatch = line[0] === line[1] || line[1] === line[2] || line[0] === line[2];
    const isJackpot = allSame && line[0] === '💎';
    const won = allSame || twoMatch;
    const winnings = isJackpot ? bet * 10 : allSame ? bet * 5 : twoMatch ? bet * 2 : 0;

    // v8: slots on CV2
    const reel = '```ansi\n' +
        `\u001b[1;36m╔${'═'.repeat(16)}╗\u001b[0m\n` +
        `\u001b[1;36m║\u001b[0m  ${line.map(s => `\u001b[1;33m${s}\u001b[0m`).join(' \u001b[1;36m│\u001b[0m ')}  \u001b[1;36m║\u001b[0m\n` +
        `\u001b[1;36m╚${'═'.repeat(16)}╝\u001b[0m\n` +
        '```';
    const headline = isJackpot ? `## 🎰 ${t('game.jackpot', lang)}` : won ? `## ✨ ${t('game.slotsWin', lang)}` : `## 💨 ${t('game.slotsLoss', lang)}`;
    const delta = won ? `+${winnings.toLocaleString()}` : `-${bet.toLocaleString()}`;
    const balance = (userData.credits - bet + winnings).toLocaleString();
    const footer = `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`;
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
    const tttFooter = () => `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`;
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
    deductBet(db, client, userId, guildId, bet, userData);

    const challengeCard = v2.card(0x9b59b6, [
        { text: `<@${opponent.id}>` },
        { text: `## ${EMOJIS.gameTicTacToe} ${t('game.newTicTacToe', lang)}` },
        { text: t('game.challenge', lang, { user: ctx.user.username }) },
        { rule: true },
        { text: tttFooter() },
        { row: new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('ttt_accept').setLabel(t('game.accept', lang)).setStyle(ButtonStyle.Success).setEmoji(ui.parseEmoji(EMOJIS.check)),
            new ButtonBuilder().setCustomId('ttt_decline').setLabel(t('game.decline', lang)).setStyle(ButtonStyle.Danger).setEmoji(ui.parseEmoji(EMOJIS.error)),
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
                { text: `## ${EMOJIS.error} ${t('game.challengeDeclined', lang)}` },
                { rule: true },
                { text: tttFooter() },
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

                    updateGameStats(db, client, userId, guildId, won && currentPlayer === userId, won && currentPlayer === userId ? winnings : 0, won ? 75 : 25, ctx, lang, 'ttt');
                    if (won && currentPlayer !== userId) updateGameStats(db, client, opponent.id, guildId, true, winnings, 75, { ...ctx, user: opponent }, lang, 'ttt');
                    break;
                }

                currentPlayer = currentPlayer === userId ? opponent.id : userId;
                await sent.edit(turnCard()).catch(() => {});
            } catch (e) {
                await sent.edit(v2.card(0x95a5a6, [
                    { text: `## ${EMOJIS.error} ${t('game.timeout', lang)}` },
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
                { text: `## ${EMOJIS.error} ${t('game.challengeDeclined', lang)}` },
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
    deductBet(db, client, userId, guildId, bet, userData);

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
    const fmtCard = c => (c.suit === '♥' || c.suit === '♦') ? `\u001b[1;31m${c.card}${c.suit}\u001b[0m` : `\u001b[1;37m${c.card}${c.suit}\u001b[0m`;
    const fmtHand = h => h.map(fmtCard).join(' ');
    const labelW = Math.max(t('game.yourHand', lang).length, t('game.dealerHand', lang).length);
    const bjDesc = (reveal) =>
        '```ansi\n' +
        `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.yourHand', lang).padEnd(labelW)}\u001b[0m  ${fmtHand(playerHand)}  \u001b[1;33m(${handValue(playerHand)})\u001b[0m\n` +
        `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.dealerHand', lang).padEnd(labelW)}\u001b[0m  ${reveal ? fmtHand(dealerHand) : fmtCard(dealerHand[0]) + ' \u001b[1;30m??\u001b[0m'}  \u001b[1;33m(${reveal ? handValue(dealerHand) : '?'})\u001b[0m\n` +
        '```';

    let playerHand = [drawCard(), drawCard()];
    let dealerHand = [drawCard(), drawCard()];

    // v9: blackjack on CV2
    const bjFooter = () => `-# ${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`;
    const bjRow = () => new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('bj_hit').setLabel(t('game.hit', lang)).setStyle(ButtonStyle.Primary).setEmoji(ui.parseEmoji(EMOJIS.gameBlackjack)),
        new ButtonBuilder().setCustomId('bj_stand').setLabel(t('game.stand', lang)).setStyle(ButtonStyle.Secondary).setEmoji(ui.parseEmoji(EMOJIS.stop))
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
    const won = blackjack || (!playerBust && (dealerBust || pVal > dVal));
    const draw = pVal === dVal && !playerBust && !dealerBust;
    const winnings = blackjack ? Math.floor(bet * 2.5) : won ? bet * 2 : draw ? bet : 0;

    const outcome = blackjack ? t('game.blackjackWin', lang) : won ? t('game.youWon', lang) : draw ? t('game.draw', lang) : t('game.youLost', lang);
    const bustNote = playerBust ? `\n_${t('game.youBusted', lang)}_` : dealerBust ? `\n_${t('game.dealerBusted', lang)}_` : '';
    const deltaStr = `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()}`;
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
            deductBet(db, client, userId, guildId, amount, user);
            return true;
        },
        settle: (won, returned, xp) => updateGameStats(db, client, userId, guildId, won, returned, xp, ctx, lang, 'roulette'),
    });
    let userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare("SELECT * FROM users WHERE id = ? AND guild_id = ?").get(userId, guildId);
    if (!userData) userData = { credits: 0 };
    if (userData.credits < bet) {
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(`${t('game.insufficientCredits', lang)} **${userData.credits.toLocaleString()} 🪙**`);
        return ctx.reply({ embeds: [embed], flags: 64 });
    }
    deductBet(db, client, userId, guildId, bet, userData);

    const numbers = Array.from({ length: 37 }, (_, i) => i);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const isRed = (n) => redNumbers.includes(n);
    const isBlack = (n) => n !== 0 && !isRed(n);

    const embed = new EmbedBuilder().setColor('#e74c3c')
        .setAuthor({ name: t('game.roulette_author', lang), iconURL: ctx.user.displayAvatarURL() })
        .setDescription(`## 💰 ${t('game.bet', lang)}: ${bet.toLocaleString()} 🪙\n${t('game.chooseNumber', lang)} (0-36):`)
        .setFooter({ text: `${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

    const rows = [];
    for (let r = 0; r < 4; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < 10; c++) {
            const num = r * 10 + c;
            if (num > 36) break;
            const style = num === 0 ? ButtonStyle.Success : isRed(num) ? ButtonStyle.Danger : ButtonStyle.Secondary;
            row.addComponents(new ButtonBuilder().setCustomId(`rl_${num}`).setLabel(num.toString()).setStyle(style));
        }
        rows.push(row);
    }

    const sent = await ctx.reply({ embeds: [embed], components: rows });

    try {
        const response = await sent.channel.awaitMessageComponent({
            filter: (i) => i.message.id === sent.id && i.user.id === userId && i.customId.startsWith('rl_'),
            time: 30000
        });
        const chosenNum = parseInt(response.customId.split('_')[1]);
        await response.deferUpdate().catch(() => {});

        const result = numbers[Math.floor(Math.random() * numbers.length)];
        const resultRed = isRed(result);
        const resultColor = result === 0 ? t('game.rouletteGreen', lang) : resultRed ? t('game.rouletteRed', lang) : t('game.rouletteBlack', lang);
        const won = result === chosenNum;
        const winnings = won ? bet * 35 : 0;

        // spinning animation — cosmetic frames, result already decided above
        for (let i = 0; i < 3; i++) {
            const n = numbers[Math.floor(Math.random() * numbers.length)];
            const nc = n === 0 ? t('game.rouletteGreen', lang) : isRed(n) ? t('game.rouletteRed', lang) : t('game.rouletteBlack', lang);
            const spinEmbed = new EmbedBuilder().setColor('#95a5a6')
                .setAuthor({ name: t('game.spinning', lang), iconURL: ctx.user.displayAvatarURL() })
                .setDescription(`## 🎲 ${n} ${nc}`)
                .setFooter({ text: `${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() });
            await sent.edit({ embeds: [spinEmbed], components: [] }).catch(() => {});
            await new Promise(r => setTimeout(r, 700));
        }

        const accent = result === 0 ? '#2ecc71' : resultRed ? '#e74c3c' : '#2b2d31';
        const numColor = result === 0 ? '\u001b[1;32m' : resultRed ? '\u001b[1;31m' : '\u001b[1;37m';
        const pw = Math.max(t('game.your_pick', lang).length, t('game.result_label', lang).length);
        const resultEmbed = new EmbedBuilder().setColor(accent)
            .setAuthor({ name: `${won ? t('game.youWon', lang) : t('game.youLost', lang)}`, iconURL: ctx.user.displayAvatarURL() })
            .setDescription(
                `## ${t('game.rouletteResult', lang, { number: result, color: resultColor })}\n` +
                '```ansi\n' +
                `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.your_pick', lang).padEnd(pw)}\u001b[0m \u001b[1;33m${chosenNum}\u001b[0m\n` +
                `\u001b[1;36m▸\u001b[0m \u001b[1;37m${t('game.result_label', lang).padEnd(pw)}\u001b[0m ${numColor}${result}\u001b[0m\n` +
                '```'
            )
            .addFields(
                { name: `💰 ${t('game.bet', lang)}`, value: `${bet.toLocaleString()} 🪙`, inline: true },
                { name: `💰 ${won ? t('game.winnings', lang) : t('game.loss', lang)}`, value: `${won ? '+' : '-'}${Math.abs(won ? winnings : bet).toLocaleString()} 🪙`, inline: true }
            )
            .setFooter({ text: `${t('game.footer', lang)} • ${ctx.guild?.name?.toUpperCase() || 'NEURAL NODE'} • v${ctx.client.version || '2.0.0'}`, iconURL: ctx.guild?.iconURL() || ctx.client.user.displayAvatarURL() }).setTimestamp();

        await sent.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
        updateGameStats(db, client, userId, guildId, won, winnings, won ? 150 : 25, ctx, lang, 'roulette');

    } catch (e) { await sent.edit({ content: t('game.timeout', lang), embeds: [], components: [] }).catch(() => {}); }
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
    .setName('game').setDescription('🎮 Neural Game Center — Play CODM, Slots, TTT, Blackjack, Roulette, and Trivia')
    .addSubcommand(sub => sub.setName('menu').setDescription('🎮 Open the Neural Game Center hub'))
    .addSubcommand(sub => sub.setName('codm').setDescription('🔫 Simulate a CODM ranked match').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('slots').setDescription('🎰 Spin the neural slots').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('tictactoe').setDescription('⭕ Challenge someone to Tic Tac Toe').addUserOption(o => o.setName('opponent').setDescription('Who to challenge').setRequired(true)).addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('blackjack').setDescription('🃏 Beat the dealer').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('roulette').setDescription('🎲 Bet on the wheel').addIntegerOption(o => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(10000)))
    .addSubcommand(sub => sub.setName('trivia').setDescription('🧠 Bridge to Neural Trivia'));

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
async function run(client, message, args, db, serverSettings, usedCommand) {

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

    // Default: show hub redirect
    const embed = new EmbedBuilder().setColor('#00d4ff')
        .setAuthor({ name: t('game.hubTitle', lang), iconURL: client.user.displayAvatarURL() })
        .setDescription(`**${t('game.slash_redirect', lang)}**\n\`\`\`\n/game menu\n/game codm\n/game slots\n/game tictactoe @user\n/game blackjack\n/game roulette\n/game trivia\n\`\`\``)
        .setFooter({ text: t('game.footer_center', lang) });
    return message.reply({ embeds: [embed] }).catch(() => {});
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
        const embed = new EmbedBuilder().setColor('#ff4757').setDescription(t('game.ttt_use_slash', lang));
        return interaction.reply({ embeds: [embed], flags: 64 });
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
    aliases: ['jeu', 'jouer', 'codm', 'slots', 'slot', 'tictactoe', 'ttt', 'morpion', 'blackjack', 'bj', 'roulette'],
    description: '🎮 Neural Game Center — CODM, Slots, Tic Tac Toe, Blackjack, Roulette + Trivia Bridge',
    category: 'GAMING',
    usage: '/game <subcommand>',
    cooldown: 3000,
    data: slashCommand,
    execute: executeSlashCommand,
    run,
    handleComponent,
    setupGameDB
};
