'use strict';
// Keeps secrets out of answers and catches answers that invent things.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { t } = require('../i18n');
const { C } = require('./config');

// ═══════════════════════════════════════════════════════════════════════════════
// CREDENTIAL SCRUBBER
// ═══════════════════════════════════════════════════════════════════════════════

const SECRET_PATTERNS = [
  /[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g,
  /sk-[a-zA-Z0-9]{20,}/gi,
  /Bearer\s+[a-zA-Z0-9_-]{20,}/gi,
  /[MN][A-Za-z\d]{23}\.[\w-]{6}\.[\w-]{27}/g,
  /mfa\.[\w-]{84}/g,
  /process\.env\.[A-Z_]+/gi,
  /__[A-Z_]+__/g,
  /\/home\/[^\s]+/g,
  /\/root\/[^\s]+/g,
  /C:\\\\[^\s]+/g,
  /(mysql|postgres|mongodb):\/\/[^:]+:[^@]+@/gi,
];

function scrubSecrets(text) {
  if (!text) return text;
  let cleaned = text;
  for (const pattern of SECRET_PATTERNS) {
    cleaned = cleaned.replace(pattern, '[REDACTED]');
  }
  cleaned = cleaned.replace(/OPENROUTER_API_KEY|BRAVE_API_KEY|DISCORD_TOKEN|CLIENT_SECRET|MONGO_URI|DATABASE_URL|JWT_SECRET/gi, '[REDACTED]');
  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ANTI-HALLUCINATION VALIDATOR
// ═══════════════════════════════════════════════════════════════════════════════

const HALLUCINATION_PATTERNS = [
  /\b(nano banana|nano agent|self-aware|conscious|sentient|emotion engine|dream mode|hologram|quantum computing)\b/gi,
  /\b(i can see (the |your )?(source code|config|env|environment|token|password|secret))/gi,
  /\b(i have access to (the |your )?(server|database|file system|logs|config))/gi,
  /(\/root\/cloud-gaming|cloud-gaming-223-digital-engine|\/opt\/dashboard)/gi,
];

function validateResponse(response, lang = 'en') {
  if (!response) return { ok: false, cleaned: null, reason: 'empty' };

  let score = 0;
  let reasons = [];

  for (const pattern of HALLUCINATION_PATTERNS) {
    const matches = response.match(pattern);
    if (matches) {
      score += matches.length * 2;
      reasons.push(`Blocked pattern: ${matches[0].substring(0, 30)}`);
    }
  }

  if (/\b(my source code|the source code|source code of|i'm written in|i was built with|my code is|my architecture includes)\b/gi.test(response)) {
    score += 5;
    reasons.push('Source code claim');
  }

  // Talking about .env files or environment variables is normal coding help; only a claim about the bot's own is blocked
  if (/\b(my|archon'?s|the bot'?s) (\.env|environment variables?|config file|api keys?|token)\b/gi.test(response)) {
    score += 5;
    reasons.push('Own config reference');
  }

  const cleaned = scrubSecrets(response);

  if (score >= 3) {
    const fallback = t('lydia.fallback_' + (1 + Math.floor(Math.random() * 3)), lang);
    console.log(`${C.red}[HALLUCINATION BLOCKED]${C.reset} Score: ${score} | ${reasons.join(', ')}`);
    return { ok: false, cleaned: fallback, reason: reasons.join('; ') };
  }

  return { ok: true, cleaned };
}

module.exports = { SECRET_PATTERNS, scrubSecrets, HALLUCINATION_PATTERNS, validateResponse };
