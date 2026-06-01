// ═══════════════════════════════════════════
//  TG COMMAND: Translator (NEW)
// ═══════════════════════════════════════════

const https = require('https');
function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const LANGS = {
    en: 'English', fr: 'French', es: 'Spanish', de: 'German', it: 'Italian',
    pt: 'Portuguese', ru: 'Russian', zh: 'Chinese', ja: 'Japanese', ko: 'Korean',
    ar: 'Arabic', hi: 'Hindi', tr: 'Turkish', nl: 'Dutch', pl: 'Polish',
    sw: 'Swahili', bm: 'Bambara',
};

module.exports = {
    name: 'translate',
    description: 'Translate text between languages',
    category: 'Utility',
    usage: '/translate <text> [to] | /translate en:fr Hello',
    aliases: ['tr', 'trans', 'tl'],

    handler: async (ctx) => {
        const args = ctx.args;
        if (args.length < 1) {
            const langs = Object.entries(LANGS).map(([k, v]) => `${k}: ${v}`).join(', ');
            return ctx.replyHTML(
                `🌐 <b>Translator</b>\n\n<code>/translate Hello world fr</code>\n<code>/translate fr:en Bonjour</code>\n\n<b>Languages:</b> <code>${langs}</code>`
            );
        }

        let fromLang = 'auto', toLang = 'en', text = '';
        const first = args[0];
        if (first.includes(':') && first.length <= 7) {
            const parts = first.split(':');
            fromLang = parts[0] || 'auto';
            toLang = parts[1] || 'en';
            text = args.slice(1).join(' ');
        } else if (args.length >= 2 && args[args.length - 1].length === 2) {
            toLang = args[args.length - 1];
            text = args.slice(0, -1).join(' ');
        } else {
            text = args.join(' ');
        }

        if (!text.trim()) return ctx.replyHTML(`❌ Provide text to translate.`);

        await ctx.action('typing');

        try {
            const data = await requestJSON(
                `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${fromLang}|${toLang}`,
                { timeout: 10000 }
            );
            if (!data || data.responseStatus !== 200 || !data.responseData?.translatedText) {
                return ctx.replyHTML(`❌ Translation failed.`);
            }

            const fromName = LANGS[data.responseData.detectedLanguage || fromLang] || fromLang;
            const toName = LANGS[toLang] || toLang;
            await ctx.replyHTML(
                `🌐 <b>Translation</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `<b>${fromName} → ${toName}</b>\n\n` +
                `📝 ${escapeHTML(text.substring(0, 200))}\n\n` +
                `⬇️ ${escapeHTML(data.responseData.translatedText.substring(0, 500))}`
            );
        } catch {
            ctx.replyHTML(`❌ Translation service unavailable.`);
        }
    }
};

function requestJSON(url, opts = {}) {
    return new Promise((resolve, reject) => {
        const lib = url.startsWith('https:') ? https : require('http');
        const req = lib.request(url, { method: 'GET', headers: opts.headers || {}, timeout: opts.timeout || 10000 }, (res) => {
            let d = ''; res.on('data', c => d += c);
            res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(null); } });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
        req.end();
    });
}
