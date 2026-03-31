const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat', 'loadout', 'profile'],
    description: '⚔️ Register your primary combat sector, mode, and rank into the neural network.',
    category: 'GAMING',
    
    // Advanced cooldown system
    cooldown: 10,
    
    run: async (client, message, args, db) => { // Using existing db connection from index.js
        const prefix = process.env.PREFIX || '.';
        const fullInput = args.join(' ');
        
        // 1. ADVANCED MULTIMODAL PARSING WITH MULTIPLE FORMATS
        let gameName, modeName, rankName;
        
        if (!fullInput) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setAuthor({ 
                    name: '⚠️ INPUT ERROR: MODE_UNDEFINED', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle('❌ INCOMPLETE COMBAT DATA')
                .setDescription(
                    `**Neural interface requires complete synchronization.**\n\n` +
                    `To register your specialization, use one of these formats:\n` +
                    `\`\`\`yaml\n${prefix}setgame Game | Mode | Rank\n${prefix}setgame Game, Mode, Rank\n${prefix}setgame Game Mode Rank\`\`\``
                )
                .addFields(
                    { 
                        name: '🎮 POPULAR GAMES', 
                        value: `\`Call of Duty\` • \`Valorant\` • \`Apex Legends\` • \`Fortnite\` • \`CS2\` • \`League of Legends\` • \`Overwatch 2\` • \`Rainbow Six Siege\``, 
                        inline: false 
                    },
                    { 
                        name: '⚔️ GAME MODES', 
                        value: `\`Ranked\` • \`Casual\` • \`Competitive\` • \`Battle Royale\` • \`Arena\` • \`Deathmatch\` • \`Objective\``, 
                        inline: true 
                    },
                    { 
                        name: '🏆 RANK TIERS', 
                        value: `\`Unranked\` • \`Bronze\` • \`Silver\` • \`Gold\` • \`Platinum\` • \`Diamond\` • \`Master\` • \`Grandmaster\` • \`Challenger\``, 
                        inline: true 
                    },
                    { 
                        name: '📝 EXAMPLE USAGE', 
                        value: `\`\`\`fix\n${prefix}setgame Call of Duty | Ranked | Diamond II\`\`\``, 
                        inline: true 
                    }
                )
                .setFooter({ text: 'ARCHITECT CG-223 • Awaiting valid data transmission' })
                .setTimestamp();

            return message.reply({ embeds: [errorEmbed] });
        }
        
        // Support multiple input formats
        if (fullInput.includes('|')) {
            // Format: Game | Mode | Rank
            const parts = fullInput.split('|').map(p => p.trim());
            [gameName, modeName, rankName] = parts;
        } else if (fullInput.includes(',')) {
            // Format: Game, Mode, Rank
            const parts = fullInput.split(',').map(p => p.trim());
            [gameName, modeName, rankName] = parts;
        } else {
            // Format: Game Mode Rank (space-separated, but limited)
            const words = fullInput.split(' ');
            if (words.length >= 3) {
                // Assume last word is rank, second last is mode, rest is game
                rankName = words.pop();
                modeName = words.pop();
                gameName = words.join(' ');
            } else {
                // Not enough arguments
                const errorEmbed = new EmbedBuilder()
                    .setColor('#ff4757')
                    .setTitle('❌ INSUFFICIENT ARGUMENTS')
                    .setDescription(`Please provide **Game**, **Mode**, and **Rank** using one of these formats:\n\`\`\`yaml\n${prefix}setgame Game | Mode | Rank\n${prefix}setgame Game, Mode, Rank\n${prefix}setgame Game Mode Rank\`\`\``)
                    .setFooter({ text: 'Example: .setgame Valorant | Ranked | Diamond III' });
                
                return message.reply({ embeds: [errorEmbed] });
            }
        }
        
        // 2. ENHANCED DATA CLEANING & VALIDATION
        const safeGame = gameName.slice(0, 40).toUpperCase();
        const safeMode = modeName.slice(0, 30).toUpperCase();
        const safeRank = rankName.slice(0, 35);
        
        // 3. INTELLIGENT GAME VALIDATION
        const validGames = ['CALL OF DUTY', 'VALORANT', 'APEX LEGENDS', 'FORTNITE', 'CS2', 'COUNTER-STRIKE', 'LEAGUE OF LEGENDS', 'OVERWATCH', 'RAINBOW SIX SIEGE'];
        const validModes = ['RANKED', 'CASUAL', 'COMPETITIVE', 'BATTLE ROYALE', 'ARENA', 'DEATHMATCH', 'OBJECTIVE', 'MULTIPLAYER', 'ZOMBIES', 'DMZ'];
        
        const gameSuggestion = validGames.find(g => g.includes(safeGame) || safeGame.includes(g));
        const modeSuggestion = validModes.find(m => m.includes(safeMode) || safeMode.includes(m));
        
        // 4. SIMPLE BUT EFFECTIVE DATABASE UPDATE
        const gamingData = {
            game: safeGame,
            mode: safeMode,
            rank: safeRank,
            lastUpdated: Date.now(),
            lastUpdatedISO: new Date().toISOString()
        };
        
        try {
            // Get current user data to preserve other fields
            const currentUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(message.author.id);
            
            // Update the user's gaming data
            db.prepare(`UPDATE users SET gaming = ? WHERE id = ?`)
              .run(JSON.stringify(gamingData), message.author.id);
            
            // Get updated user data with proper column names
            const updatedUser = db.prepare(`
                SELECT 
                    id,
                    level,
                    xp,
                    total_messages,
                    gaming,
                    created_at
                FROM users 
                WHERE id = ?
            `).get(message.author.id);
            
            // 5. THE OPTIMIZED DOSSIER EMBED
            const successEmbed = new EmbedBuilder()
                .setColor(getRankColor(safeRank))
                .setAuthor({ 
                    name: `🎮 COMBAT PROFILE: ${message.author.username.toUpperCase()}`, 
                    iconURL: message.author.displayAvatarURL({ dynamic: true, size: 1024 }) 
                })
                .setTitle('✅ NEURAL SPECIALIZATION LOCKED')
                .setDescription(`**Agent ${message.author.username} has been successfully registered into the combat matrix.**`)
                .setThumbnail(getGameThumbnail(safeGame, client)) // Pass client to helper
                .addFields(
                    { 
                        name: '🎯 PRIMARY SECTOR', 
                        value: `\`\`\`fix\n${safeGame}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '⚙️ COMBAT MODE', 
                        value: `\`\`\`fix\n${safeMode}\`\`\``, 
                        inline: true 
                    },
                    { 
                        name: '🏆 RANK / TIER', 
                        value: `\`\`\`${getRankCodeBlock(safeRank)}\n${safeRank}\`\`\``, 
                        inline: true 
                    }
                )
                .addFields(
                    {
                        name: '📊 AGENT STATUS',
                        value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${updatedUser?.level || 1}\n\u001b[1;32m▣\u001b[0m XP: ${(updatedUser?.xp || 0).toLocaleString()}\n\u001b[1;33m▣\u001b[0m Messages: ${(updatedUser?.total_messages || 0).toLocaleString()}\`\`\``,
                        inline: true
                    },
                    {
                        name: '⏱️ LAST SYNC',
                        value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                        inline: true
                    }
                );
            
            // Add validation warnings if suggestions were found
            if (gameSuggestion && gameSuggestion !== safeGame) {
                successEmbed.addFields({
                    name: '💡 GAME SUGGESTION',
                    value: `Did you mean **${gameSuggestion}**? Use \`${prefix}setgame ${gameSuggestion} | ${safeMode} | ${safeRank}\` to update.`,
                    inline: false
                });
            }
            
            if (modeSuggestion && modeSuggestion !== safeMode) {
                successEmbed.addFields({
                    name: '💡 MODE SUGGESTION',
                    value: `Did you mean **${modeSuggestion}**? Use \`${prefix}setgame ${safeGame} | ${modeSuggestion} | ${safeRank}\` to update.`,
                    inline: false
                });
            }
            
            // Add dynamic rank message
            const rankMessage = getRankMessage(safeRank);
            
            successEmbed
                .setFooter({ 
                    text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTimestamp();
            
            // Create interactive buttons (optional)
            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('view_profile')
                        .setLabel('📊 View Profile')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true), // Disabled until you implement the interaction handler
                    new ButtonBuilder()
                        .setCustomId('update_game')
                        .setLabel('🔄 Update Game')
                        .setStyle(ButtonStyle.Secondary)
                        .setDisabled(true)
                );
            
            await message.reply({ 
                content: `> ${rankMessage}`,
                embeds: [successEmbed],
                components: [row]
            });
            
        } catch (error) {
            console.error('SetGame Error:', error);
            
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setTitle('❌ DATABASE SYNC ERROR')
                .setDescription('Failed to synchronize combat data. Please try again later.')
                .addFields(
                    { name: 'Error Code', value: `\`${error.message}\``, inline: false }
                )
                .setFooter({ text: 'Contact an administrator if this persists.' });
            
            return message.reply({ embeds: [errorEmbed] });
        }
    }
};

// Helper Functions

function getGameThumbnail(game, client) {
    const thumbnails = {
        'CALL OF DUTY': 'https://i.imgur.com/COD_Thumb.png',
        'VALORANT': 'https://i.imgur.com/Valorant_Thumb.png',
        'APEX LEGENDS': 'https://i.imgur.com/Apex_Thumb.png',
        'FORTNITE': 'https://i.imgur.com/Fortnite_Thumb.png',
        'LEAGUE OF LEGENDS': 'https://i.imgur.com/LoL_Thumb.png',
        'CS2': 'https://i.imgur.com/CS2_Thumb.png',
        'COUNTER-STRIKE': 'https://i.imgur.com/CS2_Thumb.png',
        'OVERWATCH': 'https://i.imgur.com/Overwatch_Thumb.png',
        'RAINBOW SIX SIEGE': 'https://i.imgur.com/R6_Thumb.png'
    };
    
    // Find matching game thumbnail
    for (const [key, value] of Object.entries(thumbnails)) {
        if (game.includes(key)) return value;
    }
    
    // Default to bot's avatar if no match found (safe fallback)
    return client?.user?.displayAvatarURL() || 'https://i.imgur.com/Default_Game_Thumb.png';
}

function getRankColor(rank) {
    const rankLower = rank.toLowerCase();
    if (rankLower.includes('bronze')) return '#cd7f32'; // Bronze
    if (rankLower.includes('silver')) return '#c0c0c0'; // Silver
    if (rankLower.includes('gold')) return '#ffd700'; // Gold
    if (rankLower.includes('platinum')) return '#e5e4e2'; // Platinum
    if (rankLower.includes('diamond')) return '#b9f2ff'; // Diamond
    if (rankLower.includes('master')) return '#ff0066'; // Master
    if (rankLower.includes('grandmaster')) return '#ff00ff'; // Grandmaster
    if (rankLower.includes('challenger')) return '#ff4500'; // Challenger
    return '#00ff9d'; // Default neon green
}

function getRankCodeBlock(rank) {
    const rankLower = rank.toLowerCase();
    if (rankLower.includes('bronze')) return 'rust';
    if (rankLower.includes('silver')) return 'md';
    if (rankLower.includes('gold')) return 'yaml';
    if (rankLower.includes('platinum')) return 'fix';
    if (rankLower.includes('diamond')) return 'css';
    if (rankLower.includes('master')) return 'diff';
    if (rankLower.includes('grandmaster')) return 'apache';
    if (rankLower.includes('challenger')) return '1c';
    return 'fix';
}

function getRankMessage(rank) {
    const rankLower = rank.toLowerCase();
    
    if (rankLower.includes('bronze')) return '🌱 **Bronze Warrior** - Every master was once a beginner. Your journey begins now!';
    if (rankLower.includes('silver')) return '⚡ **Silver Striker** - Consistency is key. You\'re on the right path!';
    if (rankLower.includes('gold')) return '✨ **Gold Guardian** - Above average, but greatness awaits!';
    if (rankLower.includes('platinum')) return '💎 **Platinum Predator** - Elite skills detected. You\'re in the top tier!';
    if (rankLower.includes('diamond')) return '👑 **Diamond Dominator** - Exceptional talent! You stand among the best!';
    if (rankLower.includes('master')) return '🔥 **MASTER TITAN** - Legendary status achieved! Your skills are unmatched!';
    if (rankLower.includes('grandmaster')) return '💀 **GRANDMASTER LEGEND** - You are among the 0.01%! Absolute perfection!';
    if (rankLower.includes('challenger')) return '🌟 **CHALLENGER ELITE** - The pinnacle of competitive gaming! You are a living legend!';
    
    return '🎯 **Combat data synchronized** - Ready for deployment, agent!';
}