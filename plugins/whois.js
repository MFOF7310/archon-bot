const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['scan', 'user', 'dossier'],
    description: 'Execute a deep-scan on a specific agent and decrypt their metadata.',
    category: 'UTILITY',
    run: async (client, message, args, database) => {
        const member = message.mentions.members.first() || message.member;
        const { user } = member;
        
        // 1. DATA SYNCHRONIZATION
        const userData = database[user.id] || { xp: 0, level: 1, gaming: null };
        const gameData = userData.gaming;

        // 2. CLEARANCE LEVEL (Permissions)
        let clearance = "🔹 AGENT";
        if (member.permissions.has('Administrator')) clearance = "🔴 ADMINISTRATOR";
        else if (member.permissions.has('ManageMessages')) clearance = "🟡 MODERATOR";
        if (user.id === process.env.OWNER_ID) clearance = "👑 ARCHITECT-01";

        // 3. ROLE FILTERING
        const roles = member.roles.cache
            .filter(r => r.id !== message.guild.id)
            .sort((a, b) => b.position - a.position)
            .map(r => r.name)
            .join(', ') || 'No active authorizations.';

        // 4. THE ARCHITECT DOSSIER EMBED
        const whoisEmbed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#00fbff')
            .setAuthor({ 
                name: `NEURAL SCAN: ${user.username.toUpperCase()}`, 
                iconURL: user.displayAvatarURL({ dynamic: true }) 
            })
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .setDescription(`**Node Identification:** \`${user.id}\`\n**Clearance:** \`${clearance}\``)
            .addFields(
                { 
                    name: '📊 SYNC TELEMETRY', 
                    value: `\`\`\`ansi\n\u001b[1;36m▣\u001b[0m Level: ${userData.level}\n\u001b[1;34m▣\u001b[0m XP:    ${(userData.xp || 0).toLocaleString()}\`\`\``, 
                    inline: true 
                },
                { 
                    name: '📅 TEMPORAL LOGS', 
                    value: `**Arrival:** <t:${Math.floor(member.joinedTimestamp / 1000)}:f>\n**Account:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`, 
                    inline: true 
                }
            );

        // --- NEW: COMBAT MATRIX BLOCK ---
        if (gameData && gameData.game) {
            whoisEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `\`\`\`ansi\n\u001b[1;36mSECTOR:\u001b[0m ${gameData.game}\n\u001b[1;35mMODE:  \u001b[0m ${gameData.mode || 'N/A'}\n\u001b[1;33mRANK:  \u001b[0m ${gameData.rank || 'UNRANKED'}\`\`\``, 
                inline: false 
            });
        } else {
            whoisEmbed.addFields({ 
                name: '🎮 COMBAT MATRIX', 
                value: `\`\`\`fix\nSTATUS: NO_DATA_DETECTED\nUse .setgame to register your specialization.\`\`\``, 
                inline: false 
            });
        }

        whoisEmbed.addFields({ 
            name: '📜 AUTHORIZATIONS (ROLES)', 
            value: `\`\`\`fix\n${roles.length > 100 ? roles.substring(0, 100) + '...' : roles}\`\`\``, 
            inline: false 
        })
        .setFooter({ text: 'EAGLE COMMUNITY • DIGITAL SOVEREIGNTY • BKO-223' })
        .setTimestamp();

        // OWNER ONLY TECH-DATA
        if (message.author.id === process.env.OWNER_ID) {
            whoisEmbed.addFields({ 
                name: '🛠️ OWNER TELEMETRY', 
                value: `**Flags:** \`${user.flags?.toArray().join(', ') || 'None'}\` | **Bot:** \`${user.bot ? 'YES' : 'NO'}\`` 
            });
        }

        message.reply({ 
            content: `> **Initializing neural handshake... scanning ${user.username}.**`,
            embeds: [whoisEmbed] 
        });
    }
};
