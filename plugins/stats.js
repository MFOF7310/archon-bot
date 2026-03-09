const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['profile', 'engine', 'level'],
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. DYNAMIC TARGETING (Mention > Reply > Self)
        let target = message.mentions.users.first();
        if (!target && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            target = repliedMsg.author;
        }
        if (!target) target = message.author;

        const userData = database[target.id];

        if (!userData) {
            return message.reply("⚠️ **ERROR:** Sujet non répertorié dans la base de données Bamako-223.");
        }

        // 2. GLOBAL RANKING CALCULATION
        // Sort all users by XP to find the target's rank
        const sortedUsers = Object.entries(database)
            .sort(([, a], [, b]) => b.xp - a.xp);
        const rank = sortedUsers.findIndex(([id]) => id === target.id) + 1;
        const totalAgents = sortedUsers.length;

        // 3. PROGRESS LOGIC
        const currentXP = userData.xp || 0;
        const level = userData.level || 1;
        const xpInCurrentLevel = currentXP % 1000;
        const progressPercent = Math.floor((xpInCurrentLevel / 1000) * 100);
        
        // 4. INTELLIGENT SYSTEM MESSAGES
        let systemStatus = "🟢 STABLE";
        let engineNote = "Système nominal.";
        
        if (level >= 5) { systemStatus = "🟡 ACTIVATED"; engineNote = "Capacité de traitement augmentée."; }
        if (level >= 15) { systemStatus = "🟠 OVERCLOCKED"; engineNote = "Flux de données haute performance."; }
        if (level >= 30) { systemStatus = "🔥 ELITE CORE"; engineNote = "Niveau de synchronisation légendaire."; }

        // 5. DYNAMIC PROGRESS BAR
        const filledBlocks = Math.floor(progressPercent / 10);
        const progressBar = "🟦".repeat(filledBlocks) + "⬛".repeat(10 - filledBlocks);

        // 6. BUILD THE DIAGNOSTICS EMBED
        const statsEmbed = new EmbedBuilder()
            .setColor(level > 15 ? '#ff9900' : '#00ffcc')
            .setTitle(`🛰️ DIAGNOSTICS: ${target.username.toUpperCase()}`)
            .setThumbnail(target.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: '🆔 Node ID', value: `\`${userData.name || target.username}\``, inline: true },
                { name: '📊 Rank', value: `\`#${rank} / ${totalAgents}\``, inline: true },
                { name: '🔌 Status', value: `\`${systemStatus}\``, inline: true },
                { name: '🎮 Gaming Sector', value: `**${userData.gaming?.game || "Unknown"}** | \`${userData.gaming?.rank || "Unranked"}\``, inline: false },
                { name: '⚡ Synchronization', value: `${progressBar} **${progressPercent}%**\n*Requis: ${1000 - xpInCurrentLevel} XP pour le niveau ${level + 1}*` }
            )
            .setDescription(`> *"${engineNote}"*`)
            .setFooter({ text: `Bamako Node 🇲🇱 | v${client.version}`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();

        message.reply({ embeds: [statsEmbed] });
    }
};
