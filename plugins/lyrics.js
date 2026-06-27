const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    name: 'lyrics',
    aliases: ['lyric', 'paroles', 'lrc'],
    description: '📝 Get lyrics for the current or any song',
    category: 'MUSIC',
    cooldown: 5000,

    run: async (client, message, args) => {
        const query = args.join(' ');
        const musicPlugin = client.commands?.get('music');
        const q = musicPlugin?.getQueue?.(message.guild?.id);
        const searchQuery = query || (q?.currentTrack ? `${q.currentTrack.title} ${q.currentTrack.artist || ''}` : null);

        if (!searchQuery) return message.reply('❌ No song playing and no query provided. Usage: `.lyrics <song name>`').catch(() => {});

        const msg = await message.reply('🔍 Searching lyrics...').catch(() => {});
        const result = await fetchLyrics(searchQuery);
        if (!result) return msg?.edit('❌ Lyrics not found for: **' + searchQuery + '**').catch(() => {});

        const pages = paginateLyrics(result.lyrics);
        await sendLyricsEmbed(message.channel, result, pages, 0, client, msg);
    },

    execute: async (interaction, client) => {
        const query = interaction.options.getString('query');
        const musicPlugin = client.commands?.get('music');
        const q = musicPlugin?.getQueue?.(interaction.guild?.id);
        const searchQuery = query || (q?.currentTrack ? `${q.currentTrack.title} ${q.currentTrack.artist || ''}` : null);

        if (!searchQuery) return interaction.reply({ content: '❌ No song playing! Provide a song name or play something first.', flags: 64 });

        await interaction.deferReply();
        const result = await fetchLyrics(searchQuery);
        if (!result) return interaction.editReply({ content: `❌ Lyrics not found for: **${searchQuery}**` });

        const pages = paginateLyrics(result.lyrics);
        const embed = buildLyricsEmbed(result, pages, 0, client);
        const row = pages.length > 1 ? buildPaginationRow(0, pages.length) : null;
        const reply = await interaction.editReply({ embeds: [embed], components: row ? [row] : [] });

        if (pages.length > 1) {
            let page = 0;
            const collector = reply.createMessageComponentCollector({ time: 120000 });
            collector.on('collect', async i => {
                if (i.user.id !== interaction.user.id) return i.reply({ content: '❌ Not your session', flags: 64 }).catch(() => {});
                await i.deferUpdate().catch(() => {});
                if (i.customId === 'lyrics_prev') page = Math.max(0, page - 1);
                if (i.customId === 'lyrics_next') page = Math.min(pages.length - 1, page + 1);
                await interaction.editReply({ embeds: [buildLyricsEmbed(result, pages, page, client)], components: [buildPaginationRow(page, pages.length)] }).catch(() => {});
            });
            collector.on('end', () => interaction.editReply({ components: [] }).catch(() => {}));
        }
    },

    data: {
        toJSON: () => ({
            name: 'lyrics',
            description: '📝 Get lyrics for the current or any song',
            options: [{
                name: 'query',
                description: 'Song name and artist (leave empty for current track)',
                type: 3,
                required: false,
            }]
        })
    }
};

// ── Fetch lyrics from lrclib ──────────────────────────
async function fetchLyrics(query) {
    try {
        const encoded = encodeURIComponent(query.trim());
        const res = await fetch(`https://lrclib.net/api/search?q=${encoded}`);
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const track = data[0];
        const lyrics = track.plainLyrics || track.syncedLyrics?.replace(/\[\d+:\d+\.\d+\]/g, '') || null;
        if (!lyrics) return null;
        return {
            title: track.trackName || query,
            artist: track.artistName || 'Unknown',
            album: track.albumName || null,
            duration: track.duration || 0,
            lyrics: lyrics.trim(),
        };
    } catch(e) {
        console.error('[LYRICS] Fetch error:', e.message);
        return null;
    }
}

// ── Paginate lyrics into chunks ───────────────────────
function paginateLyrics(lyrics, maxLen = 1800) {
    const lines = lyrics.split('\n');
    const pages = [];
    let current = '';
    for (const line of lines) {
        if ((current + '\n' + line).length > maxLen) {
            if (current) pages.push(current.trim());
            current = line;
        } else {
            current += (current ? '\n' : '') + line;
        }
    }
    if (current.trim()) pages.push(current.trim());
    return pages.length > 0 ? pages : [lyrics.substring(0, maxLen)];
}

// ── Build embed ───────────────────────────────────────
function buildLyricsEmbed(result, pages, page, client) {
    return new EmbedBuilder()
        .setColor(0x00f0ff)
        .setAuthor({ name: '📝 ARCHON LYRICS ENGINE', iconURL: client.user.displayAvatarURL() })
        .setTitle(`${result.title}`)
        .setDescription(`*by **${result.artist}**${result.album ? ` • ${result.album}` : ''}*\n\n${pages[page]}`)
        .setFooter({ text: `BAMAKO_223 🇲🇱 • Page ${page + 1}/${pages.length} • Powered by lrclib` })
        .setTimestamp();
}

// ── Build pagination buttons ──────────────────────────
function buildPaginationRow(page, total) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('lyrics_prev').setLabel('◀️ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder().setCustomId('lyrics_next').setLabel('Next ▶️').setStyle(ButtonStyle.Primary).setDisabled(page === total - 1),
    );
}

// ── Send paginated lyrics (prefix) ───────────────────
async function sendLyricsEmbed(channel, result, pages, page, client, existingMsg) {
    const embed = buildLyricsEmbed(result, pages, page, client);
    const row = pages.length > 1 ? buildPaginationRow(page, pages.length) : null;

    let msg;
    if (existingMsg) {
        msg = await existingMsg.edit({ content: null, embeds: [embed], components: row ? [row] : [] }).catch(() => null);
    } else {
        msg = await channel.send({ embeds: [embed], components: row ? [row] : [] }).catch(() => null);
    }

    if (!msg || pages.length <= 1) return;

    let currentPage = page;
    const collector = msg.createMessageComponentCollector({ time: 120000 });
    collector.on('collect', async i => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === 'lyrics_prev') currentPage = Math.max(0, currentPage - 1);
        if (i.customId === 'lyrics_next') currentPage = Math.min(pages.length - 1, currentPage + 1);
        await msg.edit({ embeds: [buildLyricsEmbed(result, pages, currentPage, client)], components: [buildPaginationRow(currentPage, pages.length)] }).catch(() => {});
    });
    collector.on('end', () => msg.edit({ components: [] }).catch(() => {}));
}
