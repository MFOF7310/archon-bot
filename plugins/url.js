// ═══════════════════════════════════════════════════════════════════════════
// /url <link> — a preview card for a web page: title, description, picture, site, and an Open button.
// Safety: the bot fetches the page from the VPS, so it only goes to public addresses on ports 80/443. Every address
// (and every redirect) is resolved and checked first, and the connection uses the checked address. Before, any link
// was fetched, including the VPS's own internal services (localhost, the bot's API, the cloud metadata address):
// with /url open to everyone as a user app, that let anyone read them.
// Texts: lang/<l>/url.json
// ═══════════════════════════════════════════════════════════════════════════
const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const https = require('https');
const http = require('http');
const dns = require('dns').promises;
const net = require('net');
const { t } = require('../lib/i18n');
const { icon } = require('../lib/ui/icons');
const v2 = require('../lib/games/v2');

const T = (lang, k, v) => t(`url.${k}`, lang, v || {});
const LANGS = ['en', 'fr', 'zh', 'ar'];
const langOf = (client, gid, where, uid) => { try { const l = require('../lib/pick-lang').pickLang(client, gid, where, uid); return LANGS.includes(l) ? l : 'en'; } catch { return 'en'; } };
const clean = (s, n = 300) => String(s || '').replace(/[*_~`|>\\]/g, '').replace(/@(everyone|here)/gi, '@​$1').replace(/\s+/g, ' ').trim().slice(0, n);
const MAX_BYTES = 600 * 1024;

// ─── only public addresses ───
function isPublicIp(ip) {
    if (net.isIPv4(ip)) {
        const [a, b] = ip.split('.').map(Number);
        return !(a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
            || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19))
            || a >= 224);
    }
    if (net.isIPv6(ip)) {
        const x = ip.toLowerCase();
        if (x.startsWith('::ffff:')) return isPublicIp(x.slice(7));
        return !(x === '::' || x === '::1' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9')
            || x.startsWith('fea') || x.startsWith('feb') || x.startsWith('ff') || x.startsWith('64:ff9b') || x.startsWith('2001:db8'));
    }
    return false;
}
async function checkedTarget(raw) {
    let u;
    try { u = new URL(raw); } catch { return { error: 'invalid' }; }
    if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password) return { error: 'invalid' };
    if (u.port && !['80', '443'].includes(u.port)) return { error: 'blocked' };
    const host = u.hostname.replace(/^\[|\]$/g, '');
    if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(host)) return { error: 'blocked' };
    let addrs;
    try { addrs = net.isIP(host) ? [{ address: host, family: net.isIP(host) }] : await dns.lookup(host, { all: true }); }
    catch { return { error: 'unreachable' }; }
    if (!addrs.length || addrs.some((a) => !isPublicIp(a.address))) return { error: 'blocked' };
    return { url: u, address: addrs[0].address, family: addrs[0].family };
}

// One request to the checked address (no second DNS answer can swap it for an internal one)
function getOnce(target) {
    return new Promise((resolve, reject) => {
        const lib = target.url.protocol === 'https:' ? https : http;
        const req = lib.get(target.url, {
            timeout: 10000,
            // Node asks with { all: true } (it tries several addresses since v20): the answer must then be a list.
            // Answering one address made every request fail ("Invalid IP address: undefined").
            lookup: (host, opts, cb) => (opts && opts.all ? cb(null, [{ address: target.address, family: target.family }]) : cb(null, target.address, target.family)),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ARCHON-CG223 link preview; +https://archon223.com)', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
        }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) { res.resume(); return resolve({ redirect: new URL(res.headers.location, target.url).toString() }); }
            if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
            const type = String(res.headers['content-type'] || '');
            if (!type.includes('text/html')) { res.resume(); return resolve({ html: '', type: type.split(';')[0].trim() }); }
            let size = 0; const chunks = [];
            res.on('data', (c) => { size += c.length; chunks.push(c); if (size > MAX_BYTES) { req.destroy(); resolve({ html: Buffer.concat(chunks).toString('utf8'), type: 'text/html' }); } });
            res.on('end', () => resolve({ html: Buffer.concat(chunks).toString('utf8'), type: 'text/html' }));
        });
        req.on('error', reject);
        req.on('timeout', () => req.destroy(new Error('Timeout')));
    });
}
async function fetchPage(raw) {
    let current = raw;
    for (let hop = 0; hop < 5; hop++) {
        const target = await checkedTarget(current);
        if (target.error) return target;
        const r = await getOnce(target);
        if (r.redirect) { current = r.redirect; continue; }
        return { ...r, finalUrl: target.url.toString() };
    }
    return { error: 'unreachable' };
}

// ─── reading the page ───
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
function meta(html, prop) {
    for (const re of [
        new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i'),
        new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i'),
    ]) { const m = html.match(re); if (m && m[1].trim()) return decode(m[1].trim()); }
    return null;
}
function parse(html, base) {
    const title = meta(html, 'og:title') || decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').trim() || null;
    let image = meta(html, 'og:image') || meta(html, 'twitter:image');
    try { if (image) image = new URL(image, base).toString(); } catch { image = null; }
    return {
        title, image: image && /^https:\/\//.test(image) ? image : null,
        description: meta(html, 'og:description') || meta(html, 'description') || meta(html, 'twitter:description'),
        site: meta(html, 'og:site_name'),
    };
}

async function card(lang, link, where) {
    const raw = String(link || '').trim();
    // a site that answers 401/403/429/503 is up but refuses robots (Cloudflare and the like): say so, not "didn't answer"
    const r = /^https?:\/\//i.test(raw) ? await fetchPage(raw).catch((e) => ({ error: /HTTP (401|403|429|503)/.test(e.message) ? 'refused' : 'unreachable', why: e.message })) : { error: 'invalid' };
    if (r.error) {
        if (r.why) console.log(`[URL] ${raw.slice(0, 80)}: ${r.why}`);
        return v2.card(0x888780, [{ text: `${icon('warn', where)} ${T(lang, r.error)}` }]);
    }
    const host = new URL(r.finalUrl).hostname.replace(/^www\./, '');
    const m = r.html ? parse(r.html, r.finalUrl) : { title: null, description: r.type ? T(lang, 'fileType', { type: r.type }) : null };
    const items = [{ text: `-# ${icon('link', where)} ${clean(m.site || host, 80)}\n### ${clean(m.title || host, 200)}${m.description ? `\n${clean(m.description, 350)}` : ''}` }];
    if (m.image) items.push({ media: [m.image, clean(m.title || host, 200)] });
    items.push({ text: `-# ${host}${r.finalUrl.replace(/\/$/, '') !== raw.replace(/\/$/, '') ? ` · ${T(lang, 'redirected')}` : ''}` });
    if (r.finalUrl.length <= 512) items.push({ row: new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(r.finalUrl).setLabel(T(lang, 'open'))) });
    return v2.card(0x378ADD, items);
}

module.exports = {
    name: 'url',
    _getOnce: (t) => getOnce(t),
    userApp: true,   // also works as a user app (DMs, servers without ARCHON): lib/slash-payload.js
    aliases: ['link', 'preview', 'website', 'site', 'urlpreview'],
    description: 'A preview of a web page: title, description, picture',
    category: 'UTILITY',
    cooldown: 5000,
    usage: '.url <link>',
    examples: ['.url https://discord.com', '/url link:https://github.com'],
    isPublicIp,
    data: new SlashCommandBuilder().setName('url').setDescription('A preview of a web page').setDescriptionLocalizations({ fr: 'L’aperçu d’une page web' })
        .addStringOption((o) => o.setName('link').setDescription('The link (https://…)').setRequired(true).setMaxLength(500)),
    run: async (client, message, args) => {
        const lang = langOf(client, message.guild?.id, message, message.author.id);
        return message.reply(await card(lang, args[0], message)).catch(() => {});
    },
    execute: async (interaction, client) => {
        const lang = langOf(client, interaction.guildId, interaction, interaction.user.id);
        await interaction.deferReply();
        return interaction.editReply(await card(lang, interaction.options.getString('link'), interaction));
    },
};
