'use strict';
// Which language a member wrote in, and the names of the languages Lydia answers in.
// Part of Lydia (plugins/lydia.js), moved here as is: the code below is unchanged.
const { t } = require('../i18n');

// ═══════════════════════════════════════════════════════════════════════════════
// UNIVERSAL LANGUAGE DETECTOR
// ═══════════════════════════════════════════════════════════════════════════════

// Which language the member wrote in. Returns null when the message gives no clear signal (an emoji, a name,
// "ok"), so the caller falls back to the member's /mylang or the server language. It used to answer English
// messages in Spanish as soon as they contained "no" or "son", and in French for any accented name ("Pokémon").
const LANG_WORDS = {
  fr: /\b(je|tu|il|elle|nous|vous|ils|est|sont|suis|c'est|j'ai|t'es|les|des|une|du|au|aux|pour|avec|dans|sur|pas|mais|oui|non|merci|bonjour|salut|comment|quoi|pourquoi|quand|parce|donc|alors|aussi|encore|toujours|jamais|rien|tout|très|bien|faire|peux|veux|stp|svp|frère|wesh)\b/g,
  en: /\b(i|you|he|she|we|they|is|are|am|was|were|the|and|but|what|why|how|when|where|who|can|could|would|should|please|thanks|thank|hello|hey|this|that|have|has|do|does|don't|it's|i'm|my|your|with|for|about)\b/g,
  es: /\b(yo|tú|usted|nosotros|ellos|está|estás|estoy|eres|soy|hola|gracias|qué|cómo|dónde|cuándo|porque|también|siempre|nunca|pero|muy|quiero|puedes|necesito|ayuda)\b/g,
};
function detectUserLanguage(text) {
  const t = String(text || '').toLowerCase().replace(/<[@#&!:a-z0-9_]+>/g, ' ').trim();
  if (!t) return null;
  if (/[\u0600-\u06FF]/.test(t)) return 'ar';
  if (/[\u3040-\u30FF]/.test(t)) return 'ja';
  if (/[\u4E00-\u9FFF]/.test(t)) return 'zh';
  const score = {};
  for (const [l, re] of Object.entries(LANG_WORDS)) score[l] = (t.match(re) || []).length;
  if (/[àâçèêëîïôûùœ]/.test(t)) score.fr += 1;
  if (/[ñ¿¡]/.test(t)) score.es += 2;
  const best = Object.entries(score).sort((x, y) => y[1] - x[1]);
  if (!best[0][1] || best[0][1] === best[1][1]) return null;
  return best[0][0];
}

const LANG_NAMES = {
  en: 'English', fr: 'French', es: 'Spanish', ar: 'Arabic',
  zh: 'Chinese', ja: 'Japanese', de: 'German', pt: 'Portuguese',
  ru: 'Russian', hi: 'Hindi', tr: 'Turkish', ko: 'Korean',
  it: 'Italian', nl: 'Dutch', pl: 'Polish', sv: 'Swedish',
  da: 'Danish', no: 'Norwegian', fi: 'Finnish', el: 'Greek',
  he: 'Hebrew', th: 'Thai', vi: 'Vietnamese', id: 'Indonesian',
  ms: 'Malay', tl: 'Tagalog', sw: 'Swahili', bn: 'Bengali',
};

module.exports = { LANG_WORDS, detectUserLanguage, LANG_NAMES };
