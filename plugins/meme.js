// plugins/meme.js — /meme: a safe-for-work meme from a curated set of subreddits (lib/fun cards).
// meme-api.com first (it works from servers Reddit blocks), Reddit itself as the fallback.
// Never NSFW or spoilers; only pictures. The old code read meme-api's answer as if it were Reddit's, so it always
// fell through to Reddit, which often refuses servers: memes failed more than they worked.
const { SlashCommandBuilder } = require('discord.js');
const fun = require('../lib/fun');

const SUBS = ['memes', 'wholesomememes', 'me_irl', 'dankmemes', 'ProgrammerHumor', 'Animemes', 'historymemes', 'sciencememes'];
const isPicture = (u) => /\.(jpe?g|png|gif|webp)(\?.*)?$/i.test(String(u || '')) || /i\.redd\.it|i\.imgur\.com/.test(String(u || ''));
const recent = [];   // the last links shown, so "Another" doesn't repeat

async function fromMemeApi() {
    const sub = fun.pick(SUBS);
    const d = await fun.getJSON(`https://meme-api.com/gimme/${sub}/15`, { timeout: 10000 });
    const ok = (d?.memes || []).filter((m) => !m.nsfw && !m.spoiler && isPicture(m.url) && !recent.includes(m.postLink));
    const m = ok.length ? fun.pick(ok) : null;
    return m ? { title: m.title, url: m.url, link: m.postLink, sub: m.subreddit, author: m.author, ups: m.ups } : null;
}
async function fromReddit() {
    const sub = fun.pick(SUBS);
    const d = await fun.getJSON(`https://www.reddit.com/r/${sub}/hot.json?limit=50`, { timeout: 10000 });
    const ok = (d?.data?.children || []).map((c) => c.data).filter((p) => p && !p.over_18 && !p.spoiler && !p.stickied && isPicture(p.url) && (p.ups || 0) >= 25 && !recent.includes(`https://redd.it/${p.id}`));
    const p = ok.length ? fun.pick(ok.slice(0, 25)) : null;
    return p ? { title: p.title, url: p.url, link: `https://redd.it/${p.id}`, sub: p.subreddit, author: p.author, ups: p.ups } : null;
}

async function funMake(client, { guild, user, lang, priv }) {
    const m = await fun.firstOf([fromMemeApi, fromMemeApi, fromReddit], 'meme');
    if (!m) return fun.failCard(lang, 'meme');
    recent.push(m.link); if (recent.length > 40) recent.shift();
    return fun.imageCard(guild, lang, {
        color: 0xE24B4A, title: `😂 ${fun.safe(m.title, 200)}`, image: m.url,
        lines: [`r/${fun.safe(m.sub, 40)} · u/${fun.safe(m.author, 40)} · ▲ ${Number(m.ups || 0).toLocaleString('en-US')}`],
        again: ['meme', user.id], priv, link: [m.link, 'Reddit'],
    });
}

module.exports = {
    name: 'meme',
    aliases: ['memes', 'funny', 'lol'],
    description: 'A safe-for-work meme',
    category: 'FUN',
    cooldown: 4000,
    funMake,
    data: new SlashCommandBuilder().setName('meme').setDescription('A safe-for-work meme from Reddit'),
    run: async (client, message) => {
        const lang = fun.langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await funMake(client, { guild: message.guild, user: message.author, lang })).catch(() => {});
    },
    execute: async (ix, client) => {
        const lang = fun.langOf(client, ix.guildId, ix, ix.user.id);
        await ix.deferReply();
        return ix.editReply(await funMake(client, { guild: ix.guild, user: ix.user, lang }));
    },
};
