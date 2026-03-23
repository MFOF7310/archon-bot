const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    aliases: ['p', 'id'],
    description: 'Dossier d\'agent intelligent et dynamique.',
    run: async (client, message, args, database) => {
        const target = message.mentions.users.first() || message.author;
        
        // --- DATA REPAIR & INITIALIZATION ---
        // On s'assure que chaque champ existe pour éviter le NaN
        const userData = database[target.id] || {};
        const user = {
            xp: userData.xp || 0,
            level: userData.level || 1,
            lastSeen: userData.lastSeen || Date.now(), // Réparation automatique si missing
            achievements: userData.achievements || [],
            gaming: {
                game: userData.gaming?.game || "CODM",
                rank: userData.gaming?.rank || "Unranked"
            }
        };

        // --- DYNAMIC XP CALCULATION ---
        // Le prochain niveau demande (Niveau actuel + 1) * 1000 XP
        const nextLevelXP = (user.level + 1) * 1000;
        const currentLevelXP = user.xp % nextLevelXP; 
        const progressPercent = Math.min(Math.floor((currentLevelXP / 1000) * 100), 100);

        // --- MOBILE-OPTIMIZED PROGRESS BAR (Scale 7) ---
        const barSize = 7; 
        const filled = Math.round((progressPercent / 100) * barSize);
        const progressBar = '🟦'.repeat(filled) + '⬛'.repeat(barSize - filled);

        // --- TIMESTAMP REPAIR ---
        // On vérifie que lastSeen est bien un nombre valide avant de diviser
        const validTimestamp = !isNaN(user.lastSeen) ? Math.floor(user.lastSeen / 1000) : Math.floor(Date.now() / 1000);
        const lastActive = `<t:${validTimestamp}:R>`;

        // --- MEDALS LOGIC ---
        const medalIcons = { "sniper": "🎯", "veteran": "🎖️", "elite": "🔥" };
        const medals = user.achievements.length > 0 
            ? user.achievements.map(m => medalIcons[m] || '🏅').join(' ') 
            : "*Aucune médaille*";

        const embed = new EmbedBuilder()
            .setColor('#2b2d31')
            .setAuthor({ 
                name: `DOSSIER AGENT : ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL() 
            })
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { 
                    name: '📊 ÉTAT DE SERVICE', 
                    value: `⚡ **Niveau:** \`${user.level}\` \n✨ **XP:** \`${user.xp.toLocaleString()}\``, 
                    inline: true 
                },
                { 
                    name: '🕹️ INFOS RANG', 
                    value: `🎮 **Jeu:** \`${user.gaming.game}\` \n🏆 **Rang:** \`${user.gaming.rank}\``, 
                    inline: true 
                },
                { 
                    name: `📈 PROGRESSION VERS NIV. ${user.level + 1}`, 
                    value: `${progressBar} \`${progressPercent}%\``, 
                    inline: false 
                },
                { 
                    name: '🏅 MÉDAILLES', 
                    value: medals, 
                    inline: true 
                },
                { 
                    name: '🕒 DERNIÈRE ACTIVITÉ', 
                    value: lastActive, 
                    inline: true 
                }
            )
            .setFooter({ text: `Eagle Community | Bamako-223 | ID: ${target.id.slice(0,8)}` })
            .setTimestamp();

        await message.reply({ embeds: [embed] });
    },
};
