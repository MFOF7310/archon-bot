const updater = require('../lib/updater');
const EMOJIS = require('../config/emojis');

// Texts: lang/{en,fr,zh,ar}/update.json

module.exports = {
    name: 'update',
    description: 'Update the bot to the newest version from GitHub.',
    category: 'OWNER',
    usage: '.update',
    cooldown: 5000,
    examples: ['.update'],

    run: async (client, message, args, database, serverSettings, usedCommand, lang) => {
        const L = lang || 'en';
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply(updater.tx('ownerOnly', L));
        }

        const status = await message.reply(EMOJIS.loading + ' ' + updater.tx('checking', L));

        let result;
        try {
            result = await updater.applyUpdate(client);
        } catch (e) {
            console.error('[UPDATE]', e);
            result = { status: 'error', why: String(e.message || e).split('\n')[0].slice(0, 200) };
        }
        await status.edit({ content: null, embeds: [updater.resultEmbed(result, L)] });
    }
};
