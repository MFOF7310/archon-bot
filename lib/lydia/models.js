'use strict';
// Which AI model answers: Premium model first on Premium servers, then the cheaper models one after another.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { t } = require('../i18n');
let axios = null;
try { axios = require('axios'); } catch { /* AI and web features degraded */ }
const { isPremium, getGuildModel, CFG, C, THEMES } = require('./config');

// ═══════════════════════════════════════════════════════════════════════════════
// MODEL POOL (Parallel racing)
// ═══════════════════════════════════════════════════════════════════════════════

const MODEL_POOL = [
  { id: 'anthropic/claude-sonnet-5.5',              emoji: '🤖', name: 'Claude Sonnet 5.5', tier: 'premium' },
  { id: 'openai/gpt-4o',                            emoji: '🔵', name: 'GPT-4o', tier: 'premium' },
  { id: 'anthropic/claude-haiku-5.5',               emoji: '🤖', name: 'Claude Haiku 5.5', tier: 'fast' },
  { id: 'openai/gpt-4o-mini',                       emoji: '💙', name: 'GPT-4o mini', tier: 'fast' },
  { id: 'google/gemini-2.5-flash',                  emoji: '🎋', name: 'Gemini 2.5 Flash', tier: 'fast' },
  { id: 'deepseek/deepseek-chat-v3-0324',           emoji: '🔷', name: 'DeepSeek V3', tier: 'fast' },
  { id: 'meta-llama/llama-3.3-70b-instruct',        emoji: '🧠', name: 'Llama 3.3 70B', tier: 'fast' },
  { id: 'qwen/qwen-2.5-72b-instruct',               emoji: '🟡', name: 'Qwen 2.5 72B', tier: 'fast' },
  { id: 'mistralai/mistral-large-4-0',             emoji: '✨', name: 'Mistral Large 4', tier: 'reliable' },
];

const PREMIUM_MODEL = {
  id: 'anthropic/claude-sonnet-5.5',
  emoji: '🤖',
  name: 'Claude Sonnet 5.5',
  tier: 'premium'
};

// A model that just failed is skipped for a while instead of costing every message 15 s again:
// 5 minutes after a timeout or a busy answer, 6 hours when OpenRouter says the model doesn't exist.
const benched = new Map();
const VISION = new Set(['anthropic/claude-sonnet-5.5', 'anthropic/claude-haiku-5.5', 'openai/gpt-4o', 'openai/gpt-4o-mini', 'google/gemini-2.5-flash']);
const TOTAL_BUDGET = 30000;
function bench(model, status) {
  const long = status === 400 || status === 404;
  benched.set(model.id, Date.now() + (long ? 6 * 3600000 : 300000));
}
const isBenched = (m) => (benched.get(m.id) || 0) > Date.now();

// A cut answer (finish_reason "length") ends at its last full sentence with "…", never in the middle of a word
function endCleanly(text) {
  const t = String(text).trimEnd();
  const stop = Math.max(t.lastIndexOf('. '), t.lastIndexOf('.\n'), t.lastIndexOf('! '), t.lastIndexOf('? '), t.lastIndexOf('\n\n'));
  let out = stop > t.length * 0.5 ? t.slice(0, stop + 1) : t;
  if ((out.match(/\*\*/g) || []).length % 2) out += '**';   // close a bold cut in the middle
  if ((out.match(/```/g) || []).length % 2) out += '\n```';
  return `${out.trimEnd()} …`;
}

async function tryModel(model, messages, timeoutMs, keyOverride = null, maxTokens = CFG.MAX_TOKENS) {
  const apiKey = keyOverride || process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  return new Promise(async (resolve) => {
    const timer = setTimeout(() => {
      console.log(`${C.yellow}[TIMEOUT]${C.reset} ${model.id}`);
      bench(model, 'timeout');
      resolve(null);
    }, timeoutMs);

    try {
      const startTime = Date.now();
      const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model.id,
        messages,
        temperature: 0.65,
        max_tokens: maxTokens,
        top_p: 0.9,
        reasoning: { exclude: true }   // a thinking model's reasoning is never sent back to us (it still counts in max_tokens)
      }, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://github.com/MFOF7310',
          'X-Title': 'Architect-CG-223',
          'Content-Type': 'application/json'
        },
        timeout: timeoutMs
      });

      clearTimeout(timer);
      const latency = Date.now() - startTime;
      const choice = response.data?.choices?.[0];
      let content = choice?.message?.content;
      const cut = choice?.finish_reason === 'length';
      const thought = response.data?.usage?.completion_tokens_details?.reasoning_tokens || 0;
      if (cut) {
        console.log(`${C.yellow}[AI CUT]${C.reset} ${model.id} | budget ${maxTokens} | reasoning ${thought} | answer ${String(content || '').length} chars`);
        // once, with twice the room: the answer is worth the wait more than half a sentence
        if (maxTokens < CFG.MAX_TOKENS * 2) {
          clearTimeout(timer);
          return resolve(await tryModel(model, messages, timeoutMs, keyOverride, CFG.MAX_TOKENS * 2));
        }
        if (content) content = endCleanly(content);
      }

      if (content && content.trim().length > 0) {
        const approxTokens = Math.ceil(content.length / 4);
        resolve({ content: content.trim(), model, latency, tokens: approxTokens });
      } else {
        resolve(null);
      }
    } catch (e) {
      clearTimeout(timer);
      const status = e.response?.status || 'NET';
      const errMsg = e.response?.data?.error?.message || e.message || 'unknown';
      // A bad key (401/402) is not the model's fault: the next model would fail the same way
      if (status !== 401 && status !== 402) bench(model, status);
      console.log(`${C.yellow}[AI RETRY]${C.reset} ${model.id} | HTTP ${status} | ${errMsg.substring(0, 80)}`);
      resolve(null);
    }
  });
}

async function generateAIResponse(systemPrompt, userMessage, history = [], imageUrl = null, theme = THEMES.default, guildId = null) {
  const messages = [{ role: 'system', content: systemPrompt }];

  if (Array.isArray(history) && history.length > 0) {
    messages.push({
      role: 'system',
      content: `[CONVERSATION HISTORY \u2014 Contextual reference only. Respond to the LATEST message]`
    });
    messages.push(...history.slice(-CFG.MAX_HISTORY).map(h => ({ role: h.role, content: h.content })));
  }

  if (imageUrl) {
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userMessage },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    });
  } else {
    messages.push({ role: 'user', content: userMessage });
  }

  // Premium servers may bring their own OpenRouter key — else global .env
  const guildKey = null;   // ARCHON's own OpenRouter key (.env); per-server keys were removed

  // Premium servers get Claude Sonnet directly
  const isPremiumGuild = guildId ? isPremium(global.client?.db || null, guildId) : false;

  if (isPremiumGuild) {
    const guildModel = getGuildModel(global.client?.db || null, guildId);
    if (guildModel && guildModel !== 'auto') {
      const chosenModel = MODEL_POOL.find(m => m.id === guildModel);
      if (chosenModel) {
        console.log(`${C.cyan}[AI PREMIUM]${C.reset} Guild model: ${chosenModel.emoji} ${chosenModel.name}...`);
        const result = await tryModel(chosenModel, messages, CFG.RESPONSE_TIMEOUT, guildKey);
        if (result) return result;
        console.log(`${C.yellow}[AI PREMIUM]${C.reset} Guild model failed, falling back to ${PREMIUM_MODEL.name}...`);
      }
    } else {
      console.log(`${C.cyan}[AI PREMIUM]${C.reset} Routing to ${PREMIUM_MODEL.emoji} ${PREMIUM_MODEL.name}...`);
    }
    const result = await tryModel(PREMIUM_MODEL, messages, CFG.RESPONSE_TIMEOUT, guildKey);
    if (result) return result;
    console.log(`${C.yellow}[AI PREMIUM]${C.reset} Claude unavailable, falling back to free pool...`);
  }

  // Free pool: the cheaper models, tried one after another. They used to race 3 at a time (Claude Sonnet and GPT-4o
  // included) and every message paid for all three, even though only one answer was kept.
  let pool = MODEL_POOL.filter(m => m.tier !== 'premium' && (!imageUrl || VISION.has(m.id)));
  const fresh = pool.filter(m => !isBenched(m));
  if (fresh.length) pool = fresh;   // all benched: try them anyway rather than give up
  let winner = null;
  const tried = [];
  const started = Date.now();
  for (const model of pool) {
    const left = TOTAL_BUDGET - (Date.now() - started);
    if (left < 3000) break;
    tried.push(model.name);
    const result = await tryModel(model, messages, Math.min(CFG.RESPONSE_TIMEOUT, left), guildKey);
    if (result) { winner = result; winner.attempted = tried.join(' \u2192 '); break; }
  }

  if (!winner) {
    console.log(`${C.red}[AI]${C.reset} All models failed. Check API key and network.`);
    return null;
  }

  console.log(`${C.green}[AI OK]${C.reset} ${winner.model.name} | ~${winner.tokens}tk | ${winner.latency}ms | via: ${winner.attempted}`);
  return winner;
}

module.exports = { MODEL_POOL, PREMIUM_MODEL, benched, VISION, TOTAL_BUDGET, bench, isBenched, endCleanly, tryModel, generateAIResponse };
