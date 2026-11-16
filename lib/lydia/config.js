'use strict';
// Settings, the console colours, the answer's look, and the Premium/model lookups shared by the other parts.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.

let _isPremium = null;
function isPremium(db, guildId) {
  try {
    if (!_isPremium) _isPremium = require('../../plugins/premium').isPremium;
    return _isPremium(db, guildId);
  } catch { return false; }
}

function getGuildModel(database, guildId) {
  try {
    if (!database || !guildId) return null;
    const row = database.prepare('SELECT lydia_model FROM server_settings WHERE guild_id = ?').get(String(guildId));
    return row?.lydia_model || null;
  } catch { return null; }
}

const CFG = {
  COOLDOWN_TIME: 3000,
  MAX_HISTORY: 8,
  MAX_MEMORY_PER_USER: 25,
  CHANNEL_COOLDOWN: 1500,
  MAX_TOKENS: 1500,   // thinking models count their reasoning in this budget too: 700 left a few words for the answer
  RESPONSE_TIMEOUT: 15000,
  MAX_REPLY_CHARS: 3600,     // a Components V2 message holds 4000 characters of text in total
  FREE_DAILY_LIMIT: 30,      // messages per member per day on servers without Premium (protects the OpenRouter bill)
  FREE_SERVER_DAILY: 200,    // messages per server per day without Premium, all members together
  FREE_CHANNELS: 2,          // channels where she answers without Premium (the oldest switched on)
};

const C = {
  green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m',
  cyan: '\x1b[36m', magenta: '\x1b[35m', blue: '\x1b[34m', reset: '\x1b[0m'
};

// One look for every answer: ARCHON's gold, red only for real errors
const THEMES = { default: { name: 'Archon', emoji: '\u2728' } };
const detectTheme = () => THEMES.default;

module.exports = { _isPremium, isPremium, getGuildModel, CFG, C, THEMES, detectTheme };
