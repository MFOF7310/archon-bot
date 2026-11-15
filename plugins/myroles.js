// plugins/myroles.js — .myroles [@member]: the reward roles card (lib/rewards-card), also behind /profile → Rewards.
// Prefix only (no slash command). The old "agent dossier" read "Tier: …" roles that almost no server had.
const { pickLang } = require('../lib/pick-lang');

module.exports = {
    name: 'myroles',
    category: 'PROFILE',
    aliases: ['botroles', 'tiers', 'rankroles', 'badges', 'honors', 'rewards', 'recompenses'],
    description: 'Your reward roles on this server: the ones you have and how to get the others',
    usage: '.myroles [@member]',
    async run(client, message) {
        if (!message.guild) return;
        const lang = pickLang(client, message.guild.id, message, message.author.id);
        const member = message.mentions.members?.first() || message.member;
        const RR = require('../lib/reward-roles');
        await RR.syncLevelRoles(member, RR.levelOf(client.db, member.id, message.guild.id), client.db).catch(() => {});
        const view = require('../lib/rewards-card').build(client, message.guild, member, ['en', 'fr', 'zh', 'ar'].includes(lang) ? lang : 'en',
            require('../lib/access').can(message.member, 'roles').ok);
        return message.reply(view).catch(() => {});
    },
};
