const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['level', 'rank', 'st'],
    description: 'Display detailed agent statistics and global rank.',
    category: 'PROFILE',
    run: async (client, message, args, database) => {
        let target = message.mentions.users.first();
        
        if (!target && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                target = repliedMsg.author;
            } catch {
                return message.reply("❌ **ERROR:** Failed to intercept signal from replied user.");
            }
        }
        if (!target) target = message.author;

        const userData = database[target.id];
        if (!userData) {
            return message.reply(`⚠️ **DATA NULL:** No intelligence found for \`${target.username}\`. Direct them to initiate communication.`);
        }

        // --- CALCULATION LOGIC ---
        const sortedUsers = Object.entries(database).sort(([, a], [, b]) => b.xp - a.xp);
        const globalRank = sortedUsers.findIndex(([id]) => id === target.id) + 1;
        
        // Progress Bar Logic (1000 XP per level)
        const xpInLevel = userData.xp % 1000;
        const progressPercent = Math.floor((xpInLevel / 1000) * 100);
        const createBar = (percent) => {
            const size = 12;
            const progress = Math.round((size * percent) / 100);
            return '▰'.repeat(progress) + '▱'.repeat(size - progress);
        };

        // Dynamic Tier Logic
        let tierColor = '#00fbff';
        let tierLabel = 'RECRUIT';
        if (userData.level >= 10) { tierColor = '#f1c40f'; tierLabel = 'ELITE AGENT'; }
        if (userData.level >= 50) { tierColor = '#e74c3c'; tierLabel = 'COMMANDER'; }

        const statsEmbed = new EmbedBuilder()
            .setColor(tierColor)
            .setAuthor({ 
                name: `AGENT DOSSIER: ${target.username.toUpperCase()}`, 
                iconURL: target.displayAvatarURL({ dynamic: true }) 
            })
            .setTitle('─ ARCHITECT NEURAL PROFILE ─')
            .setDescription(`**Classification:** \`${tierLabel}\`\n**Current Node:** \`Bamako-223\``)
            .addFields(
                { 
                    name: '📊 GLOBAL HIERARCHY', 
                    value: `\`\`\`ansi\n\u001b[1;36mRank:\u001b[0m #${globalRank} / ${sortedUsers.length}\n\u001b[1;36mLevel:\u001b[0m ${userData.level}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '🌀 NEURAL SYNC (XP PROGRESS)', 
                    value: `\`${createBar(progressPercent)}\` **${progressPercent}%**\n*\`${xpInLevel} / 1000 XP until synchronization upgrade*\``, 
                    inline: false 
                },
                { 
                    name: '🎮 COMBAT INTEL', 
                    value: `\`\`\`prolog\nPrimary: ${userData.gaming?.game || 'N/A'}\nSkill_Tier: ${userData.gaming?.rank || 'Unranked'}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '🛡️ CORE STATUS', 
                    value: `\`\`\`prolog\nIdentity: VERIFIED\nAccess: LEVEL_${userData.level >= 10 ? 'ALPHA' : 'BETA'}\`\`\``, 
                    inline: true 
                }
            )
            .setFooter({ 
                text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY', 
                iconURL: client.user.displayAvatarURL() 
            })
            .setTimestamp();

        message.reply({ 
            content: `> **Accessing encrypted profile for ${target.username}...**`,
            embeds: [statsEmbed] 
        });
    }
};
