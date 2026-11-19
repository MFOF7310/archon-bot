// .membercount — the server's members: total, humans and bots, online, boosts, roles (lib/info-cards.js)
const info = require('../lib/info-cards');
module.exports = {
    name: 'membercount', aliases: ['mc', 'members', 'membres', 'statsmembres'],
    description: 'The server’s members: total, humans, bots, online', category: 'UTILITY', cooldown: 3000,
    usage: '.membercount', examples: ['.membercount', '.mc'],
    run: async (client, message) => {
        if (!message.guild) return;
        const lang = info.langOf(client, message.guild.id, message, message.author.id);
        return message.reply(await info.memberCount(message.guild, lang, message)).catch(() => {});
    },
};
