const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'stats',
    aliases: ['st', 'stat'],
    description: 'Display detailed agent statistics and global rank.',
    category: 'PROFILE',
    run: async (client, message, args, userData) => {
        let target = message.mentions.users.first();
        
        // 1. INTELLIGENT SIGNAL INTERCEPTION (Reply detection)
        if (!target && message.reference) {
            try {
                const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
                target = repliedMsg.author;
            } catch {
                // Silent fallback if fetch fails
            }
        }
        if (!target) target = message.author;

        // 2. DATA SYNCHRONIZATION
        let targetData = userData;
        
        if (target.id !== message.author.id) {
            const { getUser } = require('../index.js');
            targetData = getUser(target.id);
        }
        
        const xp = targetData?.xp || 0;
        const level = targetData?.level || 1;
        const totalMessages = targetData?.totalMessages || 0;

        // 3. CALCULATION HIERARCHY
        const db = require('better-sqlite3')('database.sqlite');
        const allUsers = db.prepare("SELECT * FROM users ORDER BY xp DESC").all();
        db.close();
        
        const globalRank = allUsers.findIndex(user => user.id === target.id) + 1 || 'PENDING';
        
        const xpInLevel = xp % 1000;
        const progressPercent = Math.floor((xpInLevel / 1000) * 100);
        
        const createBar = (percent) => {
            const size = 12;
            const progress = Math.round((size * percent) / 100);
            return '▰'.repeat(progress) + '▱'.repeat(size - progress);
        };

        // 4. DYNAMIC TIER LOGIC
        let tierColor = '#00fbff';
        let tierLabel = 'RECRUIT';
        let accessLevel = 'BETA';

        if (level >= 10) { 
            tierColor = '#f1c40f'; 
            tierLabel = 'ELITE AGENT'; 
            accessLevel = 'ALPHA';
        }
        if (level >= 50) { 
            tierColor = '#e74c3c'; 
            tierLabel = 'COMMANDER'; 
            accessLevel = 'OMEGA';
        }

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
                    value: `\`\`\`ansi\n\u001b[1;36mRank:\u001b[0m #${globalRank} / ${allUsers.length}\n\u001b[1;36mLevel:\u001b[0m ${level}\n\u001b[1;33mMessages:\u001b[0m ${totalMessages.toLocaleString()}\`\`\``, 
                    inline: false 
                },
                { 
                    name: '🌀 NEURAL SYNC (XP PROGRESS)', 
                    value: `\`${createBar(progressPercent)}\` **${progressPercent}%**\n*\`${xpInLevel} / 1000 XP until next sync upgrade*\``, 
                    inline: false 
                }
            );

        statsEmbed.addFields({ 
            name: '🛡️ CORE STATUS', 
            value: `\`\`\`prolog\nIdentity: VERIFIED\nAccess: LVL_${accessLevel}\nXP_Total: ${xp.toLocaleString()}\`\`\``, 
            inline: true 
        })
        .setFooter({ 
            text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223', 
            iconURL: client.user.displayAvatarURL() 
        })
        .setTimestamp();

        message.reply({ 
            content: `> **Deciphering neural signature for ${target.username}...**`,
            embeds: [statsEmbed] 
        });
    }
};