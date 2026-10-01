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

// One way to post and edit a game message, whether it started from a slash command or a prefix message.
// Button handlers call ctx.ack(i) first; later edits (timers included) go through the freshest token.
function context(source, lang) {
  const isSlash = typeof source.isChatInputCommand === 'function' || Boolean(source.commandName);
  const started = Date.now();
  const ctx = {
    isSlash, lang,
    user: isSlash ? source.user : source.author,
    client: source.client, guild: source.guild, channel: source.channel, member: source.member,
    guildId: source.guildId ?? source.guild?.id ?? null,
    message: null, last: null, lastAt: 0,
    async post(opts) {
      if (isSlash) {
        if (source.deferred || source.replied) await source.editReply(opts); else await source.reply(opts);
        ctx.message = await source.fetchReply();
      } else {
        ctx.message = await source.reply(opts);
      }
      return ctx.message;
    },
    async ack(i) {
      await i.deferUpdate().catch(() => {});
      ctx.last = i; ctx.lastAt = Date.now();
    },
    async edit(opts) {
      const fresh = (t) => Date.now() - t < 14 * 60 * 1000; // interaction tokens last 15 minutes
      if (ctx.last && fresh(ctx.lastAt)) return ctx.last.editReply(opts);
      if (!isSlash && ctx.message) return ctx.message.edit(opts);
      if (isSlash && fresh(started)) return source.editReply(opts);
      return ctx.message?.edit(opts);
    },
  };
  return ctx;
}

module.exports = { lock, isLocked, askText, context };
