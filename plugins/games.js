const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'game',
    aliases: ['play', 'minigame', 'arcade'],
    description: 'Launch neural arcade games. Test your reflexes, luck, and strategy.',
    category: 'GAMING',
    run: async (client, message, args, userData) => {
        const subCommand = args[0]?.toLowerCase();
        
        // Game selection menu
        if (!subCommand || subCommand === 'menu') {
            return showGameMenu(client, message, userData);
        }
        
        // Handle different games
        switch(subCommand) {
            case 'dice':
                return playDiceGame(client, message, userData, args[1]);
            case 'coinflip':
            case 'cf':
                return playCoinFlip(client, message, userData, args[1]);
            case 'guess':
            case 'number':
                return playNumberGuess(client, message, userData);
            case 'slots':
            case 'slot':
                return playSlots(client, message, userData);
            case 'blackjack':
            case 'bj':
                return playBlackjack(client, message, userData);
            case 'rps':
            case 'rockpaperscissors':
                return playRPS(client, message, userData, args[1]);
            case 'leaderboard':
            case 'lb':
                return showGameLeaderboard(client, message, args[1]);
            case 'stats':
                return showGameStats(client, message, userData);
            default:
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setAuthor({ name: 'GAME ERROR: COMMAND_NOT_FOUND', iconURL: client.user.displayAvatarURL() })
                    .setDescription(`Unknown game: \`${subCommand}\``)
                    .addFields({ name: '📜 AVAILABLE GAMES', value: '`dice` • `coinflip` • `guess` • `slots` • `blackjack` • `rps` • `leaderboard` • `stats`' })
                    .setFooter({ text: 'Use .game menu to see game details' });
                return message.reply({ embeds: [errorEmbed] });
        }
    }
};

// ================= GAME MENU =================
async function showGameMenu(client, message, userData) {
    const menuEmbed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: '🎮 NEURAL ARCADE • GAME SELECTION', iconURL: client.user.displayAvatarURL() })
        .setTitle('═ ARCHITECT GAMING SUITE ═')
        .setDescription('Select a game to test your neural reflexes and strategic capabilities.\n*All games track stats and contribute to your combat readiness.*')
        .addFields(
            { 
                name: '🎲 DICE ROULETTE', 
                value: '`🎲 .game dice [1-6]`\n*Predict the roll and multiply your winnings!*\n**Payout:** 5x • **Cooldown:** 30s', 
                inline: true 
            },
            { 
                name: '🪙 COIN FLIP', 
                value: '`🪙 .game coinflip [heads/tails]`\n*Classic 50/50 chance. Simple but thrilling.*\n**Payout:** 2x • **Cooldown:** 15s', 
                inline: true 
            },
            { 
                name: '🔢 NUMBER GUESS', 
                value: '`🔢 .game guess`\n*Guess a number between 1-100. Higher risk, higher reward!*\n**Payout:** Up to 100x • **Cooldown:** 45s', 
                inline: true 
            },
            { 
                name: '🎰 SLOT MACHINE', 
                value: '`🎰 .game slots`\n*Three reels of fortune. Match symbols for massive multipliers!*\n**Payout:** Up to 500x • **Cooldown:** 60s', 
                inline: true 
            },
            { 
                name: '🃏 BLACKJACK', 
                value: '`🃏 .game blackjack`\n*21 or bust! Strategic card game against the dealer.*\n**Payout:** 2x • **Cooldown:** 90s', 
                inline: true 
            },
            { 
                name: '✊ RPS DUEL', 
                value: '`✊ .game rps [rock/paper/scissors]`\n*Classic duel against the AI. Pure strategy.*\n**Payout:** 2x • **Cooldown:** 20s', 
                inline: true 
            }
        )
        .addFields(
            { 
                name: '📊 YOUR STATS', 
                value: `\`\`\`yaml\nGames Played: ${userData?.games_played || 0}\nGames Won: ${userData?.games_won || 0}\nWin Rate: ${calculateWinRate(userData)}%\nTotal Winnings: ${(userData?.total_winnings || 0).toLocaleString()} 🪙\`\`\``, 
                inline: false 
            },
            { 
                name: '🏆 GLOBAL LEADERBOARDS', 
                value: '`🏆 .game leaderboard` • `💰 .game leaderboard winnings`\n*Compete against other agents for top rankings!*', 
                inline: false 
            }
        )
        .setFooter({ text: 'EAGLE COMMUNITY • NEURAL ARCADE V2.0 • BKO-223' })
        .setTimestamp();
    
    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('game_dice')
                .setLabel('🎲 DICE')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('game_coinflip')
                .setLabel('🪙 COIN FLIP')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('game_slots')
                .setLabel('🎰 SLOTS')
                .setStyle(ButtonStyle.Danger),
            new ButtonBuilder()
                .setCustomId('game_blackjack')
                .setLabel('🃏 BLACKJACK')
                .setStyle(ButtonStyle.Secondary)
        );
    
    const row2 = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('game_rps')
                .setLabel('✊ RPS')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('game_guess')
                .setLabel('🔢 GUESS')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('game_stats')
                .setLabel('📊 STATS')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('game_leaderboard')
                .setLabel('🏆 LEADERBOARD')
                .setStyle(ButtonStyle.Danger)
        );
    
    const reply = await message.reply({ embeds: [menuEmbed], components: [row, row2] });
    
    // Button collector
    const collector = reply.createMessageComponentCollector({ time: 60000 });
    
    collector.on('collect', async (interaction) => {
        if (interaction.user.id !== message.author.id) {
            return interaction.reply({ content: '❌ This menu is not for you.', ephemeral: true });
        }
        
        await interaction.deferUpdate();
        
        switch(interaction.customId) {
            case 'game_dice':
                await playDiceGame(client, message, userData);
                break;
            case 'game_coinflip':
                await playCoinFlip(client, message, userData);
                break;
            case 'game_slots':
                await playSlots(client, message, userData);
                break;
            case 'game_blackjack':
                await playBlackjack(client, message, userData);
                break;
            case 'game_rps':
                await playRPS(client, message, userData);
                break;
            case 'game_guess':
                await playNumberGuess(client, message, userData);
                break;
            case 'game_stats':
                await showGameStats(client, message, userData);
                break;
            case 'game_leaderboard':
                await showGameLeaderboard(client, message);
                break;
        }
        
        collector.stop();
    });
}

// ================= DICE GAME (Interactive with user choice) =================
async function playDiceGame(client, message, userData, guess) {
    // Check if user provided a guess
    if (!guess) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription('❌ **Please specify your guess!**')
            .addFields({ name: '📝 USAGE', value: '`.game dice [1-6]`\nExample: `.game dice 4`' })
            .setFooter({ text: 'Predict the roll and win 5x your bet!' });
        return message.reply({ embeds: [embed] });
    }
    
    const userGuess = parseInt(guess);
    
    // Validate guess
    if (isNaN(userGuess) || userGuess < 1 || userGuess > 6) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
            .setDescription('❌ **Invalid guess!** Must be a number between 1-6.')
            .setFooter({ text: 'Example: .game dice 4' });
        return message.reply({ embeds: [embed] });
    }
    
    const bet = 100; // Base bet amount
    const roll = Math.floor(Math.random() * 6) + 1;
    const won = userGuess === roll;
    const winnings = won ? bet * 5 : -bet;
    
    // Update stats
    updateGameStats(message.author.id, won, winnings);
    
    // Get updated user data for win rate display
    const db = require('better-sqlite3')('database.sqlite');
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🎲 DICE ROULETTE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? '🎉 VICTORY!' : '💔 DEFEAT')
        .setDescription(`**You predicted:** \`${userGuess}\`\n**The dice landed:** \`${roll}\``)
        .addFields(
            { name: '💰 OUTCOME', value: won ? `+${winnings.toLocaleString()} 🪙` : `${winnings.toLocaleString()} 🪙`, inline: true },
            { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
        )
        .setFooter({ text: 'Neural dice calibrated • Luck-based operation' });
    
    message.reply({ embeds: [embed] });
}

// ================= COIN FLIP =================
async function playCoinFlip(client, message, userData, choice) {
    if (!choice || !['heads', 'tails', 'h', 't'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '🪙 COIN FLIP', iconURL: message.author.displayAvatarURL() })
            .setDescription('❌ **Please specify heads or tails!**')
            .addFields({ name: '📝 USAGE', value: '`.game coinflip [heads/tails]`\nExample: `.game coinflip heads`' })
            .setFooter({ text: '50/50 chance • Win 2x your bet!' });
        return message.reply({ embeds: [embed] });
    }
    
    // Normalize choice
    let normalizedChoice = choice.toLowerCase();
    if (normalizedChoice === 'h') normalizedChoice = 'heads';
    if (normalizedChoice === 't') normalizedChoice = 'tails';
    
    const bet = 100;
    const sides = ['heads', 'tails'];
    const result = sides[Math.floor(Math.random() * 2)];
    const won = normalizedChoice === result;
    const winnings = won ? bet : -bet;
    
    updateGameStats(message.author.id, won, winnings);
    
    const db = require('better-sqlite3')('database.sqlite');
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🪙 COIN FLIP', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? '✨ CORRECT CALL!' : '❌ WRONG GUESS')
        .setDescription(`**You chose:** \`${normalizedChoice}\`\n**The coin landed:** \`${result}\``)
        .addFields(
            { name: '💰 OUTCOME', value: won ? `+${winnings.toLocaleString()} 🪙` : `${winnings.toLocaleString()} 🪙`, inline: true },
            { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
        )
        .setFooter({ text: 'Probability matrix • Pure chance' });
    
    message.reply({ embeds: [embed] });
}

// ================= NUMBER GUESS (Interactive) =================
let activeGuesses = new Map();

async function playNumberGuess(client, message, userData) {
    // Check if user already has an active game
    if (activeGuesses.has(message.author.id)) {
        return message.reply('❌ You already have an active guess game! Complete it first.');
    }
    
    const target = Math.floor(Math.random() * 100) + 1;
    let attempts = 0;
    const maxAttempts = 5;
    
    activeGuesses.set(message.author.id, { target, attempts, maxAttempts });
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: '🔢 NUMBER GUESS', iconURL: message.author.displayAvatarURL() })
        .setTitle('🎯 GUESS THE NUMBER')
        .setDescription(`I'm thinking of a number between **1** and **100**.\nYou have **${maxAttempts}** attempts to guess it!`)
        .addFields(
            { name: '📝 HOW TO PLAY', value: 'Type your guess as a number in this channel.\nExample: `42`' },
            { name: '🏆 REWARD', value: 'Higher reward for fewer attempts!\n1 attempt: 100x • 2 attempts: 50x • 3 attempts: 25x • 4 attempts: 10x • 5 attempts: 5x' }
        )
        .setFooter({ text: 'You have 60 seconds to guess!' })
        .setTimestamp();
    
    await message.reply({ embeds: [embed] });
    
    // Create message collector for guesses
    const filter = m => m.author.id === message.author.id && !isNaN(parseInt(m.content));
    const collector = message.channel.createMessageCollector({ filter, time: 60000, max: maxAttempts });
    
    collector.on('collect', async (msg) => {
        const game = activeGuesses.get(message.author.id);
        if (!game) return;
        
        const guess = parseInt(msg.content);
        game.attempts++;
        
        if (guess === game.target) {
            // Win!
            const multiplier = [100, 50, 25, 10, 5][game.attempts - 1];
            const winnings = 100 * multiplier;
            
            updateGameStats(message.author.id, true, winnings);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const db = require('better-sqlite3')('database.sqlite');
            const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
            db.close();
            
            const winEmbed = new EmbedBuilder()
                .setColor('#57F287')
                .setAuthor({ name: '🔢 NUMBER GUESS', iconURL: message.author.displayAvatarURL() })
                .setTitle('🎉 PERFECT GUESS!')
                .setDescription(`**The number was:** \`${game.target}\`\n**You guessed it in:** \`${game.attempts}\` attempt(s)`)
                .addFields(
                    { name: '💰 REWARD', value: `+${winnings.toLocaleString()} 🪙 (${multiplier}x)`, inline: true },
                    { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
                )
                .setFooter({ text: 'Neural prediction engine • Risk vs reward' });
            
            await message.reply({ embeds: [winEmbed] });
        } else if (game.attempts >= game.maxAttempts) {
            // Lose - out of attempts
            updateGameStats(message.author.id, false, -50);
            activeGuesses.delete(message.author.id);
            collector.stop();
            
            const loseEmbed = new EmbedBuilder()
                .setColor('#ED4245')
                .setAuthor({ name: '🔢 NUMBER GUESS', iconURL: message.author.displayAvatarURL() })
                .setTitle('💔 GAME OVER')
                .setDescription(`**The number was:** \`${game.target}\`\n**You ran out of attempts!**`)
                .addFields(
                    { name: '💰 OUTCOME', value: `-50 🪙`, inline: true }
                )
                .setFooter({ text: 'Better luck next time!' });
            
            await message.reply({ embeds: [loseEmbed] });
        } else {
            // Give hint
            const hint = guess < game.target ? 'higher' : 'lower';
            const remaining = game.maxAttempts - game.attempts;
            
            const hintEmbed = new EmbedBuilder()
                .setColor('#FEE75C')
                .setDescription(`❌ **${guess}** is not correct. Guess **${hint}**!\n*${remaining} attempt(s) remaining.*`);
            
            await msg.reply({ embeds: [hintEmbed] });
        }
    });
    
    collector.on('end', () => {
        if (activeGuesses.has(message.author.id)) {
            const game = activeGuesses.get(message.author.id);
            if (game.attempts < game.maxAttempts) {
                updateGameStats(message.author.id, false, -50);
                activeGuesses.delete(message.author.id);
                message.reply('⏰ **Time\'s up!** You took too long to guess.');
            }
        }
    });
}

// ================= SLOT MACHINE =================
async function playSlots(client, message, userData) {
    const bet = 100;
    const symbols = ['🍒', '🍋', '🍊', '7️⃣', '💎', '🎰'];
    const reels = [
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    let multiplier = 0;
    if (reels[0] === reels[1] && reels[1] === reels[2]) {
        // Jackpot - all same
        if (reels[0] === '7️⃣') multiplier = 500;
        else if (reels[0] === '💎') multiplier = 250;
        else if (reels[0] === '🎰') multiplier = 100;
        else multiplier = 50;
    } else if (reels[0] === reels[1] || reels[1] === reels[2] || reels[0] === reels[2]) {
        multiplier = 2; // Two matching
    }
    
    const won = multiplier > 0;
    const winnings = won ? bet * multiplier : -bet;
    
    updateGameStats(message.author.id, won, winnings);
    
    const db = require('better-sqlite3')('database.sqlite');
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : '#ED4245')
        .setAuthor({ name: '🎰 SLOT MACHINE', iconURL: message.author.displayAvatarURL() })
        .setTitle(won ? '✨ JACKPOT!' : '💔 BETTER LUCK NEXT TIME')
        .setDescription(`\`\`\`\n┌─────┬─────┬─────┐\n│  ${reels[0]}  │  ${reels[1]}  │  ${reels[2]}  │\n└─────┴─────┴─────┘\n\`\`\``)
        .addFields(
            { name: '🎁 PRIZE', value: won ? `${winnings.toLocaleString()} 🪙 (${multiplier}x)` : `${winnings.toLocaleString()} 🪙`, inline: true },
            { name: '🎲 MULTIPLIER', value: `${multiplier}x`, inline: true },
            { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
        )
        .setFooter({ text: 'RNG certified • Fortune favors the bold' });
    
    message.reply({ embeds: [embed] });
}

// ================= BLACKJACK =================
async function playBlackjack(client, message, userData) {
    const playerHand = [drawCard(), drawCard()];
    const dealerHand = [drawCard(), drawCard()];
    
    const playerScore = calculateHand(playerHand);
    const dealerScore = calculateHand(dealerHand);
    
    let result = '';
    let won = false;
    let winnings = 0;
    
    if (playerScore > 21) {
        result = '💀 BUST! You exceeded 21.';
        won = false;
        winnings = -100;
    } else if (dealerScore > 21) {
        result = '🎉 DEALER BUST! You win!';
        won = true;
        winnings = 100;
    } else if (playerScore > dealerScore) {
        result = '🏆 VICTORY! Higher hand than dealer.';
        won = true;
        winnings = 100;
    } else if (dealerScore > playerScore) {
        result = '💔 DEFEAT! Dealer has higher hand.';
        won = false;
        winnings = -100;
    } else {
        result = '🤝 PUSH! It\'s a tie.';
        won = false;
        winnings = 0;
    }
    
    if (won) updateGameStats(message.author.id, true, winnings);
    else if (winnings < 0) updateGameStats(message.author.id, false, winnings);
    
    const db = require('better-sqlite3')('database.sqlite');
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : (winnings === 0 ? '#FEE75C' : '#ED4245'))
        .setAuthor({ name: '🃏 BLACKJACK', iconURL: message.author.displayAvatarURL() })
        .setTitle('═ CARD DUEL ═')
        .setDescription(result)
        .addFields(
            { name: '🎴 YOUR HAND', value: `\`${playerHand.join(' ')}\`\n**Score:** ${playerScore}`, inline: true },
            { name: '🃟 DEALER HAND', value: `\`${dealerHand.join(' ')}\`\n**Score:** ${dealerScore}`, inline: true },
            { name: '💰 RESULT', value: winnings !== 0 ? `${winnings > 0 ? '+' : ''}${winnings.toLocaleString()} 🪙` : 'No change', inline: false },
            { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
        )
        .setFooter({ text: 'Strategic card counting • 21 or bust' });
    
    message.reply({ embeds: [embed] });
}

// ================= ROCK PAPER SCISSORS =================
async function playRPS(client, message, userData, choice) {
    if (!choice || !['rock', 'paper', 'scissors', 'r', 'p', 's'].includes(choice.toLowerCase())) {
        const embed = new EmbedBuilder()
            .setColor('#ff4757')
            .setAuthor({ name: '✊ RPS DUEL', iconURL: message.author.displayAvatarURL() })
            .setDescription('❌ **Please specify rock, paper, or scissors!**')
            .addFields({ name: '📝 USAGE', value: '`.game rps [rock/paper/scissors]`\nExample: `.game rps rock`' })
            .setFooter({ text: 'Strategy matters! Win 2x your bet!' });
        return message.reply({ embeds: [embed] });
    }
    
    // Normalize choice
    let normalizedChoice = choice.toLowerCase();
    if (normalizedChoice === 'r') normalizedChoice = 'rock';
    if (normalizedChoice === 'p') normalizedChoice = 'paper';
    if (normalizedChoice === 's') normalizedChoice = 'scissors';
    
    const options = ['rock', 'paper', 'scissors'];
    const botChoice = options[Math.floor(Math.random() * 3)];
    
    let result = '';
    let won = false;
    let winnings = 0;
    
    if (normalizedChoice === botChoice) {
        result = '🤝 TIE!';
        won = false;
        winnings = 0;
    } else if (
        (normalizedChoice === 'rock' && botChoice === 'scissors') ||
        (normalizedChoice === 'paper' && botChoice === 'rock') ||
        (normalizedChoice === 'scissors' && botChoice === 'paper')
    ) {
        result = '🎉 VICTORY! You outsmarted the AI.';
        won = true;
        winnings = 100;
    } else {
        result = '💔 DEFEAT! AI predicts your moves.';
        won = false;
        winnings = -100;
    }
    
    if (won) updateGameStats(message.author.id, true, winnings);
    else if (winnings < 0) updateGameStats(message.author.id, false, winnings);
    
    const db = require('better-sqlite3')('database.sqlite');
    const updatedUser = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const emojis = { rock: '✊', paper: '✋', scissors: '✌️' };
    
    const embed = new EmbedBuilder()
        .setColor(won ? '#57F287' : (winnings === 0 ? '#FEE75C' : '#ED4245'))
        .setAuthor({ name: '✊ RPS DUEL', iconURL: message.author.displayAvatarURL() })
        .setTitle('═ STRATEGIC COMBAT ═')
        .setDescription(result)
        .addFields(
            { name: '🎮 YOUR MOVE', value: `${emojis[normalizedChoice]} **${normalizedChoice.toUpperCase()}**`, inline: true },
            { name: '🤖 AI MOVE', value: `${emojis[botChoice]} **${botChoice.toUpperCase()}**`, inline: true },
            { name: '💰 OUTCOME', value: winnings !== 0 ? `${winnings > 0 ? '+' : ''}${winnings.toLocaleString()} 🪙` : 'No change', inline: false },
            { name: '📊 WIN RATE', value: `${calculateWinRate(updatedUser)}%`, inline: true }
        )
        .setFooter({ text: 'Strategic duel • Mind games' });
    
    message.reply({ embeds: [embed] });
}

// ================= GAME STATS =================
async function showGameStats(client, message, userData) {
    const db = require('better-sqlite3')('database.sqlite');
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(message.author.id);
    db.close();
    
    const gamesPlayed = user?.games_played || 0;
    const gamesWon = user?.games_won || 0;
    const totalWinnings = user?.total_winnings || 0;
    const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
    const avgWinnings = gamesWon > 0 ? Math.round(totalWinnings / gamesWon) : 0;
    
    const embed = new EmbedBuilder()
        .setColor('#00fbff')
        .setAuthor({ name: '📊 AGENT GAME STATISTICS', iconURL: message.author.displayAvatarURL() })
        .setTitle('═ NEURAL ARCADE PROFILE ═')
        .setDescription(`**Agent:** ${message.author.username}`)
        .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
        .addFields(
            { name: '🎮 TOTAL GAMES', value: `\`${gamesPlayed.toLocaleString()}\``, inline: true },
            { name: '🏆 GAMES WON', value: `\`${gamesWon.toLocaleString()}\``, inline: true },
            { name: '📈 WIN RATE', value: `\`${winRate}%\``, inline: true },
            { name: '💰 TOTAL WINNINGS', value: `\`${totalWinnings.toLocaleString()} 🪙\``, inline: true },
            { name: '🎯 AVG WINNINGS', value: `\`${avgWinnings.toLocaleString()} 🪙\``, inline: true },
            { name: '💀 GAMES LOST', value: `\`${(gamesPlayed - gamesWon).toLocaleString()}\``, inline: true }
        )
        .setFooter({ text: 'Keep playing to unlock achievements! • .game menu', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= LEADERBOARD =================
async function showGameLeaderboard(client, message, type = 'wins') {
    const db = require('better-sqlite3')('database.sqlite');
    
    let orderBy = '';
    let title = '';
    let icon = '';
    let color = '';
    
    switch(type) {
        case 'wins':
        case 'win':
            orderBy = 'games_won DESC';
            title = 'MOST VICTORIES';
            icon = '🏆';
            color = '#FEE75C';
            break;
        case 'winnings':
        case 'money':
        case 'rich':
            orderBy = 'total_winnings DESC';
            title = 'RICHEST AGENTS';
            icon = '💰';
            color = '#57F287';
            break;
        case 'played':
        case 'active':
            orderBy = 'games_played DESC';
            title = 'MOST ACTIVE';
            icon = '🎮';
            color = '#EB459E';
            break;
        default:
            orderBy = 'games_won DESC';
            title = 'MOST VICTORIES';
            icon = '🏆';
            color = '#FEE75C';
    }
    
    const topPlayers = db.prepare(`SELECT id, username, games_played, games_won, total_winnings FROM users WHERE games_played > 0 ORDER BY ${orderBy} LIMIT 10`).all();
    db.close();
    
    if (topPlayers.length === 0) {
        return message.reply('📊 No game data available yet. Start playing to appear on leaderboards!');
    }
    
    const leaderboardText = topPlayers.map((player, i) => {
        const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
        const winRate = Math.round((player.games_won / player.games_played) * 100);
        
        if (type === 'wins' || type === 'win') {
            return `${medal} **${player.username}** • 🏆 ${player.games_won} wins (${winRate}% WR)`;
        } else if (type === 'winnings' || type === 'money') {
            return `${medal} **${player.username}** • 💰 ${player.total_winnings.toLocaleString()} 🪙 (${player.games_won} wins)`;
        } else if (type === 'played' || type === 'active') {
            return `${medal} **${player.username}** • 🎮 ${player.games_played} games • 🏆 ${player.games_won} wins`;
        }
        return `${medal} **${player.username}** • 🏆 ${player.games_won} wins`;
    }).join('\n');
    
    const embed = new EmbedBuilder()
        .setColor(color)
        .setAuthor({ name: `${icon} GLOBAL LEADERBOARD: ${title}`, iconURL: client.user.displayAvatarURL() })
        .setTitle('═ NEURAL ARCADE RANKINGS ═')
        .setDescription(`\`\`\`yaml\n${leaderboardText}\`\`\``)
        .addFields(
            { 
                name: '📊 YOUR STATS', 
                value: `\`\`\`prolog\nUse .game stats to view your personal gaming profile\`\`\``,
                inline: false 
            }
        )
        .setFooter({ text: 'Play more games to climb the ranks! • .game menu to start', iconURL: client.user.displayAvatarURL() })
        .setTimestamp();
    
    message.reply({ embeds: [embed] });
}

// ================= HELPER FUNCTIONS =================
function drawCard() {
    const cards = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    return cards[Math.floor(Math.random() * cards.length)];
}

function calculateHand(hand) {
    let sum = 0;
    let aces = 0;
    
    for (const card of hand) {
        if (card === 'J' || card === 'Q' || card === 'K') sum += 10;
        else if (card === 'A') aces++;
        else sum += parseInt(card);
    }
    
    for (let i = 0; i < aces; i++) {
        if (sum + 11 <= 21) sum += 11;
        else sum += 1;
    }
    
    return sum;
}

function calculateWinRate(userData) {
    const played = userData?.games_played || 0;
    const won = userData?.games_won || 0;
    if (played === 0) return 0;
    return Math.round((won / played) * 100);
}

function updateGameStats(userId, won, winnings) {
    const db = require('better-sqlite3')('database.sqlite');
    
    // Add columns if needed
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN games_played INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN games_won INTEGER DEFAULT 0`).run();
        db.prepare(`ALTER TABLE users ADD COLUMN total_winnings INTEGER DEFAULT 0`).run();
    } catch (e) {}
    
    if (won) {
        db.prepare(`UPDATE users SET games_played = games_played + 1, games_won = games_won + 1, total_winnings = total_winnings + ? WHERE id = ?`).run(winnings, userId);
    } else {
        db.prepare(`UPDATE users SET games_played = games_played + 1, total_winnings = total_winnings + ? WHERE id = ?`).run(winnings, userId);
    }
    
    db.close();
}