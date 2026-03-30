const { EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const db = new Database('database.sqlite');

// --- GAMING WORD LIST ---
const wordList = [
    "BOOSTEROID", "GEFORCE", "STARLINK", "SAMSUNG", "UNCHARTED", 
    "ARCHITECT", "BAMAKO", "GAMEPLAY", "LATENCY", "STREAMING",
    "NVIDIA", "CONSOLE", "CONTROLLER", "NETWORK", "ENGINE"
];

module.exports = {
    name: 'wrg',
    aliases: ['wordguess', 'guess'],
    run: async (client, message, args) => {
        // 1. Pick a random word
        const targetWord = wordList[Math.floor(Math.random() * wordList.length)];
        const scrambled = targetWord.split('').sort(() => Math.random() - 0.5).join('');
        
        const startEmbed = new EmbedBuilder()
            .setColor('#00d9ff')
            .setTitle('🎮 WORD GUESSING CHALLENGE')
            .setDescription(
                `The Architect has scrambled a gaming-related word!\n\n` +
                `🧩 Scrambled: **${scrambled}**\n\n` +
                `• Be the first to type the correct word to win!\n` +
                `• Reward: **50 XP** ⚡`
            )
            .setFooter({ text: 'You have 30 seconds to guess!' })
            .setTimestamp();

        await message.channel.send({ embeds: [startEmbed] });

        // 2. Setup Message Collector
        const filter = m => !m.author.bot;
        const collector = message.channel.createMessageCollector({ filter, time: 30000 });

        collector.on('collect', async (m) => {
            if (m.content.toUpperCase() === targetWord) {
                collector.stop('winner');
                
                // 3. Update SQLite Database for Winner
                const userId = m.author.id;
                const userData = db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
                
                if (userData) {
                    const newXP = userData.xp + 50;
                    db.prepare("UPDATE users SET xp = ? WHERE id = ?").run(newXP, userId);
                }

                const winEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('🏆 WE HAVE A WINNER!')
                    .setDescription(
                        `GG **${m.author.username}**! The word was **${targetWord}**.\n\n` +
                        `💰 **Reward:** \`+50 XP\` added to your profile!`
                    )
                    .setThumbnail(m.author.displayAvatarURL())
                    .setTimestamp();

                await m.reply({ embeds: [winEmbed] });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                message.channel.send(`⏰ **Time is up!** Nobody guessed it. The word was **${targetWord}**.`);
            }
        });
    }
};
