'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// GAME HUB — the front door of /game, on Components V2
// One card: a welcome, your own numbers, then one row per game with a Play button.
// The buttons keep the ids the game plugin already understands (game_play_<game>),
// so nothing else has to change.
// Texts: lang/<locale>/gamehub.json     Emojis: config/emojis.js (hub* and game* keys)
// ═══════════════════════════════════════════════════════════════════════════
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  SectionBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const ui = require('./ui');
const E = require('../../config/emojis');

// key = the game's id in game_play_<key>; emoji = a name in config/emojis.js
const GAMES = [
  { key: 'codm', emoji: 'gameCodm' },
  { key: 'slots', emoji: 'gameSlots' },
  { key: 'tictactoe', emoji: 'gameTicTacToe' },
  { key: 'blackjack', emoji: 'gameBlackjack' },
  { key: 'roulette', emoji: 'gameRoulette' },
  { key: 'trivia', emoji: 'gameTrivia' },
];

const em = (key) => E[key] || '';
const join = (...parts) => parts.filter(Boolean).join(' ');
const num = (n) => Number(n || 0).toLocaleString('en-US');

// stats = the player's row from the users table, or null when they have none yet
function buildHub({ lang, guildName, user, stats }) {
  const L = ui.pickLang(lang) || 'en';
  const T = ui.t(L, 'gamehub');
  const name = ui.clean((user && (user.globalName || user.username)) || '', 24) || '…';
  const text = (s) => new TextDisplayBuilder().setContent(String(s).slice(0, 3900));
  const rule = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

  const head = [`## ${join(em('hubWheel'), T('title'))}`];
  if (guildName) head.push(`-# ${ui.clean(guildName, 60)}`);
  head.push(T('welcome', { name }));

  const numbers = stats
    ? [
      join(em('coins'), T('statCredits', { n: num(stats.credits) })),
      join(em('gameController'), T('statPlayed', { n: num(stats.games_played) })),
      join(em('trophy'), T('statWon', { n: num(stats.games_won) })),
    ].join('   ·   ')
    : T('statsNone');

  const card = new ContainerBuilder().setAccentColor(ui.COLORS.info)
    .addTextDisplayComponents(text(head.join('\n')))
    .addSeparatorComponents(rule())
    .addTextDisplayComponents(text(numbers))
    .addSeparatorComponents(rule());

  for (const g of GAMES) {
    card.addSectionComponents(new SectionBuilder()
      .addTextDisplayComponents(text(`**${join(em(g.emoji), T('g_' + g.key))}**\n${T('d_' + g.key)}`))
      .setButtonAccessory(new ButtonBuilder().setCustomId(`game_play_${g.key}`).setLabel(T('play')).setStyle(ButtonStyle.Primary)));
  }

  card.addSeparatorComponents(rule())
    .addTextDisplayComponents(text(`${join(em('hubInfo'), T('note'))}\n${join(em('hubSparkle'), T('luck'))}`));

  return { components: [card], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

module.exports = { buildHub, GAMES };
