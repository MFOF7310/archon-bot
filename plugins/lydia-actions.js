// ═══════════════════════════════════════════════════════════════════════════
// LYDIA ACTIONS — premium-gated, permission-checked, confirmed settings changes
// Security boundary: the model only *proposes* via a JSON intent; this file decides.
// ═══════════════════════════════════════════════════════════════════════════
const { PermissionsBitField, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags } = require('discord.js');
const { icon } = require('../lib/ui/icons');
const em = (k, fb) => { try { return require('../config/emojis')[k] || fb; } catch { return fb; } };
const i18n = require('../lib/i18n');

const pickLang = (l) => ({ en: 'en', fr: 'fr', zh: 'zh', ar: 'ar', bm: 'fr' })[l] || null;

const ALLOWED = {
  // set = the name client.updateServerSetting accepts (it refused raw column names such as automod_enabled)
  prefix:         { set: 'prefix', col: 'prefix',           type: 'string', label: 'Command prefix',   validate: v => typeof v === 'string' && v.length >= 1 && v.length <= 5 && !/\s/.test(v) },
  language:       {set: 'language', col: 'language',         type: 'string', label: 'Language',         validate: v => ['auto','en','fr','ar','bm','zh'].includes(v) },
  automod:        {set: 'automodEnabled', col: 'automod_enabled',  type: 'bool',   label: 'AutoMod' },
  linkFilter:     {set: 'linkFilterEnabled', col: 'link_filter_enabled', type: 'bool', label: 'Link filter' },
  inviteFilter:   {set: 'inviteFilterEnabled', col: 'invite_filter_enabled', type: 'bool', label: 'Invite filter' },
  welcome:        {set: 'welcomeEnabled', col: 'welcome_enabled',  type: 'bool',   label: 'Welcome messages' },
  goodbye:        {set: 'goodbyeEnabled', col: 'goodbye_enabled',  type: 'bool',   label: 'Goodbye messages' },
  market:         {set: 'marketEnabled', col: 'market_enabled',   type: 'bool',   label: 'Market' },
  ai:             {set: 'aiEnabled', col: 'ai_enabled',       type: 'bool',   label: 'Lydia AI' },
  maxWarnings:    {set: 'maxWarnings', col: 'max_warnings',     type: 'int',    label: 'Max warnings',     min: 1,  max: 10 },
  mentionLimit:   {set: 'mentionLimit', col: 'mention_limit',    type: 'int',    label: 'Mention limit',    min: 3,  max: 20 },
  xpMultiplier:   {set: 'xpMultiplier', col: 'xp_multiplier',    type: 'num',    label: 'XP multiplier',    min: 0.5, max: 5 },
  dailyBonus:     {set: 'dailyBonus', col: 'daily_bonus',      type: 'int',    label: 'Daily bonus',      min: 0,  max: 100000 },
};

const CONFIRM_MS = 90_000;
const INTENT_RE = /(\{[^{}]*?"action"\s*:\s*"set"[^{}]*?\})/;

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

function showVal(spec, v, tr) {
  if (spec.type === 'bool') return v ? tr('on') : tr('off');
  return (v === '' || v === null || v === undefined) ? tr('none') : `\`${v}\``;
}

function salvageIntent(reply, userMsg) {
  if (!/(request|confirm|demande|let's|je (lance|change))/i.test(reply)) return null;
  const m = reply.match(/setprefix\s+`?([^\s`*<>\[\]]{1,5})`?/i);
  if (m && !/^default$/i.test(m[1])) return { action: 'set', key: 'prefix', value: m[1] };
  if (/pr[ée]fix/i.test(`${reply}\n${userMsg}`) && /(default|d[ée]faut|reset|r[ée]initialis)/i.test(`${reply}\n${userMsg}`)) return { action: 'set', key: 'prefix', value: '.' };
  return null;
}

async function handleIntent({ reply, message, client, db, isPremium, isElevated, lang: langIn }) {
  const gearEmoji = em('ic_settings', '⚙️');
  const checkEmoji = em('small_check', em('ic_ok', '✅'));
  
  let { text, intent } = extractIntent(reply);
  if (!intent) {
    const s2 = salvageIntent(text, message.content || '');
    if (s2) {
      intent = s2;
      text = text.replace(/\s*\*\*(?:Slash )?Command:\*\*\s*[!\/.?,*$#]?\w+(?:\s+\S+)?/gi, '').trim();
    }
  }
  if (!intent) {
    if (/confirm below/i.test(text)) console.log('[LYDIA ACTION] reply promised a confirmation but had no intent block');
    return text.replace(/\s*Requesting that change\s*[—–-]\s*confirm below\.?/gi, '').trim();
  }

  const gid = message.guild?.id;
  const spec = ALLOWED[intent.key];
  const lang = pickLang(langIn) || pickLang((() => { try { return client.detectLanguage?.('lydia', gid); } catch { return null; } })()) || 'en';
  const tr = (k, vars) => i18n.t(`lydia-actions.${k}`, lang, vars);
  const lab = spec ? tr(`labels.${intent.key}`) : '';
  const note = (s) => `> ${s}`;

  if (!gid || !spec) return note(`${gearEmoji} ${tr('notAllowed', { key: String(intent.key || '?').replace(/[^\w-]/g, '').slice(0, 30) })}`);
  if (!isPremium(db, gid)) return note(`${gearEmoji} ${tr('premiumOnly')}`);

  const member = message.member;
  const canManage = member && (message.guild.ownerId === member.id || isElevated(member) || member.permissions.has(PermissionsBitField.Flags.ManageGuild));
  if (!canManage) return note(`${gearEmoji} ${tr('needManage', { label: lab })}`);

  const value = coerce(spec, intent.value);
  if (value === null) return note(`${gearEmoji} ${tr('invalid', { value: intent.value, label: lab, range: spec.min !== undefined ? ` (${spec.min}–${spec.max})` : '' })}`);

  let current = null;
  try { current = db.prepare(`SELECT ${spec.col} AS v FROM server_settings WHERE guild_id = ?`).get(gid)?.v ?? null; } catch {}
  if (String(current) === String(value)) return note(`${gearEmoji} ${tr('already', { label: lab, value: showVal(spec, value, tr) })}`);

  // The confirmation runs on its own: Lydia's answer is shown at once (it used to wait up to 90 s for the click)
  askConfirm({ message, client, db, gid, spec, lab, current, value, tr, gearEmoji, checkEmoji }).catch((e) => console.log('[LYDIA ACTION] confirm:', e.message));
  return text;
}

async function askConfirm({ message, client, db, gid, spec, lab, current, value, tr, gearEmoji, checkEmoji }) {
  const card = (color, text, row = null, foot = null) => {
    const c = new ContainerBuilder().setAccentColor(color);
    c.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
    if (row) { c.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)); c.addActionRowComponents(row); }
    if (foot) c.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${foot}`));
    return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
  };
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('lydia_confirm').setLabel(tr('confirmBtn')).setStyle(ButtonStyle.Success).setEmoji(icon('ok')),
    new ButtonBuilder().setCustomId('lydia_cancel').setLabel(tr('cancelBtn')).setStyle(ButtonStyle.Secondary),
  );
  const prompt = await message.reply(card(0xfbbf24,
    `**${gearEmoji} ${tr('titleConfirm')}**\n\n**${tr('paramLabel')} :** ${lab}\n**${tr('changeLabel')} :** ${showVal(spec, current, tr)} ➔ ${showVal(spec, value, tr)}`,
    row, tr('requestedBy', { user: message.author.username, guild: message.guild.name })));

  // Only the member who asked can answer; anyone else gets a private note instead of "This interaction failed"
  const choice = await new Promise((resolve) => {
    const col = prompt.createMessageComponentCollector({ componentType: ComponentType.Button, time: CONFIRM_MS });
    col.on('collect', async (i) => {
      if (i.user.id !== message.author.id) return i.reply({ content: tr('notYours'), flags: 64 }).catch(() => {});
      await i.deferUpdate().catch(() => {});
      col.stop(i.customId);
    });
    col.on('end', (_, reason) => resolve(reason === 'lydia_confirm' ? 'yes' : reason === 'lydia_cancel' ? 'no' : 'timeout'));
  });
  const finish = (payload) => prompt.edit(payload).catch(() => {}).then(() => setTimeout(() => prompt.delete().catch(() => {}), 15000));

  if (choice !== 'yes') return finish(card(0x71717a, `**${gearEmoji} ${tr('cancelled', { label: lab })}**`));

  // The member may have lost Manage Server while the card was open
  const still = await message.guild.members.fetch(message.author.id).catch(() => null);
  if (!still || !(message.guild.ownerId === still.id || still.permissions.has(PermissionsBitField.Flags.ManageGuild))) {
    return finish(card(0xf87171, `**${gearEmoji} ${tr('needManage', { label: lab })}**`));
  }
  const ok = client.updateServerSetting?.(gid, spec.set, String(value));
  if (!ok) return finish(card(0xf87171, `**${gearEmoji} ${tr('titleError')}**\n\n${tr('failed', { label: lab })}`));
  client.settings?.delete(gid);

  // Audit: who changed what (the member, not the bot), in seconds like every other moderation log
  try {
    db.prepare('INSERT INTO moderation_logs (id, guild_id, user_id, moderator_id, action, reason, timestamp) VALUES (?,?,?,?,?,?,?)')
      .run(`config_${Date.now()}_${message.author.id}`, gid, message.author.id, message.author.id, 'config', `Lydia: ${spec.label} ${current} → ${value}`, Math.floor(Date.now() / 1000));
  } catch {}
  try {
    const logId = db.prepare('SELECT mod_log_channel AS c FROM server_settings WHERE guild_id = ?').get(gid)?.c;
    const ch = logId && message.guild.channels.cache.get(logId);
    if (ch?.isTextBased()) await ch.send(card(0x00cc66, `**${gearEmoji} ${tr('titleLog')}**\n\n**${lab}** · ${showVal(spec, current, tr)} ➔ ${showVal(spec, value, tr)}`, null, tr('modlog', { id: message.author.id })));
  } catch {}
  return finish(card(0x00cc66, `**${checkEmoji} ${tr('titleSuccess')}**\n\n${tr('done', { label: lab, to: showVal(spec, value, tr) })}`));
}

const INTENT_INSTRUCTIONS = `
SETTINGS ACTIONS (premium server): if the user clearly asks you to CHANGE a server setting, reply with ONE short, friendly sentence (no instructions, no alternative ways to do it), then append exactly one JSON block on its own line:
{"action":"set","key":"<key>","value":<value>}
Allowed keys: ${Object.keys(ALLOWED).join(', ')}. Use booleans for toggles, numbers for limits, a short string for prefix/language. To reset the prefix to its default, use ".". Whenever you say you are requesting a change you MUST append the JSON block; if you cannot tell the value, ask which one they want and do not say you are requesting anything.
Only emit the block for explicit change requests ("set", "change", "turn off", "disable", "make the prefix"). Never for questions. If unsure, ask instead of emitting.
Never write command syntax (no 'Command:' or 'Slash Command:' lines); the confirm button does the work.
Example: user "reset the prefix to default" -> you: "Sure, I will reset the prefix to the default." then on the next line {"action":"set","key":"prefix","value":"."}
CRITICAL: you cannot apply changes yourself and you do not know the current value. NEVER say "done", "set", "changed", "already set", or describe a new state. Say only that you're requesting it, e.g. "Requesting that change — confirm below." The bot verifies permissions, shows the real current value, and asks the user to confirm.`;

const NON_PREMIUM_INSTRUCTIONS = `
SETTINGS REQUESTS: if the user asks you to CHANGE a server setting (prefix, language, automod, welcome, etc.), you cannot apply it here. Say clearly that applying settings by chat is a premium feature, and point them to the dashboard (Settings) or the exact command /serversettings set — do not suggest any other command name for this. Do not emit any JSON. Do not claim anything was changed.`;

module.exports = { handleIntent, INTENT_INSTRUCTIONS, NON_PREMIUM_INSTRUCTIONS, ALLOWED };
