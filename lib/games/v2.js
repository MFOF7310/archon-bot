'use strict';
// ═══════════════════════════════════════════════════════════════════════════
// COMPONENTS V2 HELPERS — one card made of text, lines, buttons and game rows
// Games build a list of items and get back a message ready to send or edit:
//   { text } · { rule: true } · { row } · { section: [text, button] } · { thumbnail: [text, imageUrl] } · { media: [url, altText] }
// A card cannot carry `content` or `embeds`, so nothing else is added to the message.
// ═══════════════════════════════════════════════════════════════════════════
const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, SectionBuilder, ThumbnailBuilder, MessageFlags,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
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
    else if (it.thumbnail) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(it.thumbnail[0])).setThumbnailAccessory(new ThumbnailBuilder().setURL(it.thumbnail[1])));
    else if (it.media) {
      const item = new MediaGalleryItemBuilder().setURL(it.media[0]);
      if (it.media[1]) item.setDescription(String(it.media[1]).slice(0, 1000));
      c.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(item));
    }
  }
  return { components: [c], flags: MessageFlags.IsComponentsV2, allowedMentions: { parse: [] } };
}

module.exports = { card, text, rule };
