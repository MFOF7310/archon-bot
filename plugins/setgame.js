const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat'],
    description: 'Register your primary combat sector, mode, and rank into the neural network.',
    category: 'GAMING',
    run: async (client, message, args, userData) => {
        const prefix = process.env.PREFIX || '.';
        const fullInput = args.join(' ');

        // 1. ADVANCED MULTIMODAL PARSING (Supports Game | Mode | Rank)
        const parts = fullInput.split('|').map(p => p.trim());
        const gameName = parts[0];
        const modeName = parts[1];
        const rankName = parts[2];

        // 2. ERROR HANDSHAKE (With Visual Mode Guide)
        if (!gameName || !modeName || !rankName) {
            const errorEmbed = new EmbedBuilder()
                .setColor('#ff4757')
                .setAuthor({ 
                    name: '⚠️ INPUT ERROR: MODE_UNDEFINED', 
                    iconURL: client.user.displayAvatarURL() 
                })
                .setTitle('❌ INCOMPLETE COMBAT DATA')
                .setDescription(
                    `**Neural interface requires complete synchronization.**\n\n` +
                    `To register your specialization, you must define the **Game**, **Mode**, and **Rank**.\n` +
                    `\`\`\`yaml\n${prefix}setgame [Game] | [Mode] | [Rank]\`\`\``
                )
                .addFields(
                    { 
                        name: '🎮 SUPPORTED GAMES', 
                        value: `\`Call of Duty\` • \`Valorant\` • \`Apex Legends\` • \`Fortnite\` • \`CS:GO\` • \`League of Legends\``, 
                        inline: false 
                    },
                    { 
                        name: '⚔️ RECOGNIZED MODES', 
                        value: `\`MP\` (Multiplayer) • \`BR\` (Battle Royale) • \`ZM\` (Zombies) • \`DMZ\` • \`Ranked\` • \`Casual\``, 
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

        // 3. DATA CLEANING & SECURITY
        const safeGame = gameName.slice(0, 30).toUpperCase();
        const safeMode = modeName.slice(0, 20).toUpperCase();
        const safeRank = rankName.slice(0, 25);

        // 4. DATABASE SYNC (SQLite)
        const db = require('better-sqlite3')('database.sqlite');
        
        // Check if the gaming column exists, if not, add it
        try {
            db.prepare(`ALTER TABLE users ADD COLUMN gaming TEXT`).run();
        } catch (e) {
            // Column already exists, ignore error
        }
        
        // Store gaming data as JSON string
        const gamingData = JSON.stringify({
            game: safeGame,
            mode: safeMode,
            rank: safeRank,
            timestamp: Date.now(),
            lastUpdated: new Date().toISOString()
        });
        
        // Update the user's gaming data
        db.prepare(`UPDATE users SET gaming = ? WHERE id = ?`).run(gamingData, message.author.id);
        
        // Get updated user data
        const updatedUser = db.prepare(`SELECT * FROM users WHERE id = ?`).get(message.author.id);
        db.close();

        // 5. THE MULTIMODAL DOSSIER
        const successEmbed = new EmbedBuilder()
            .setColor('#00ff9d')
            .setAuthor({ 
                name: `🎮 COMBAT PROFILE: ${message.author.username.toUpperCase()}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true, size: 1024 }) 
            })
            .setTitle('✅ NEURAL SPECIALIZATION LOCKED')
            .setDescription(`**Agent ${message.author.username} has been successfully registered into the combat matrix.**`)
            .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { 
                    name: '🎯 PRIMARY SECTOR', 
                    value: `\`\`\`prolog\n${safeGame}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '⚙️ COMBAT MODE', 
                    value: `\`\`\`prolog\n${safeMode}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🏆 RANK / TIER', 
                    value: `\`\`\`prolog\n${safeRank}\`\`\``, 
                    inline: true 
                }
            )
            .addFields(
                {
                    name: '📊 AGENT STATUS',
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${updatedUser?.level || 1}\n\u001b[1;32m▣\u001b[0m XP: ${(updatedUser?.xp || 0).toLocaleString()}\n\u001b[1;33m▣\u001b[0m Messages: ${(updatedUser?.totalMessages || 0).toLocaleString()}\`\`\``,
                    inline: true
                },
                {
                    name: '⏱️ LAST SYNC',
                    value: `<t:${Math.floor(Date.now() / 1000)}:R>`,
                    inline: true
                }
            )
            .setFooter({ 
                text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        // Add dynamic message based on rank tier
        let rankMessage = '';
        if (safeRank.toLowerCase().includes('bronze')) rankMessage = '🌱 **Starting your journey. Keep grinding!**';
        else if (safeRank.toLowerCase().includes('silver')) rankMessage = '⚡ **Silver tier achieved. Progressing steadily!**';
        else if (safeRank.toLowerCase().includes('gold')) rankMessage = '✨ **Gold tier! You\'re becoming a formidable agent.**';
        else if (safeRank.toLowerCase().includes('platinum')) rankMessage = '💎 **Platinum tier! Elite skills detected.**';
        else if (safeRank.toLowerCase().includes('diamond')) rankMessage = '👑 **Diamond tier! A true warrior emerges.**';
        else if (safeRank.toLowerCase().includes('master')) rankMessage = '🔥 **MASTER TIER! Legendary status achieved!**';
        else rankMessage = '🎯 **Combat data synchronized. Ready for deployment!**';

        message.reply({ 
            content: `> **${rankMessage}**`,
            embeds: [successEmbed] 
        });
    }
};