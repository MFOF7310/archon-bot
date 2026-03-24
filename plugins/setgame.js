const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'setgame',
    aliases: ['sg', 'spec', 'combat'],
    description: 'Register your primary combat sector, mode, and rank.',
    category: 'GAMING',
    run: async (client, message, args, database) => {
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
                .setAuthor({ name: 'INPUT ERROR: MODE_UNDEFINED', iconURL: client.user.displayAvatarURL() })
                .setDescription(
                    `To register your specialization, you must define the **Game**, **Mode**, and **Rank**.\n` +
                    `\`\`\`fix\n${prefix}setgame [Game] | [Mode] | [Rank]\`\`\``
                )
                .addFields(
                    { name: '📂 RECOGNIZED MODES', value: `\`MP\` (Multiplayer), \`BR\` (Battle Royale), \`ZM\` (Zombies), \`DMZ\``, inline: true },
                    { name: '📝 EXAMPLE', value: `\`${prefix}setgame CODM | BR | Legendary\``, inline: true }
                )
                .setFooter({ text: 'Neural Interface: Awaiting valid data...' });

            return message.reply({ embeds: [errorEmbed] });
        }

        // 3. DATA CLEANING & SECURITY
        const safeGame = gameName.slice(0, 20).toUpperCase();
        const safeMode = modeName.slice(0, 10).toUpperCase();
        const safeRank = rankName.slice(0, 20);

        // 4. DATABASE SYNC
        if (!database[message.author.id]) {
            database[message.author.id] = { xp: 0, level: 1 };
        }

        database[message.author.id].gaming = {
            game: safeGame,
            mode: safeMode,
            rank: safeRank,
            timestamp: Date.now()
        };

        if (typeof client.saveDatabase === 'function') {
            await client.saveDatabase();
        }

        // 5. THE MULTIMODAL DOSSIER
        const successEmbed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ 
                name: `COMBAT PROFILE: ${message.author.username.toUpperCase()}`, 
                iconURL: message.author.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle('─ NEURAL SPECIALIZATION LOCKED ─')
            .addFields(
                { 
                    name: '🕹️ SECTOR', 
                    value: `\`\`\`ansi\n\u001b[1;36m${safeGame}\u001b[0m\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🛰️ MODE', 
                    value: `\`\`\`ansi\n\u001b[1;35m${safeMode}\u001b[0m\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🎖️ RANK', 
                    value: `\`\`\`ansi\n\u001b[1;33m${safeRank}\u001b[0m\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ text: 'Eagle Community • Digital Sovereignty • BKO-223' })
            .setTimestamp();

        message.reply({ 
            content: `> **Syncing multimodal data... specialization recorded.**`,
            embeds: [successEmbed] 
        });
    }
};
