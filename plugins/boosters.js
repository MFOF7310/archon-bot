// .boosters — who boosts the server, since when, and how far the next level is (lib/info-cards.js)
const info = require('../lib/info-cards');
module.exports = {
    name: 'boosters', aliases: ['boosts', 'boost'],
    description: 'Who boosts the server and since when', category: 'UTILITY', cooldown: 3000,
    usage: '.boosters', examples: ['.boosters', '.boosts'],
    run: async (client, message) => {
        if (!message.guild) return;
        const lang = info.langOf(client, message.guild.id, message, message.author.id);
        return message.reply(await info.boosters(message.guild, lang, message)).catch(() => {});
    },
};
