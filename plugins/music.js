/**
 * ARCHITECT CG-223 // NEURAL AUDIO ENGINE v4.0
 * Lavalink + shoukaku v4 - Full-featured music system
 * Complete rewrite - Unicode-safe for GitHub mobile
 *
 * Exports: initLavalink, handleComponent, handleSelectMenu
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, SlashCommandBuilder
} = require('discord.js');

const { Shoukaku, Connectors } = require('shoukaku');
const https = require('https');

// ============================================================================
// CONSTANTS - All emojis as Unicode escapes (GitHub mobile safe)
// ============================================================================

const C = {
  GREEN:  0x00ff88,
  DARK:   0x0a0a0a,
  ACCENT: 0x00d4ff,
  WARN:   0xff6b35,
  RED:    0xe74c3c,
  GOLD:   0xf1c40f,
  SPOTIFY: 0x1DB954,
  BLURPLE: 0x5865F2,
};

const EMOJI = {
  PLAY:    '\u{25B6}\u{FE0F}',
  PAUSE:   '\u{23F8}\u{FE0F}',
  STOP:    '\u{23F9}\u{FE0F}',
  SKIP:    '\u{23ED}\u{FE0F}',
  PREV:    '\u{23EE}\u{FE0F}',
  LOOP:    '\u{1F501}',
  LOOP1:   '\u{1F502}',
  VOLUP:   '\u{1F50A}',
  VOLDN:   '\u{1F509}',
  VOLMUTE: '\u{1F508}',
  SHUFFLE: '\u{1F500}',
  QUEUE:   '\u{1F4DC}',
  DASH:    '\u{1F39B}\u{FE0F}',
  X:       '\u{274C}',
  NOTE:    '\u{1F3B5}',
  NOTES:   '\u{1F3B6}',
  CD:      '\u{1F4BF}',
  DISC:    '\u{1F4C0}',
  MIC:     '\u{1F3A4}',
  HEADPH:  '\u{1F3A7}',
  CHECK:   '\u{2705}',
  WARN:    '\u{26A0}\u{FE0F}',
  RED:     '\u{1F534}',
  GREEN:   '\u{1F7E2}',
  YELLOW:  '\u{1F7E1}',
  BLUE:    '\u{1F535}',
  ROCKET:  '\u{1F680}',
  CHART:   '\u{1F4CA}',
  CLOCK:   '\u{1F550}',
  USER:    '\u{1F464}',
  BUILD:   '\u{1F3DB}\u{FE0F}',
  FLAG:    '\u{1F1F2}\u{1F1F1}',
  SEARCH:  '\u{1F50D}',
  STAR:    '\u{2B50}',
  FIRE:    '\u{1F525}',
};

const CFG = {
  MAX_QUEUE: 100,
  HISTORY: 50,
  IDLE_MS: 300000,
  NP_MS: 10000,
  SEARCH_RES: 10,
  VOL_DEF: 100,
};

// ============================================================================
// STATE - Per-guild isolation
// ============================================================================

const states = new Map();

function getState(gid) {
  if (!states.has(gid)) {
    states.set(gid, {
      gid, queue: [], current: null, player: null, conn: null,
      vol: CFG.VOL_DEF, loop: 'off', paused: false,
      npMsg: null, dashMsg: null, txtCh: null,
      req: null, startT: null, history: [],
      sess: Math.random().toString(36).slice(2, 10).toUpperCase(),
      updInt: null,
    });
  }
  return states.get(gid);
}

function destroyState(gid) {
  const s = states.get(gid);
  if (!s) return;
  if (s.updInt) { clearInterval(s.updInt); s.updInt = null; }
  if (s.conn) try { s.conn.disconnect(); } catch {}
  if (s.player) try { s.player.stopTrack(); } catch {}
  states.delete(gid);
}

// ============================================================================
// LAVALINK INIT (exported)
// ============================================================================

function initLavalink(client) {
  const host = process.env.LAVALINK_HOST || 'localhost';
  const port = parseInt(process.env.LAVALINK_PORT || '2333');
  const auth = process.env.LAVALINK_PASSWORD || 'archon-223-secure';

  const nodes = [{ name: 'BAMAKO_223', url: `${host}:${port}`, auth }];
  const shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
    moveOnDisconnect: false, resume: true, resumeByLibrary: true,
    reconnectTries: 5, reconnectInterval: 5000, restTimeout: 10000,
  });

  client.shoukaku = shoukaku;

  shoukaku.on('ready', (n) => console.log(`\x1b[32m[LAVALINK]\x1b[0m Node ${n} ready`));
  shoukaku.on('error', (n, e) => console.error(`\x1b[31m[LAVALINK]\x1b[0m ${n}: ${e.message}`));
  shoukaku.on('close', (n, c, r) => console.log(`\x1b[33m[LAVALINK]\x1b[0m ${n} closed: ${c} ${r}`));
  shoukaku.on('disconnect', (n, c) => console.log(`\x1b[33m[LAVALINK]\x1b[0m ${n} disconnected`));

  console.log('\x1b[32m[LAVALINK]\x1b[0m Shoukaku v4 initialized');
}

// ============================================================================
// SPOTIFY API (metadata only)
// ============================================================================

let spotToken = null;
let spotExpiry = 0;

async function spotifyAuth() {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const sec = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !sec) return null;
  if (spotToken && Date.now() < spotExpiry - 60000) return spotToken;
  try {
    const buf = Buffer.from(`${id}:${sec}`).toString('base64');
    const body = await post('accounts.spotify.com', '/api/token',
      'grant_type=client_credentials',
      { Authorization: `Basic ${buf}`, 'Content-Type': 'application/x-www-form-urlencoded' });
    if (body.access_token) { spotToken = body.access_token; spotExpiry = Date.now() + body.expires_in * 1000; return spotToken; }
  } catch (e) { console.error('[Spotify]', e.message); }
  return null;
}

async function spotifySearch(q, limit = CFG.SEARCH_RES) {
  const t = await spotifyAuth();
  if (!t) return null;
  try {
    const d = await get('api.spotify.com', `/v1/search?q=${enc(q)}&type=track&limit=${limit}`,
      { Authorization: `Bearer ${t}` });
    if (!d.tracks?.items?.length) return null;
    return d.tracks.items.map(tr => ({
      title: tr.name,
      artist: tr.artists?.map(a => a.name).join(', ') || 'Unknown',
      duration: tr.duration_ms,
      thumb: tr.album?.images?.[0]?.url || null,
      uri: tr.external_urls?.spotify || `https://open.spotify.com/track/${tr.id}`,
      id: tr.id,
    }));
  } catch (e) { return null; }
}

// ============================================================================
// HTTP HELPERS
// ============================================================================

function get(h, p, hdr) {
  return new Promise((res, rej) => {
    https.get({ host: h, path: p, headers: hdr, timeout: 10000 }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { res(d); } });
    }).on('error', rej).on('timeout', function() { this.destroy(); rej(new Error('timeout')); });
  });
}

function post(h, p, b, hdr) {
  return new Promise((res, rej) => {
    const req = https.request({ host: h, path: p, method: 'POST', headers: hdr, timeout: 10000 }, (r) => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => { try { res(JSON.parse(d)); } catch { res(d); } });
    });
    req.on('error', rej).on('timeout', function() { this.destroy(); rej(new Error('timeout')); });
    req.write(b); req.end();
  });
}

function enc(s) { return encodeURIComponent(s); }

// ============================================================================
// TRACK RESOLUTION
// ============================================================================

async function resolveTrack(query, requester) {
  const tr = {
    id: Math.random().toString(36).slice(2, 12),
    title: 'Unknown', artist: 'Unknown', duration: 0,
    uri: null, source: 'unknown', thumb: null,
    requester: requester?.tag || 'Unknown', reqId: requester?.id || '0',
    addedAt: Date.now(), searchQ: null, encoded: null,
  };

  // Direct file/URL
  if (/^https?:\/\/.*\.(mp3|wav|ogg|flac|m4a|aac|webm|opus)(\?.*)?$/i.test(query)) {
    tr.title = query.split('/').pop().split('?')[0] || 'Direct Audio';
    tr.artist = 'Direct Stream'; tr.uri = query; tr.source = 'direct';
    tr.searchQ = query; return tr;
  }
  // Radio stream
  if (/^https?:\/\/.*:\d+/.test(query) || query.includes('.m3u') || query.includes('.pls')) {
    tr.title = `Radio: ${query.split('/').pop() || query}`;
    tr.artist = 'Live Stream'; tr.uri = query; tr.source = 'radio'; tr.duration = Infinity;
    tr.searchQ = query; return tr;
  }
  // Spotify URL
  if (query.includes('open.spotify.com/track/')) {
    const m = query.match(/track\/([a-zA-Z0-9]+)/);
    if (m) {
      const t = await spotifyAuth();
      if (t) try {
        const d = await get('api.spotify.com', `/v1/tracks/${m[1]}`, { Authorization: `Bearer ${t}` });
        tr.title = d.name || 'Spotify Track';
        tr.artist = d.artists?.map(a => a.name).join(', ') || 'Spotify';
        tr.duration = d.duration_ms; tr.thumb = d.album?.images?.[0]?.url || null;
        tr.uri = d.external_urls?.spotify || query; tr.source = 'spotify';
        tr.searchQ = `${tr.title} ${tr.artist}`; return tr;
      } catch {}
    }
    tr.source = 'spotify'; tr.searchQ = query; return tr;
  }
  // Generic URL (YouTube, SoundCloud, etc.)
  if (/^https?:\/\//.test(query)) {
    tr.title = 'URL Track'; tr.artist = 'Web';
    tr.uri = query; tr.source = 'url'; tr.searchQ = query; return tr;
  }

  // Text search -> try Spotify first for metadata
  const res = await spotifySearch(query, 1);
  if (res && res[0]) {
    tr.title = res[0].title; tr.artist = res[0].artist;
    tr.duration = res[0].duration; tr.thumb = res[0].thumb;
    tr.uri = res[0].uri; tr.source = 'spotify';
    tr.searchQ = `ytsearch:${res[0].title} ${res[0].artist}`; return tr;
  }

  // Fallback: direct ytsearch
  tr.title = query; tr.artist = 'YouTube';
  tr.source = 'youtube'; tr.searchQ = `ytsearch:${query}`; return tr;
}

async function resolveSearch(q, limit = CFG.SEARCH_RES) {
  const sp = await spotifySearch(q, limit);
  if (sp && sp.length) {
    return sp.map((t, i) => ({
      title: t.title, artist: t.artist, duration: t.duration,
      thumb: t.thumb, uri: t.uri, source: 'spotify',
      label: `${t.title} - ${t.artist}`.slice(0, 100),
      desc: `${fmtTime(t.duration)} - Spotify`.slice(0, 100),
      searchQ: `ytsearch:${t.title} ${t.artist}`,
      idx: i + 1,
    }));
  }
  // Fallback: Lavalink search directly
  return null; // Will be handled by caller doing Lavalink search
}

// ============================================================================
// LAVALINK PLAYBACK
// ============================================================================

async function playNext(gid, client) {
  const s = getState(gid);
  if (!s.queue.length) { s.current = null; updateNP(gid); return; }

  const track = s.queue.shift();
  s.current = track;

  try {
    const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
    const targetNode = node || Array.from(client.shoukaku.nodes.values())[0];
    if (!targetNode) throw new Error('No Lavalink node available');

    let toPlay = track;

    // Resolve search query to actual track via Lavalink
    if (track.searchQ && !track.encoded) {
      const res = await targetNode.rest.resolve(track.searchQ);
      if (res?.data?.length) {
        const ld = Array.isArray(res.data) ? res.data[0] : res.data;
        toPlay = { ...track, encoded: ld.encoded, uri: ld.info?.uri || track.uri, duration: ld.info?.length || track.duration, title: ld.info?.title || track.title, artist: ld.info?.author || track.artist };
      } else if (res?.data?.encoded) {
        const ld = res.data;
        toPlay = { ...track, encoded: ld.encoded, uri: ld.info?.uri || track.uri, duration: ld.info?.length || track.duration, title: ld.info?.title || track.title, artist: ld.info?.author || track.artist };
      } else {
        throw new Error('Track resolution failed');
      }
    }

    s.current = toPlay;
    await s.player.playTrack({ track: toPlay.encoded });
    s.startT = Date.now(); s.paused = false;
    s.history.push(toPlay);
    if (s.history.length > CFG.HISTORY) s.history.shift();

    updateNP(gid);
  } catch (e) {
    console.error(`[PLAY] ${gid}: ${e.message}`);
    if (s.txtCh) s.txtCh.send({ embeds: [emb(C.RED, `${EMOJI.RED} Failed to play: ${track.title}\n${e.message}`)] }).catch(() => {});
    if (s.queue.length) setTimeout(() => playNext(gid, client), 1000);
  }
}

function setupPlayerEvents(gid, client) {
  const s = getState(gid);
  s.player.on('start', () => {
    s.startT = Date.now(); s.paused = false; updateNP(gid);
  });
  s.player.on('end', (d) => {
    if (d.reason === 'replaced') return;
    if (s.loop === 'track' && s.current) {
      s.queue.unshift(s.current);
    }
    if (s.loop === 'queue' && s.current) {
      s.queue.push(s.current);
    }
    if (s.queue.length) playNext(gid, client);
    else { s.current = null; updateNP(gid); setTimeout(() => { const st = getState(gid); if (st && !st.current && !st.queue.length) destroyState(gid); }, CFG.IDLE_MS); }
  });
  s.player.on('exception', (e) => {
    console.error(`[PLAYER] ${gid} exception:`, e);
    if (s.queue.length) playNext(gid, client);
  });
  s.player.on('closed', () => {
    destroyState(gid);
  });
}

// ============================================================================
// UI BUILDERS
// ============================================================================

function emb(color, desc) {
  return new EmbedBuilder().setColor(color).setDescription(desc);
}

function fmtTime(ms) {
  if (!ms || ms === Infinity) return 'LIVE';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  const mm = (m % 60).toString().padStart(2, '0');
  if (h > 0) return `${h}:${mm}:${ss}`;
  return `${m}:${ss}`;
}

function progressBar(elapsed, total, size = 18) {
  if (!total) return '\u{25AC}'.repeat(size);
  const pct = Math.min(1, Math.max(0, elapsed / total));
  const filled = Math.floor(pct * size);
  return '\u{25A0}'.repeat(filled) + '\u{25A1}'.repeat(size - filled);
}

function buildNPEmbed(gid, client) {
  const s = getState(gid);
  const t = s.current;

  if (!t) {
    return new EmbedBuilder()
      .setColor(C.DARK)
      .setTitle(`Neural Audio Engine - IDLE`)
      .setDescription(`Queue a track to begin playback.\n\nUse \`/music play\` or \`!play <song>\``)
      .addFields(
        { name: 'Session', value: `\`${s.sess}\``, inline: true },
        { name: 'Volume', value: `\`${s.vol}%\``, inline: true },
        { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop, inline: true },
      )
      .setFooter({ text: `ARCHITECT CG-223 // Neural Audio v4.0 ${EMOJI.FLAG}` })
      .setTimestamp();
  }

  const elapsed = s.player?.position || 0;
  const dur = t.duration || 0;
  const bar = progressBar(elapsed, dur);
  const srcLabel = { spotify: '[SPOTIFY]', youtube: '[YT]', soundcloud: '[SC]', direct: '[URL]', radio: '[RADIO]', url: '[URL]' }[t.source] || '[MUSIC]';

  return new EmbedBuilder()
    .setColor(t.source === 'spotify' ? C.SPOTIFY : C.GREEN)
    .setAuthor({ name: `${EMOJI.NOTE} NOW PLAYING`, iconURL: t.thumb || undefined })
    .setTitle(`${srcLabel} ${t.title?.slice(0, 80) || 'Unknown'}`)
    .setURL(t.uri || null)
    .setDescription(`\`\`\`\n${bar} ${dur ? Math.floor((elapsed/dur)*100) : 0}%\n${fmtTime(elapsed)} / ${fmtTime(dur)}\nSource: ${t.source.toUpperCase()} | Engine: Lavalink\n\`\`\``)
    .addFields(
      { name: 'Artist', value: t.artist?.slice(0, 30) || 'Unknown', inline: true },
      { name: 'Requester', value: `<@${t.reqId}>`, inline: true },
      { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop === 'track' ? 'Track' : 'Queue', inline: true },
      { name: 'Volume', value: `\`${s.vol}%\``, inline: true },
      { name: 'Queue', value: `\`${s.queue.length} tracks\``, inline: true },
      { name: 'Session', value: `\`${s.sess}\``, inline: true },
    )
    .setThumbnail(t.thumb || null)
    .setFooter({ text: `ARCHITECT CG-223 // Voice // BAMAKO_223 ${EMOJI.FLAG}` })
    .setTimestamp();
}

function buildNPButtons(gid) {
  const s = getState(gid);
  const d = (id, emoji, style, disabled = false) =>
    new ButtonBuilder().setCustomId(`music_${id}_${gid}`).setEmoji(emoji).setStyle(style).setDisabled(disabled);

  return [
    new ActionRowBuilder().addComponents(
      d('prev', EMOJI.PREV, ButtonStyle.Secondary, s.history.length < 2),
      d('pp', s.paused ? EMOJI.PLAY : EMOJI.PAUSE, s.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      d('stop', EMOJI.STOP, ButtonStyle.Danger),
      d('skip', EMOJI.SKIP, ButtonStyle.Secondary, s.queue.length === 0),
      d('loop', s.loop === 'off' ? EMOJI.LOOP : EMOJI.LOOP1, s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      d('vd', EMOJI.VOLDN, ButtonStyle.Secondary, s.vol <= 0),
      d('vu', EMOJI.VOLUP, ButtonStyle.Secondary, s.vol >= 200),
      d('shuf', EMOJI.SHUFFLE, ButtonStyle.Secondary, s.queue.length < 2),
      d('q', EMOJI.QUEUE, ButtonStyle.Primary),
      d('dash', EMOJI.DASH, ButtonStyle.Success),
    ),
  ];
}

function buildDashEmbed(gid, client) {
  const s = getState(gid);
  const t = s.current;
  return new EmbedBuilder()
    .setColor(C.ACCENT)
    .setTitle(`${EMOJI.DASH} Neural Audio Dashboard`)
    .setDescription(`Session \`${s.sess}\`\n${t ? `Now: [${t.title}](${t.uri})` : '*Idle*'}`)
    .addFields(
      { name: 'Volume', value: `\`${s.vol}%\``, inline: true },
      { name: 'Loop', value: s.loop, inline: true },
      { name: 'Queue', value: String(s.queue.length), inline: true },
      { name: 'History', value: String(s.history.length), inline: true },
      { name: 'Uptime', value: s.startT ? fmtTime(Date.now() - s.startT) : '-', inline: true },
      { name: 'Status', value: s.paused ? 'Paused' : s.current ? 'Playing' : 'Idle', inline: true },
    )
    .setFooter({ text: `ARCHITECT CG-223 // Dashboard v4.0 ${EMOJI.FLAG}` })
    .setTimestamp();
}

function buildDashComponents(gid) {
  const opts = [
    { l: 'Loop: Off', v: `loop_off_${gid}`, e: EMOJI.X },
    { l: 'Loop: Track', v: `loop_track_${gid}`, e: EMOJI.LOOP1 },
    { l: 'Loop: Queue', v: `loop_queue_${gid}`, e: EMOJI.LOOP },
    { l: 'Vol: 25%', v: `vol_25_${gid}`, e: EMOJI.VOLMUTE },
    { l: 'Vol: 50%', v: `vol_50_${gid}`, e: EMOJI.VOLDN },
    { l: 'Vol: 100%', v: `vol_100_${gid}`, e: EMOJI.VOLUP },
    { l: 'Vol: 150%', v: `vol_150_${gid}`, e: EMOJI.VOLUP },
    { l: 'Clear Queue', v: `clear_${gid}`, e: EMOJI.X },
  ];
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('music_dashboard_select').setPlaceholder('Dashboard Options')
        .addOptions(opts.map(o => ({ label: o.l, value: o.v, emoji: o.e })))
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music_np_${gid}`).setEmoji(EMOJI.NOTE).setLabel('Now Playing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`music_close_${gid}`).setEmoji(EMOJI.X).setLabel('Close').setStyle(ButtonStyle.Danger),
    ),
  ];
}

async function updateNP(gid) {
  const s = getState(gid);
  if (!s.npMsg) return;
  try { await s.npMsg.edit({ embeds: [buildNPEmbed(gid)], components: buildNPButtons(gid) }); } catch {}
}

async function sendNP(gid, ch, client) {
  const s = getState(gid);
  if (s.npMsg) try { await s.npMsg.delete(); } catch {}
  s.npMsg = await ch.send({ embeds: [buildNPEmbed(gid, client)], components: buildNPButtons(gid) });
  if (!s.updInt) {
    s.updInt = setInterval(() => { const st = getState(gid); if (st && st.current && !st.paused) updateNP(gid); }, CFG.NP_MS);
  }
}

async function sendDashboard(gid, ch, client) {
  const s = getState(gid);
  if (s.dashMsg) try { await s.dashMsg.delete(); } catch {}
  s.dashMsg = await ch.send({ embeds: [buildDashEmbed(gid, client)], components: buildDashComponents(gid) });
}

// ============================================================================
// SEARCH MENU
// ============================================================================

async function sendSearchMenu(ch, q, requester, gid, client) {
  const loading = await ch.send({ embeds: [emb(C.ACCENT, `${EMOJI.SEARCH} Searching Spotify for \`${q.slice(0, 60)}\`...`)] });
  const results = await resolveSearch(q);

  if (!results || !results.length) {
    // Fallback: Lavalink direct search
    try {
      const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
      const targetNode = node || Array.from(client.shoukaku.nodes.values())[0];
      if (targetNode) {
        const res = await targetNode.rest.resolve(`ytsearch:${q}`);
        if (res?.data?.length) {
          const tracks = (Array.isArray(res.data) ? res.data : [res.data]).slice(0, CFG.SEARCH_RES).map((t, i) => ({
            title: t.info?.title || 'Unknown', artist: t.info?.author || 'YouTube',
            duration: t.info?.length || 0, thumb: null, uri: t.info?.uri,
            source: 'youtube', label: (t.info?.title || 'Unknown').slice(0, 100),
            desc: `${fmtTime(t.info?.length)} - YouTube`.slice(0, 100),
            searchQ: t.info?.uri, encoded: t.encoded, idx: i + 1,
          }));
          await renderSearchResults(loading, tracks, q, gid);
          return;
        }
      }
    } catch (e) {}
    await loading.edit({ embeds: [emb(C.WARN, `${EMOJI.WARN} No results found for \`${q}\`\n\nTips:\n- Check spelling\n- Try a different query\n- Add Spotify credentials for better search`)] });
    return;
  }

  await renderSearchResults(loading, results, q, gid);
}

async function renderSearchResults(msg, results, q, gid) {
  const embed = new EmbedBuilder()
    .setColor(C.SPOTIFY)
    .setTitle(`${EMOJI.SEARCH} Results: "${q.slice(0, 50)}"`)
    .setDescription(`Found ${results.length} tracks. Select one:`)
    .setFooter({ text: `ARCHITECT CG-223 // Search` })
    .setTimestamp();

  const opts = results.map(r => ({
    label: r.label, description: r.desc, value: JSON.stringify({ g: gid, q: r.searchQ, t: r.title, a: r.artist, d: r.duration, u: r.uri, th: r.thumb, s: r.source, e: r.encoded || '' }),
    emoji: EMOJI.NOTE,
  }));

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder().setCustomId(`music_search_${gid}`).setPlaceholder('Select a track...').addOptions(opts)
  );

  await msg.edit({ embeds: [embed], components: [row] });
}

// ============================================================================
// COMPONENT HANDLERS (exported)
// ============================================================================

async function handleComponent(interaction, client) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const parts = id.split('_');
  const action = parts[1];
  const gid = parts[2];
  if (!gid) return false;

  const s = getState(gid);

  // Search select menu
  if (action === 'search') {
    return handleSearchSelect(interaction, client);
  }

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'pp': {
      if (!s.player) break;
      if (s.paused) { await s.player.resume(); s.paused = false; }
      else { await s.player.pause(); s.paused = true; }
      break;
    }
    case 'stop': {
      destroyState(gid);
      await interaction.editReply({ embeds: [emb(C.DARK, `${EMOJI.STOP} Stopped.`)], components: [] }).catch(() => {});
      return true;
    }
    case 'skip': {
      if (s.player) s.player.stopTrack();
      break;
    }
    case 'prev': {
      if (s.history.length >= 2) {
        s.queue.unshift(s.current);
        s.current = s.history[s.history.length - 2];
        s.history = s.history.slice(0, -2);
        if (s.player && s.current) {
          await s.player.playTrack({ track: s.current.encoded });
          s.startT = Date.now(); s.paused = false;
        }
      }
      break;
    }
    case 'loop': {
      const modes = ['off', 'track', 'queue'];
      s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
      break;
    }
    case 'vd':
    case 'vu': {
      s.vol = Math.max(0, Math.min(200, s.vol + (action === 'vu' ? 10 : -10)));
      if (s.player) await s.player.setGlobalVolume(s.vol);
      break;
    }
    case 'shuf': {
      for (let i = s.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]];
      }
      break;
    }
    case 'q': break;
    case 'dash': { await sendDashboard(gid, interaction.channel, client); break; }
    case 'close': {
      await interaction.editReply({ embeds: [emb(C.DARK, 'Dashboard closed.')], components: [] }).catch(() => {});
      s.dashMsg = null; return true;
    }
    case 'np': { await sendNP(gid, interaction.channel, client); break; }
  }

  updateNP(gid);
  if (s.dashMsg) try { await s.dashMsg.edit({ embeds: [buildDashEmbed(gid, client)], components: buildDashComponents(gid) }); } catch {}
  return true;
}

async function handleSearchSelect(interaction, client) {
  let data;
  try { data = JSON.parse(interaction.values[0]); } catch { return false; }
  const { g: gid, q, t, a, d, u, th, s: src, e } = data;
  if (!gid || !q) return false;

  await interaction.deferUpdate().catch(() => {});

  const track = {
    id: Math.random().toString(36).slice(2, 12),
    title: t || 'Unknown', artist: a || 'Unknown',
    duration: d || 0, uri: u, source: src || 'youtube',
    thumb: th || null, searchQ: q, encoded: e || null,
    requester: interaction.user.tag, reqId: interaction.user.id,
    addedAt: Date.now(),
  };

  const vc = interaction.member?.voice?.channel;
  if (!vc) {
    await interaction.editReply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Join a voice channel first!`)] }).catch(() => {});
    return true;
  }

  const st = getState(gid);
  st.txtCh = interaction.channel;

  try {
    if (!st.conn || st.conn.state !== 1) {
      if (st.conn) try { st.conn.disconnect(); } catch {}
      st.conn = await client.shoukaku.joinVoiceChannel({ guildId: gid, channelId: vc.id, shardId: 0, deaf: true, mute: false });
      st.player = st.conn;
      setupPlayerEvents(gid, client);
    }

    if (st.current) {
      st.queue.push(track);
      await interaction.editReply({ embeds: [emb(C.SPOTIFY, `${EMOJI.CHECK} Added to queue: [${track.title}](${track.uri})\n${track.artist} | ${st.queue.length} in queue`)] }).catch(() => {});
    } else {
      await playNext(gid, client);
      // Inject current track
      st.current = track;
      try {
        const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
        const targetNode = node || Array.from(client.shoukaku.nodes.values())[0];
        if (targetNode) {
          const res = await targetNode.rest.resolve(track.searchQ);
          if (res?.data?.length) {
            const ld = Array.isArray(res.data) ? res.data[0] : res.data;
            st.current = { ...track, encoded: ld.encoded, uri: ld.info?.uri || track.uri, duration: ld.info?.length || track.duration, title: ld.info?.title || track.title, artist: ld.info?.author || track.artist };
          }
        }
        if (st.current?.encoded) {
          await st.player.playTrack({ track: st.current.encoded });
          st.startT = Date.now(); st.paused = false;
          st.history.push(st.current);
        }
      } catch (e) { console.error('[SEARCH PLAY]', e.message); }
      await sendNP(gid, interaction.channel, client);
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.PLAY} Now Playing: [${st.current?.title || track.title}](${st.current?.uri || track.uri})\n${st.current?.artist || track.artist}`)] }).catch(() => {});
    }
  } catch (e) {
    console.error('[SEARCH VC]', e.message);
    await interaction.editReply({ embeds: [emb(C.RED, `${EMOJI.RED} Voice connection failed: ${e.message}`)] }).catch(() => {});
  }
  return true;
}

async function handleSelectMenu(interaction, client) {
  if (interaction.customId !== 'music_dashboard_select') return false;
  const val = interaction.values[0];
  const parts = val.split('_');
  const action = parts[0];
  const gid = parts[parts.length - 1];
  const s = getState(gid);

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'loop': { s.loop = parts[1]; break; }
    case 'vol': {
      s.vol = parseInt(parts[1]);
      if (s.player) await s.player.setGlobalVolume(s.vol);
      break;
    }
    case 'clear': { s.queue = []; break; }
  }

  if (s.dashMsg) try { await s.dashMsg.edit({ embeds: [buildDashEmbed(gid, client)], components: buildDashComponents(gid) }); } catch {}
  updateNP(gid);
  return true;
}

// ============================================================================
// SLASH DATA
// ============================================================================

const slashData = new SlashCommandBuilder()
  .setName('music').setDescription('Neural Audio Engine v4.0 - Music streaming')
  .addSubcommand(s => s.setName('play').setDescription('Play a track').addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true)))
  .addSubcommand(s => s.setName('search').setDescription('Search and select').addStringOption(o => o.setName('query').setDescription('What to search').setRequired(true)))
  .addSubcommand(s => s.setName('skip').setDescription('Skip current track'))
  .addSubcommand(s => s.setName('stop').setDescription('Stop and disconnect'))
  .addSubcommand(s => s.setName('pause').setDescription('Pause playback'))
  .addSubcommand(s => s.setName('resume').setDescription('Resume playback'))
  .addSubcommand(s => s.setName('queue').setDescription('Show queue'))
  .addSubcommand(s => s.setName('volume').setDescription('Set volume').addIntegerOption(o => o.setName('level').setDescription('0-200').setMinValue(0).setMaxValue(200).setRequired(true)))
  .addSubcommand(s => s.setName('loop').setDescription('Toggle loop mode'))
  .addSubcommand(s => s.setName('nowplaying').setDescription('Show now playing'))
  .addSubcommand(s => s.setName('disconnect').setDescription('Disconnect from voice'));

// ============================================================================
// COMMAND ROUTER (prefix)
// ============================================================================

async function runPrefix(client, message, args, db, usedCommand, settings, lang) {
  let cmd, rest;
  if (usedCommand === 'music') { cmd = args[0]?.toLowerCase() || ''; rest = args.slice(1); }
  else { cmd = usedCommand?.toLowerCase() || ''; rest = args; }

  const gid = message.guild?.id;
  if (!gid) return message.reply('Music commands work in servers only.');

  const vc = message.member?.voice?.channel;
  const noVc = ['queue', 'q', 'nowplaying', 'np', 'dashboard', 'search'];
  if (!vc && !noVc.includes(cmd)) {
    return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Join a voice channel first!`)] });
  }

  const s = getState(gid);
  s.txtCh = message.channel;

  switch (cmd) {
    case 'play':
    case 'p': {
      const q = rest.join(' ');
      if (!q) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Provide a song name or URL.\n\nExamples:\n!play never gonna give you up\n!play https://open.spotify.com/track/...`)] });
      const loading = await message.reply({ embeds: [emb(C.ACCENT, `${EMOJI.SEARCH} Resolving \`${q.slice(0, 60)}\`...`)] });
      const track = await resolveTrack(q, message.author);

      try {
        if (!s.conn || s.conn.state !== 1) {
          if (s.conn) try { s.conn.disconnect(); } catch {}
          s.conn = await client.shoukaku.joinVoiceChannel({ guildId: gid, channelId: vc.id, shardId: 0, deaf: true, mute: false });
          s.player = s.conn;
          setupPlayerEvents(gid, client);
        }

        if (s.current) {
          s.queue.push(track);
          loading.edit({ embeds: [emb(C.SPOTIFY, `${EMOJI.CHECK} Added: [${track.title}](${track.uri})\n${track.artist} | ${s.queue.length} in queue`)] });
        } else {
          s.current = track;
          if (track.searchQ && !track.encoded) {
            const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
            const targetNode = node || Array.from(client.shoukaku.nodes.values())[0];
            if (targetNode) {
              const res = await targetNode.rest.resolve(track.searchQ);
              if (res?.data?.length) {
                const ld = Array.isArray(res.data) ? res.data[0] : res.data;
                s.current = { ...track, encoded: ld.encoded, uri: ld.info?.uri || track.uri, duration: ld.info?.length || track.duration, title: ld.info?.title || track.title, artist: ld.info?.author || track.artist };
              }
            }
          }
          if (s.current?.encoded) {
            await s.player.playTrack({ track: s.current.encoded });
            s.startT = Date.now(); s.paused = false;
            s.history.push(s.current);
          }
          loading.delete().catch(() => {});
          await sendNP(gid, message.channel, client);
        }
      } catch (e) {
        loading.edit({ embeds: [emb(C.RED, `${EMOJI.RED} Connection failed: ${e.message}`)] });
      }
      break;
    }

    case 'search': {
      const q = rest.join(' ');
      if (!q) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Provide a search query.\nExample: !search never gonna give you up`)] });
      await sendSearchMenu(message.channel, q, message.author, gid, client);
      break;
    }

    case 'skip':
    case 's': {
      if (!s.current) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      if (s.player) s.player.stopTrack();
      message.reply({ embeds: [emb(C.GREEN, `${EMOJI.SKIP} Skipped!`)] });
      break;
    }

    case 'stop': {
      destroyState(gid);
      message.reply({ embeds: [emb(C.DARK, `${EMOJI.STOP} Neural Audio Engine stopped.`)] });
      break;
    }

    case 'pause': {
      if (!s.player) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      await s.player.pause(); s.paused = true;
      message.reply({ embeds: [emb(C.GOLD, `${EMOJI.PAUSE} Paused`)] });
      break;
    }

    case 'resume': {
      if (!s.player) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      await s.player.resume(); s.paused = false;
      message.reply({ embeds: [emb(C.GREEN, `${EMOJI.PLAY} Resumed`)] });
      break;
    }

    case 'queue':
    case 'q': {
      if (!s.current && !s.queue.length) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Queue is empty!`)] });
      const em = new EmbedBuilder().setColor(C.ACCENT).setTitle(`${EMOJI.QUEUE} Queue - ${s.queue.length + (s.current ? 1 : 0)} tracks`);
      if (s.current) em.addFields({ name: 'Now Playing', value: `[${s.current.title}](${s.current.uri}) - ${s.current.artist}` });
      const list = s.queue.slice(0, 15).map((t, i) => `\`${i + 1}.\` [${t.title}](${t.uri}) - ${t.artist}`).join('\n');
      if (list) em.addFields({ name: 'Up Next', value: list.slice(0, 1024) });
      if (s.queue.length > 15) em.addFields({ name: '...', value: `+${s.queue.length - 15} more` });
      message.reply({ embeds: [em] });
      break;
    }

    case 'volume':
    case 'vol': {
      const v = parseInt(rest[0]);
      if (isNaN(v) || v < 0 || v > 200) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Volume: 0-200`)] });
      s.vol = v;
      if (s.player) await s.player.setGlobalVolume(v);
      message.reply({ embeds: [emb(C.GREEN, `${EMOJI.VOLUP} Volume: ${v}%`)] });
      updateNP(gid);
      break;
    }

    case 'loop': {
      const modes = ['off', 'track', 'queue'];
      s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
      message.reply({ embeds: [emb(C.GREEN, `${EMOJI.LOOP} Loop: ${s.loop}`)] });
      updateNP(gid);
      break;
    }

    case 'nowplaying':
    case 'np': {
      if (!s.current) return message.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      await sendNP(gid, message.channel, client);
      break;
    }

    case 'dashboard': {
      await sendDashboard(gid, message.channel, client);
      break;
    }

    case 'disconnect':
    case 'dc': {
      destroyState(gid);
      message.reply({ embeds: [emb(C.GREEN, `${EMOJI.CHECK} Disconnected.`)] });
      break;
    }

    default: {
      message.reply({ embeds: [emb(C.ACCENT,
        `${EMOJI.NOTE} Neural Audio Engine v4.0\n\n` +
        `\`!play <query>\` - Play a track\n` +
        `\`!search <query>\` - Search with menu\n` +
        `\`!skip\` - Skip current\n` +
        `\`!stop\` - Stop and clear\n` +
        `\`!pause / !resume\` - Playback control\n` +
        `\`!queue\` - Show queue\n` +
        `\`!volume <0-200>\` - Set volume\n` +
        `\`!loop\` - Toggle loop\n` +
        `\`!nowplaying\` - Show player\n` +
        `\`!dashboard\` - Control panel\n` +
        `\`!disconnect\` - Leave voice\n\n` +
        `Supports: Spotify, YouTube, SoundCloud, URLs`
      )] });
    }
  }
}

// ============================================================================
// SLASH HANDLER
// ============================================================================

async function executeSlash(interaction, client) {
  const action = interaction.options.getSubcommand();
  const gid = interaction.guild.id;
  const vc = interaction.member?.voice?.channel;
  const s = getState(gid);
  s.txtCh = interaction.channel;

  const noVc = ['queue', 'nowplaying'];
  if (!vc && !noVc.includes(action)) {
    return interaction.reply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Join a voice channel first!`)], ephemeral: true });
  }

  await interaction.deferReply();

  switch (action) {
    case 'play': {
      const q = interaction.options.getString('query');
      await interaction.editReply({ embeds: [emb(C.ACCENT, `${EMOJI.SEARCH} Resolving \`${q?.slice(0, 60)}\`...`)] });
      const track = await resolveTrack(q, interaction.user);

      try {
        if (!s.conn || s.conn.state !== 1) {
          if (s.conn) try { s.conn.disconnect(); } catch {}
          s.conn = await client.shoukaku.joinVoiceChannel({ guildId: gid, channelId: vc.id, shardId: 0, deaf: true, mute: false });
          s.player = s.conn;
          setupPlayerEvents(gid, client);
        }

        if (s.current) {
          s.queue.push(track);
          await interaction.editReply({ embeds: [emb(C.SPOTIFY, `${EMOJI.CHECK} Added: [${track.title}](${track.uri})\n${track.artist} | ${s.queue.length} in queue`)] });
        } else {
          s.current = track;
          if (track.searchQ && !track.encoded) {
            const node = client.shoukaku.options.nodeResolver(client.shoukaku.nodes);
            const targetNode = node || Array.from(client.shoukaku.nodes.values())[0];
            if (targetNode) {
              const res = await targetNode.rest.resolve(track.searchQ);
              if (res?.data?.length) {
                const ld = Array.isArray(res.data) ? res.data[0] : res.data;
                s.current = { ...track, encoded: ld.encoded, uri: ld.info?.uri || track.uri, duration: ld.info?.length || track.duration, title: ld.info?.title || track.title, artist: ld.info?.author || track.artist };
              }
            }
          }
          if (s.current?.encoded) {
            await s.player.playTrack({ track: s.current.encoded });
            s.startT = Date.now(); s.paused = false;
            s.history.push(s.current);
          }
          await sendNP(gid, interaction.channel, client);
          await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.PLAY} Now Playing: [${s.current?.title || track.title}](${s.current?.uri || track.uri})\n${s.current?.artist || track.artist}`)] });
        }
      } catch (e) {
        await interaction.editReply({ embeds: [emb(C.RED, `${EMOJI.RED} Connection failed: ${e.message}`)] });
      }
      break;
    }

    case 'search': {
      const q = interaction.options.getString('query');
      await interaction.editReply({ embeds: [emb(C.ACCENT, `${EMOJI.SEARCH} Searching \`${q}\`...`)] });
      await sendSearchMenu(interaction.channel, q, interaction.user, gid, client);
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.CHECK} Search results sent below!`)] });
      break;
    }

    case 'skip': {
      if (!s.current) return interaction.editReply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      if (s.player) s.player.stopTrack();
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.SKIP} Skipped!`)] });
      break;
    }

    case 'stop': {
      destroyState(gid);
      await interaction.editReply({ embeds: [emb(C.DARK, `${EMOJI.STOP} Stopped.`)] });
      break;
    }

    case 'pause': {
      await s.player.pause(); s.paused = true;
      await interaction.editReply({ embeds: [emb(C.GOLD, `${EMOJI.PAUSE} Paused`)] });
      break;
    }

    case 'resume': {
      await s.player.resume(); s.paused = false;
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.PLAY} Resumed`)] });
      break;
    }

    case 'queue': {
      if (!s.current) return interaction.editReply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Queue empty!`)] });
      const em = new EmbedBuilder().setColor(C.ACCENT).setTitle(`${EMOJI.QUEUE} Queue`)
        .setDescription(s.current ? `Now: [${s.current.title}](${s.current.uri}) - ${s.current.artist}\n` + s.queue.slice(0, 15).map((t, i) => `${i + 1}. [${t.title}](${t.uri})`).join('\n') : 'Empty');
      await interaction.editReply({ embeds: [em] });
      break;
    }

    case 'volume': {
      const v = interaction.options.getInteger('level');
      s.vol = v;
      if (s.player) await s.player.setGlobalVolume(v);
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.VOLUP} Volume: ${v}%`)] });
      updateNP(gid);
      break;
    }

    case 'loop': {
      const modes = ['off', 'track', 'queue'];
      s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.LOOP} Loop: ${s.loop}`)] });
      updateNP(gid);
      break;
    }

    case 'nowplaying': {
      if (!s.current) return interaction.editReply({ embeds: [emb(C.WARN, `${EMOJI.WARN} Nothing playing!`)] });
      await sendNP(gid, interaction.channel, client);
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.CHECK} Now Playing updated!`)] });
      break;
    }

    case 'disconnect': {
      destroyState(gid);
      await interaction.editReply({ embeds: [emb(C.GREEN, `${EMOJI.CHECK} Disconnected!`)] });
      break;
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc',
    'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'search'],
  category: 'MUSIC',
  description: 'Neural Audio Engine v4.0 - Lavalink + shoukaku music system',
  data: slashData,
  run: runPrefix,
  execute: executeSlash,
  handleComponent,
  handleSelectMenu,
  initLavalink,
};

console.log('Neural Audio Engine v4.0 loaded - shoukaku v4 + Lavalink');
