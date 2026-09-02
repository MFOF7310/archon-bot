// ═══════════════════════════════════════════════════════════════════════════
// LYDIA ACTIONS — premium-gated, permission-checked, confirmed settings changes
// Security boundary: the model only *proposes* via a JSON intent; this file decides.
// ═══════════════════════════════════════════════════════════════════════════
const { EmbedBuilder, PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

// Allowlist: setting key → { column, type, validate, label }. Nothing else is touchable.
const ALLOWED = {
  prefix:         { col: 'prefix',           type: 'string', label: 'Command prefix',   validate: v => typeof v === 'string' && v.length >= 1 && v.length <= 5 && !/\s/.test(v) },
  language:       { col: 'language',         type: 'string', label: 'Language',         validate: v => ['auto','en','fr','ar','bm','zh'].includes(v) },
  automod:        { col: 'automod_enabled',  type: 'bool',   label: 'AutoMod' },
  linkFilter:     { col: 'link_filter_enabled', type: 'bool', label: 'Link filter' },
  inviteFilter:   { col: 'invite_filter_enabled', type: 'bool', label: 'Invite filter' },
  welcome:        { col: 'welcome_enabled',  type: 'bool',   label: 'Welcome messages' },
  goodbye:        { col: 'goodbye_enabled',  type: 'bool',   label: 'Goodbye messages' },
  market:         { col: 'market_enabled',   type: 'bool',   label: 'Market' },
  ai:             { col: 'ai_enabled',       type: 'bool',   label: 'Lydia AI' },
  maxWarnings:    { col: 'max_warnings',     type: 'int',    label: 'Max warnings',     min: 1,  max: 10 },
  mentionLimit:   { col: 'mention_limit',    type: 'int',    label: 'Mention limit',    min: 3,  max: 20 },
  xpMultiplier:   { col: 'xp_multiplier',    type: 'num',    label: 'XP multiplier',    min: 0.5, max: 5 },
  dailyBonus:     { col: 'daily_bonus',      type: 'int',    label: 'Daily bonus',      min: 0,  max: 100000 },
};

const CONFIRM_MS = 90_000;
const INTENT_RE = /(\{[^{}]*?"action"\s*:\s*"set"[^{}]*?\})/;

// Parse and strip the intent block from the model's reply. Returns { text, intent|null }.
function extractIntent(reply) {
  reply = reply.replace(/<\|tool_call_start\|>[\s\S]*?<\|tool_call_end\|>/g, '').trim();
  const m = reply.match(INTENT_RE);
  if (!m) return { text: reply, intent: null };
  let intent = null;
  try { intent = JSON.parse(m[1]); } catch { return { text: reply.replace(m[0], '').trim(), intent: null }; }
  return { text: reply.replace(/```(?:json)?\s*/g, '').replace(m[0], '').replace(/```/g, '').trim(), intent };
}

function coerce(spec, raw) {
  if (spec.type === 'bool') {
    if (typeof raw === 'boolean') return raw ? 1 : 0;
    const s = String(raw).toLowerCase();
    if (['on','true','1','yes','enable','enabled'].includes(s)) return 1;
    if (['off','false','0','no','disable','disabled'].includes(s)) return 0;
    return null;
  }
  if (spec.type === 'int' || spec.type === 'num') {
    const n = spec.type === 'int' ? parseInt(raw, 10) : parseFloat(raw);
    if (!Number.isFinite(n)) return null;
    if (spec.min !== undefined && n < spec.min) return null;
    if (spec.max !== undefined && n > spec.max) return null;
    return n;
  }
  if (spec.type === 'string') return spec.validate?.(raw) ? String(raw) : null;
  return null;
}

function displayVal(spec, v) {
  if (spec.type === 'bool') return v ? 'on' : 'off';
  return `\`${v}\``;
}

// Main entry. Returns the text to show (intent stripped). Handles the action flow itself.
async function handleIntent({ reply, message, client, db, isPremium, isElevated }) {
  const { text, intent } = extractIntent(reply);
  if (!intent) return text;

  const gid = message.guild?.id;
  const spec = ALLOWED[intent.key];
  const note = (s) => `${text}\n\n> ${s}`;

  // 1. allowlist
  if (!gid || !spec) return note(`⚙️ I can't change \`${intent.key}\` — it's not a setting I'm allowed to touch. Use the dashboard for that.`);

  // 2. premium gate
  if (!isPremium(db, gid)) return note(`⚙️ Applying settings by chat is a **premium** feature. I can still tell you exactly where to change it: dashboard → Settings, or \`/serversettings set\`.`);

  // 3. permission gate — the speaker must already be able to do this
  const member = message.member;
  const canManage = member && (message.guild.ownerId === member.id || isElevated(member) || member.permissions.has(PermissionsBitField.Flags.ManageGuild));
  if (!canManage) return note(`⚙️ You'd need **Manage Server** to change ${spec.label}. Ask an admin.`);

  // 4. validate value
  const value = coerce(spec, intent.value);
  if (value === null) return note(`⚙️ \`${intent.value}\` isn't a valid value for ${spec.label}${spec.min !== undefined ? ` (${spec.min}–${spec.max})` : ''}.`);

  // 5. read current for the audit trail
  let current = null;
  try { current = db.prepare(`SELECT ${spec.col} AS v FROM server_settings WHERE guild_id = ?`).get(gid)?.v ?? null; } catch {}
  if (String(current) === String(value)) return note(`⚙️ ${spec.label} is already ${displayVal(spec, value)} — nothing to change.`);

  // 6. confirm — same user, ✅ within 60s
  const confirmEmbed = new EmbedBuilder()
    .setColor(0xfbbf24)
    .setDescription(`⚙️ **Confirm change** — ${spec.label}: ${displayVal(spec, current)} → ${displayVal(spec, value)}\n\nTap **Confirm** within ${CONFIRM_MS/1000}s to apply.`)
    .setFooter({ text: `Requested by ${message.author.username} • ${message.guild.name}` });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lydia_confirm').setLabel('Confirm').setStyle(ButtonStyle.Success).setEmoji('✅'),
    new ButtonBuilder().setCustomId('lydia_cancel').setLabel('Cancel').setStyle(ButtonStyle.Secondary),
  );
  const prompt = await message.reply({ embeds: [confirmEmbed], components: [row] });

  const confirmed = await prompt.awaitMessageComponent({
    componentType: ComponentType.Button,
    filter: (i) => i.user.id === message.author.id && ['lydia_confirm','lydia_cancel'].includes(i.customId),
    time: CONFIRM_MS,
  }).then(async (i) => { await i.deferUpdate().catch(() => {}); return i.customId === 'lydia_confirm'; }).catch(() => false);
  await prompt.edit({ components: [] }).catch(() => {});
  setTimeout(() => prompt.delete().catch(() => {}), 8000);

  if (!confirmed) {
    console.log(`[LYDIA ACTION] cancelled (no ✅ from ${message.author.tag} within ${CONFIRM_MS/1000}s) — ${spec.col}`);
    await prompt.edit({ embeds: [EmbedBuilder.from(confirmEmbed).setColor(0x71717a).setDescription(`⚙️ Cancelled — ${spec.label} unchanged. Only <@${message.author.id}> can confirm, within ${CONFIRM_MS/1000}s.`)] }).catch(() => {});
    return text;
  }

  // 7. apply
  const ok = client.updateServerSetting?.(gid, spec.col, String(value));
  if (!ok) {
    await prompt.edit({ embeds: [EmbedBuilder.from(confirmEmbed).setColor(0xf87171).setDescription(`⚙️ Failed to apply ${spec.label}. Try the dashboard.`)] }).catch(() => {});
    return text;
  }
  client.settings?.delete(gid);

  // 8. audit — same table + shape AutoMod uses, so the dashboard timeline shows it
  try {
    db.prepare(`INSERT INTO moderation_logs (guild_id,user_id,moderator_id,action,reason,timestamp) VALUES (?,?,?,?,?,?)`)
      .run(gid, message.author.id, client.user.id, 'config', `Lydia: ${spec.label} ${displayVal(spec, current)} → ${displayVal(spec, value)}`, Date.now());
  } catch {}

  // 9. mod-log channel, if configured
  try {
    const logId = db.prepare('SELECT mod_log_channel AS c FROM server_settings WHERE guild_id = ?').get(gid)?.c;
    const ch = logId && message.guild.channels.cache.get(logId);
    if (ch?.isTextBased()) {
      await ch.send({ embeds: [new EmbedBuilder().setColor(0x00cc66)
        .setDescription(`⚙️ **${spec.label}** ${displayVal(spec, current)} → ${displayVal(spec, value)}\nvia Lydia · requested by <@${message.author.id}>`)
        .setTimestamp()] });
    }
  } catch {}

  await prompt.edit({ embeds: [EmbedBuilder.from(confirmEmbed).setColor(0x00cc66).setDescription(`✅ Done — ${spec.label} is now ${displayVal(spec, value)}.`)] }).catch(() => {});
  console.log(`[LYDIA ACTION] ${message.author.tag} set ${spec.col}=${value} in ${message.guild.name}`);
  return text;
}

// Prompt fragment: tells the model how to propose. Injected only for premium guilds.
const INTENT_INSTRUCTIONS = `
SETTINGS ACTIONS (premium server): if the user clearly asks you to CHANGE a server setting, answer normally and then append exactly one JSON block on its own line:
{"action":"set","key":"<key>","value":<value>}
Allowed keys: ${Object.keys(ALLOWED).join(', ')}. Use booleans for toggles, numbers for limits, a short string for prefix/language.
Only emit the block for explicit change requests ("set", "change", "turn off", "disable", "make the prefix"). Never for questions. If unsure, ask instead of emitting.
CRITICAL: you cannot apply changes yourself and you do not know the current value. NEVER say "done", "set", "changed", "already set", or describe a new state. Say only that you're requesting it, e.g. "Requesting that change — confirm below." The bot verifies permissions, shows the real current value, and asks the user to confirm.`;

const NON_PREMIUM_INSTRUCTIONS = `
SETTINGS REQUESTS: if the user asks you to CHANGE a server setting (prefix, language, automod, welcome, etc.), you cannot apply it here. Say clearly that applying settings by chat is a premium feature, and point them to the dashboard (Settings) or the exact command /serversettings set — do not suggest any other command name for this. Do not emit any JSON. Do not claim anything was changed.`;

module.exports = { handleIntent, INTENT_INSTRUCTIONS, NON_PREMIUM_INSTRUCTIONS, ALLOWED };
