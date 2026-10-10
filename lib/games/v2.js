'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS V2 HELPERS — one card made of text, lines, buttons and game rows
// Games build a list of items and get back a message ready to send or edit:
//   { text } · { rule: true } · { row } · { section: [text, button] }
// A card cannot carry `content` or `embeds`, so nothing else is added to the message.
// ═══════════════════════════════════════════════════════════════════════════
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, MessageFlags,
} = require('discord.js');

const text = (s) => new TextDisplayBuilder().setContent(String(s).slice(0, 3900));
const rule = () => new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small);

function card(color, items) {
  const c = new ContainerBuilder().setAccentColor(color);
  for (const it of items) {
    if (it.text !== undefined) c.addTextDisplayComponents(text(it.text));
    else if (it.rule) c.addSeparatorComponents(rule());
    else if (it.row) c.addActionRowComponents(it.row);
    else if (it.section) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(it.section[0])).setButtonAccessory(it.section[1]));
  }
  return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

module.exports = { card, text, rule };
