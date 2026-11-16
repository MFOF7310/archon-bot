'use strict';
// Web search (Brave) for questions about recent things.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
let axios = null;
try { axios = require('axios'); } catch { /* AI and web features degraded */ }
const { C } = require('./config');

// ═══════════════════════════════════════════════════════════════════════════════
// WEB SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

async function webSearch(query, keyOverride = null) {
  const apiKey = keyOverride || process.env.BRAVE_API_KEY;
  if (!apiKey || !axios) return null;
  try {
    const res = await axios.get('https://api.search.brave.com/res/v1/web/search', {
      headers: {
        'X-Subscription-Token': apiKey,
        'Accept': 'application/json'
      },
      params: { q: query, count: 5, text_decorations: false, safesearch: 'strict' },
      timeout: 10000
    });
    if (!res.data?.web?.results?.length) return null;
    const results = res.data.web.results.slice(0, 5);
    const formatted = results.map((r, i) => `${i + 1}. [${r.title}](${r.url})\n   ${r.description}`).join('\n');
    const sources = results.map(r => ({ title: r.title, url: r.url }));
    return { formatted, sources };
  } catch (e) {
    console.log(`${C.yellow}[SEARCH FAIL]${C.reset} ${e.message?.substring(0, 60)}`);
    return null;
  }
}

module.exports = { webSearch };
