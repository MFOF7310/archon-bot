// .roleinfo <role> — a role's members, position, colour, settings and key permissions (lib/info-cards.js)
const info = require('../lib/info-cards');
module.exports = {
    name: 'roleinfo', aliases: ['ri', 'infosrole', 'role-info'],
    description: 'Details of a role', category: 'UTILITY', cooldown: 3000,
    usage: '.roleinfo <@role | ID | name>', examples: ['.roleinfo @Moderator', '.roleinfo Verified'],
    run: async (client, message, args) => {
        if (!message.guild) return;
        const lang = info.langOf(client, message.guild.id, message, message.author.id);
        const q = args.join(' ').trim().toLowerCase();
        const roles = message.guild.roles.cache;
        const role = message.mentions.roles.first() || roles.get(args[0]) || roles.find((r) => r.name.toLowerCase() === q) || (q ? roles.find((r) => r.name.toLowerCase().includes(q)) : null);
        if (!role) return message.reply(info.T(lang, 'noRole')).catch(() => {});
        return message.reply(await info.roleInfo(message.guild, role, lang, message)).catch(() => {});
    },
};
