const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../database.json');

module.exports = {
    name: 'setgame',
    category: 'Gaming',
    description: 'Sync your gaming profile to the Digital Engine.',
    async execute(message, args) {
        // 1. Better Help / Validation
        if (!args.length || !message.content.includes('|')) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#ffcc00')
                .setTitle('⌨️ INPUT REQUIRED')
                .setDescription('To archive your stats, use the vertical bar `|` to separate info.')
                .addFields(
                    { name: '📝 Format', value: '`,setgame Game | Rank | Stats`' },
                    { name: '💡 Example', value: '`,setgame CODM | Legendary | 2.5 KD`' }
                )
                .setFooter({ text: 'Ensure you include the | symbol between items.' });
            
            return message.reply({ embeds: [helpEmbed] });
        }

        // 2. Parse the input
        const details = args.join(' ').split('|').map(item => item.trim());
        const gameData = {
            game: details[0] || "Unknown",
            rank: details[1] || "Unranked",
            stats: details[2] || "N/A"
        };

        // 3. Read & Merge Data (Crucial to keep XP!)
        let database = {};
        if (fs.existsSync(dbPath)) {
            try {
                database = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
            } catch (err) { database = {}; }
        }

        // If the user exists, we keep their XP/Level and just add/update 'gaming'
        const uid = message.author.id;
        database[uid] = {
            ...database[uid], // Keep existing XP, Level, and Name
            gaming: gameData  // Nest the gaming stats inside
        };

        fs.writeFileSync(dbPath, JSON.stringify(database, null, 4));

        // 4. Send Success Embed
        const successEmbed = new EmbedBuilder()
            .setColor('#00ffcc')
            .setAuthor({ name: 'DATA ARCHIVE SUCCESSFUL', iconURL: message.author.displayAvatarURL() })
            .setTitle('🎮 PROFILE SYNCED')
            .setThumbnail('https://i.imgur.com/8Qp7mX9.png') // Optional: Add a cool gaming icon
            .addFields(
                { name: '🕹️ Registered Game', value: `\`${gameData.game}\``, inline: true },
                { name: '🏅 Current Rank', value: `\`${gameData.rank}\``, inline: true },
                { name: '📈 Performance', value: `\`${gameData.stats}\``, inline: false }
            )
            .setFooter({ text: 'User Profile updated in CLOUD_GAMING Core' })
            .setTimestamp();

        await message.reply({ embeds: [successEmbed] });
    },
};
