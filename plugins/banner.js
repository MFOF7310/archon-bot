// .banner [@user] — someone's profile banner in full size (lib/info-cards.js)
const info = require('../lib/info-cards');
module.exports = {
    name: 'banner', aliases: ['banniere'],
    description: 'Your or someone’s profile banner', category: 'UTILITY', cooldown: 3000,
    usage: '.banner [@user]', examples: ['.banner', '.banner @user'],
    run: async (client, message) => {
        const lang = info.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await info.banner(client, message.mentions.users.first() || message.author, lang, message)).catch(() => {});
    },
};
