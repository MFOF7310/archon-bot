const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'whois',
    aliases: ['scan', 'userinfo'],
    category: 'General',
    async execute(message, args, client, model, lydiaChannels, database) {
        // 1. Target Selection (Mention > Reply > Self)
        let member = message.mentions.members.first();
        if (!member && message.reference) {
            const repliedMsg = await message.channel.messages.fetch(message.reference.messageId);
            member = await message.guild.members.fetch(repliedMsg.author.id);
        }
        if (!member) member = message.member;

        const user = member.user;

        // 2. Fetch Badges (Public Flags)
        const userFlags = user.flags.toArray();
        const badgeMap = {
            BugHunterLevel1: '🐛 Bug Hunter Lvl 1',
            BugHunterLevel2: '🐛 Bug Hunter Lvl 2',
            HypeSquadOnlineHouse1: '🏠 Bravery',
            HypeSquadOnlineHouse2: '🏠 Brilliance',
            HypeSquadOnlineHouse3: '🏠 Balance',
            PremiumEarlySupporter: '💎 Early Supporter',
            VerifiedDeveloper: '🛠️ Early Dev',
            ActiveDeveloper: '🌟 Active Dev',
            Staff: '👷 Discord Staff',
            Partner: '🤝 Partnered Server Owner'
        };
        const badges = userFlags.map(f => badgeMap[f]).join(' | ') || 'No Public Badges';

        // 3. Get Database Stats
        const userData = database[user.id] || { xp: 0, level: 1 };

        // 4. Presence Logic
        const statusMap = {
            online: '🟢 ONLINE',
            idle: '🌙 IDLE',
            dnd: '🔴 DO NOT DISTURB',
            offline: '⚫ OFFLINE'
        };
        const currentStatus = member.presence ? statusMap[member.presence.status] : '⚫ OFFLINE/HIDDEN';

        // 5. Build the "Intelligence" Embed
        const whoisEmbed = new EmbedBuilder()
            .setColor(member.displayHexColor || '#00fbff')
            .setTitle(`🛰️ AGENT DOSSIER: ${user.username.toUpperCase()}`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 512 }))
            .addFields(
                { name: '👤 Identity', value: `**Tag:** ${user.tag}\n**ID:** \`${user.id}\``, inline: true },
                { name: '📡 Status', value: `\`${currentStatus}\``, inline: true },
                { name: '🎖️ Badges', value: `\`${badges}\``, inline: false },
                { name: '📈 Digital Stats', value: `**Level:** ${userData.level}\n**Total XP:** ${userData.xp.toLocaleString()}`, inline: true },
                { name: '🎮 Gaming Rank', value: `\`${userData.gaming?.rank || 'Unranked'}\``, inline: true },
                { name: '📅 Service Records', value: `**Joined:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>\n**Created:** <t:${Math.floor(user.createdTimestamp / 1000)}:D>`, inline: false }
            )
            .setFooter({ text: 'CLOUD GAMING-223 | DIGITAL ENGINE SCAN' })
            .setTimestamp();

        message.reply({ embeds: [whoisEmbed] });
    },
};
