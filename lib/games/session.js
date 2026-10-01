// ═══════════════════════════════════════════════════════════════════════════
// GAME SESSIONS — locks that always release, and the private answer box
// ═══════════════════════════════════════════════════════════════════════════
const ui = require('./ui');

// One lock per key (a player, or a channel for race games). The TTL frees it even if a game crashes.
const locks = new Map();
function lock(key, ttlMs = 15 * 60 * 1000) {
  if (locks.has(key)) return null;
  const timer = setTimeout(() => locks.delete(key), ttlMs);
  timer.unref?.();
  const release = () => { clearTimeout(timer); locks.delete(key); };
  locks.set(key, release);
  return release;
}
const isLocked = (key) => locks.has(key);

// Opens the private answer box from a button and waits for the reply.
// Resolves { sub, value } or null if the player closes it or waits too long.
async function askText(buttonInteraction, { lang, id, title, waitMs, userId, maxLength = 40 }) {
  const modalId = `${id}_${buttonInteraction.id}`;
  await buttonInteraction.showModal(ui.answerModal(lang, modalId, title, maxLength));
  const who = userId || buttonInteraction.user.id;
  const sub = await buttonInteraction.awaitModalSubmit({ time: waitMs, filter: (m) => m.customId === modalId && m.user.id === who }).catch(() => null);
  return sub ? { sub, value: sub.fields.getTextInputValue('answer') } : null;
}

module.exports = { lock, isLocked, askText };
