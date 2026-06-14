/**
 * ARCHITECT CG-223 // NEURAL AUDIO ENGINE v4.0
 * Lavalink-based streaming with proxy support
 * Hetzner-safe, cookie-free
 *
 * By: Moussa Fofana // Node BAMAKO_223
 */

'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, ChannelType, SlashCommandBuilder
} = require('discord.js');
const { Connectors, Shoukaku } = require('shoukaku');

// ============================================================================
//  COLORS
// ============================================================================

const C = {
  GREEN: 0x00ff88, DARK: 0x0a0a0a, ACCENT: 0x00d4ff,
  WARN: 0xff6b35, RED: 0xe74c3c, GOLD: 0xf1c40f,
};

const CONFIG = {
  MAX_QUEUE: 100, HISTORY_SIZE: 50, IDLE_TIMEOUT: 300000,
  NP_UPDATE_MS: 10000, VOLUME_DEFAULT: 100, SEARCH_RESULTS: 10,
};

// ============================================================================
//  LAVALINK SETUP
// ============================================================================

const LAVALINK_NODES = [{
  name: 'BAMAKO-NODE',
  host: process.env.LAVALINK_HOST || 'localhost',
  port: parseInt(process.env.LAVALINK_PORT || '2333'),
  auth: process.env.LAVALINK_PASSWORD || 'archon-223-secure',
  secure: false,
}];

let shoukaku = null;

function initLavalink(client) {
  const connector = new Connectors.DiscordJS(client);
  shoukaku = new Shoukaku(connector, LAVALINK_NODES, {
    moveOnDisconnect: false,
    resume: true,
    resumeByLibrary: true,
    reconnectTries: 10,
    reconnectInterval: 5000,
    restTimeout: 30000,
  });

  shoukaku.on('error', (_, err) => console.error('[LAVALINK] Error:', err.message));
  shoukaku.on('ready', (name) => console.log('[LAVALINK] Node ready:', name));
  shoukaku.on('close', (name, code) => console.log('[LAVALINK] Node closed:', name, code));
  shoukaku.on('disconnect', (name, count) => console.log('[LAVALINK] Disconnect:', name, count));

  return shoukaku;
}

function getNode() {
  if (!shoukaku) return null;
  if (shoukaku.nodes && shoukaku.nodes.size > 0) return shoukaku.nodes.first();
  return null;
}

// ============================================================================
//  AUDIO STATE
// ============================================================================

const audioStates = new Map();

function getState(guildId) {
  if (!audioStates.has(guildId)) {
    audioStates.set(guildId, {
      guildId, queue: [], current: null, player: null,
      volume: CONFIG.VOLUME_DEFAULT, loop: 'off', paused: false,
      stageInstance: null, nowPlayingMsg: null, dashboardMsg: null,
      textChannel: null, requester: null, startTime: null,
      history: [], isStage: false, status: 'IDLE',
      sessionId: Math.random().toString(36).slice(2, 10).toUpperCase(),
      _updateInterval: null,
    });
  }
  return audioStates.get(guildId);
}

function destroyState(guildId) {
  const s = audioStates.get(guildId);
  if (!s) return;
  if (s._updateInterval) { clearInterval(s._updateInterval); s._updateInterval = null; }
  if (s.player) try { s.player.destroy(); } catch {}
  audioStates.delete(guildId);
}

// ============================================================================
//  STAGE CHANNEL
// ============================================================================

async function setupStage(guildId, voiceChannel, topic) {
  const s = getState(guildId);
  if (voiceChannel.type !== ChannelType.GuildStageVoice) { s.isStage = false; return false; }
  s.isStage = true;
  try {
    const existing = voiceChannel.guild.stageInstances.cache.find(si => si.channelId === voiceChannel.id);
    if (existing) { s.stageInstance = existing; await existing.edit({ topic }); }
    else { s.stageInstance = await voiceChannel.createStageInstance({ topic, privacyLevel: 2, sendStartNotification: false }); }
    const me = voiceChannel.guild.members.me;
    if (me && me.voice) await me.voice.setSuppressed(false).catch(() => {});
    return true;
  } catch (err) { console.error('[STAGE]', guildId, err.message); return false; }
}

// ============================================================================
//  PLAYBACK ENGINE
// ============================================================================

async function playTrack(guildId, track) {
  const s = getState(guildId);
  if (!s.player) throw new Error('Not connected to voice.');

  try {
    await s.player.playTrack({ track: track.encoded });
    s.current = track;
    s.status = 'PLAYING';
    s.startTime = Date.now();
    s.paused = false;
    s.player.setVolume(s.volume / 100);
    s.history.push(track);
    if (s.history.length > CONFIG.HISTORY_SIZE) s.history.shift();
    updateNowPlaying(guildId);
  } catch (err) {
    console.error('[PLAY ERR]', guildId, err.message);
    s.current = null;
    if (s.queue.length > 0) playNext(guildId);
  }
}

async function playNext(guildId) {
  const s = getState(guildId);
  if (s.queue.length === 0) { s.current = null; s.status = 'IDLE'; updateNowPlaying(guildId); return; }
  await playTrack(guildId, s.queue.shift());
}

async function connectVoice(guildId, voiceChannel, textChannel) {
  const s = getState(guildId);
  s.textChannel = textChannel;
  if (s.player) { try { s.player.destroy(); } catch {} s.player = null; }

  const node = getNode();
  if (!node) throw new Error('Lavalink not connected.');

  const player = await node.joinChannel({
    guildId: guildId,
    channelId: voiceChannel.id,
    shardId: 0,
    deaf: true,
    mute: false,
  });

  s.player = player;
  s.isStage = voiceChannel.type === ChannelType.GuildStageVoice;

  player.on('end', (event) => {
    if (event.reason === 'replaced') return;
    const st = getState(guildId);
    if (st.loop === 'track' && st.current) playTrack(guildId, st.current);
    else if (st.queue.length > 0) playNext(guildId);
    else {
      st.current = null; st.status = 'IDLE';
      updateNowPlaying(guildId);
      setTimeout(() => {
        const f = getState(guildId);
        if (f && f.status === 'IDLE' && f.queue.length === 0) destroyState(guildId);
      }, CONFIG.IDLE_TIMEOUT);
    }
  });

  player.on('exception', (err) => {
    console.error('[LAVALINK EXC]', guildId, err);
    const st = getState(guildId);
    st.current = null;
    if (st.queue.length > 0) playNext(guildId);
  });

  return player;
}

// ============================================================================
//  TRACK LOADING
// ============================================================================

async function loadTrack(query, requester) {
  const node = getNode();
  if (!node) throw new Error('Lavalink not connected');

  let searchQuery = query;
  if (!query.startsWith('http')) searchQuery = 'ytsearch:' + query;

  const result = await node.rest.resolve(searchQuery);
  if (!result || !result.tracks || result.tracks.length === 0) {
    throw new Error('No results found for `' + query + '`');
  }

  const t = result.tracks[0];
  return {
    id: Math.random().toString(36).slice(2, 12),
    title: t.info.title || 'Unknown',
    artist: t.info.author || 'Unknown',
    duration: t.info.length || 0,
    url: t.info.uri,
    thumbnail: t.info.thumbnail || t.info.artworkUrl || null,
    source: t.info.sourceName || 'unknown',
    requester: requester?.tag || 'Unknown',
    requesterId: requester?.id || '0',
    addedAt: Date.now(),
    encoded: t.track,
  };
}

async function loadMultiple(query, limit, requester) {
  const node = getNode();
  if (!node) throw new Error('Lavalink not connected');

  let searchQuery = query;
  if (!query.startsWith('http')) searchQuery = 'ytsearch:' + query;

  const result = await node.rest.resolve(searchQuery);
  if (!result || !result.tracks || result.tracks.length === 0) return null;

  return result.tracks.slice(0, limit).map((t, i) => ({
    id: Math.random().toString(36).slice(2, 12),
    title: t.info.title || 'Unknown',
    artist: t.info.author || 'Unknown',
    duration: t.info.length || 0,
    url: t.info.uri,
    thumbnail: t.info.thumbnail || t.info.artworkUrl || null,
    source: t.info.sourceName || 'unknown',
    requester: requester?.tag || 'Unknown',
    requesterId: requester?.id || '0',
    addedAt: Date.now(),
    encoded: t.track,
    index: i + 1,
    label: (t.info.title || 'Unknown').substring(0, 100),
    description: ((t.info.length ? fmtTime(t.info.length) : 'LIVE') + ' - ' + (t.info.author || 'Unknown')).substring(0, 100),
    emoji: '\uD83C\uDFB5',
  }));
}

// ============================================================================
//  TIME FORMATTER
// ============================================================================

function fmtTime(ms) {
  if (!ms || ms === Infinity) return 'LIVE';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return h + ':' + (m % 60).toString().padStart(2, '0') + ':' + (s % 60).toString().padStart(2, '0');
  return m + ':' + (s % 60).toString().padStart(2, '0');
}

// ============================================================================
//  NOW PLAYING PANEL
// ============================================================================

function buildNPEmbed(guildId) {
  const s = getState(guildId);
  const track = s.current;

  if (!track) {
    return new EmbedBuilder()
      .setColor(C.DARK)
      .setTitle('Neural Audio Engine - IDLE')
      .setDescription('Queue a track to begin playback.\n\nTip: Use `/music play query:song name` or `!play song name`')
      .addFields(
        { name: 'Session', value: '`' + s.sessionId + '`', inline: true },
        { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
        { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop, inline: true },
      )
      .setFooter({ text: 'ARCHITECT CG-223 // Neural Audio v4.0' })
      .setTimestamp();
  }

  const elapsed = s.startTime ? Date.now() - s.startTime : 0;
  const dur = track.duration || 0;
  const pct = dur > 0 ? Math.min(100, (elapsed / dur) * 100) : 0;
  const filled = Math.floor((pct / 100) * 18);
  const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(18 - filled);

  return new EmbedBuilder()
    .setColor(C.GREEN)
    .setAuthor({ name: s.isStage ? 'LIVE STAGE BROADCAST' : 'NOW PLAYING', iconURL: track.thumbnail || undefined })
    .setTitle((track.title || 'Unknown').substring(0, 80))
    .setURL(track.url || null)
    .setDescription('```\n' + bar + ' ' + pct.toFixed(0) + '%\n' + fmtTime(elapsed) + ' / ' + fmtTime(dur) + '\nSource: ' + (track.source || 'unknown').toUpperCase() + ' | Engine: Lavalink\n```')
    .addFields(
      { name: 'Artist', value: (track.artist || 'Unknown').substring(0, 30), inline: true },
      { name: 'Requester', value: '<@' + track.requesterId + '>', inline: true },
      { name: 'Loop', value: s.loop === 'off' ? 'Off' : s.loop === 'track' ? 'Track' : 'Queue', inline: true },
      { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
      { name: 'Queue', value: '`' + s.queue.length + ' tracks`', inline: true },
      { name: 'Session', value: '`' + s.sessionId + '`', inline: true },
    )
    .setThumbnail(track.thumbnail || null)
    .setFooter({ text: 'ARCHITECT CG-223 // ' + (s.isStage ? 'Stage' : 'Voice') + ' // BAMAKO_223' })
    .setTimestamp();
}

function buildNPButtons(guildId) {
  const s = getState(guildId);
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_prev_' + guildId).setEmoji('\u23EE\uFE0F').setStyle(ButtonStyle.Secondary).setDisabled(s.history.length < 2),
      new ButtonBuilder().setCustomId('music_pp_' + guildId).setEmoji(s.paused ? '\u25B6\uFE0F' : '\u23F8\uFE0F').setStyle(s.paused ? ButtonStyle.Success : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_stop_' + guildId).setEmoji('\u23F9\uFE0F').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId('music_next_' + guildId).setEmoji('\u23ED\uFE0F').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length === 0),
      new ButtonBuilder().setCustomId('music_loop_' + guildId).setEmoji(s.loop === 'off' ? '\uD83D\uDD01' : s.loop === 'track' ? '\uD83D\uDD02' : '\uD83D\uDD01').setStyle(s.loop === 'off' ? ButtonStyle.Secondary : ButtonStyle.Success),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_vd_' + guildId).setEmoji('\uD83D\uDD09').setStyle(ButtonStyle.Secondary).setDisabled(s.volume <= 0),
      new ButtonBuilder().setCustomId('music_vu_' + guildId).setEmoji('\uD83D\uDD0A').setStyle(ButtonStyle.Secondary).setDisabled(s.volume >= 200),
      new ButtonBuilder().setCustomId('music_shuf_' + guildId).setEmoji('\uD83D\uDD00').setStyle(ButtonStyle.Secondary).setDisabled(s.queue.length < 2),
      new ButtonBuilder().setCustomId('music_q_' + guildId).setEmoji('\uD83D\uDCDC').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_dash_' + guildId).setEmoji('\uD83C\uDF9B\uFE0F').setLabel('Dashboard').setStyle(ButtonStyle.Success),
    ),
  ];
}

async function updateNowPlaying(guildId) {
  const s = getState(guildId);
  if (!s.nowPlayingMsg) return;
  try { await s.nowPlayingMsg.edit({ embeds: [buildNPEmbed(guildId)], components: buildNPButtons(guildId) }); } catch {}
}

// ============================================================================
//  DASHBOARD
// ============================================================================

function buildDashEmbed(guildId) {
  const s = getState(guildId);
  const track = s.current;
  return new EmbedBuilder()
    .setColor(C.ACCENT)
    .setTitle('Neural Audio Dashboard')
    .setDescription('Session `' + s.sessionId + '`\n' + (track ? 'Now: [' + track.title + '](' + track.url + ')' : '*Idle*'))
    .addFields(
      { name: 'Volume', value: '`' + s.volume + '%`', inline: true },
      { name: 'Loop', value: s.loop, inline: true },
      { name: 'Stage', value: s.isStage ? 'Active' : 'Off', inline: true },
      { name: 'Queue', value: String(s.queue.length), inline: true },
      { name: 'History', value: String(s.history.length), inline: true },
      { name: 'Uptime', value: s.startTime ? fmtTime(Date.now() - s.startTime) : '-', inline: true },
    )
    .setFooter({ text: 'ARCHITECT CG-223 // Dashboard v4.0' })
    .setTimestamp();
}

function buildDashComponents(guildId) {
  const s = getState(guildId);
  return [
    new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder().setCustomId('music_dashboard_select').setPlaceholder('Dashboard Options')
        .addOptions(
          { label: 'Loop: Off', value: 'loop_off_' + guildId, emoji: '\u274C' },
          { label: 'Loop: Track', value: 'loop_track_' + guildId, emoji: '\uD83D\uDD02' },
          { label: 'Loop: Queue', value: 'loop_queue_' + guildId, emoji: '\uD83D\uDD01' },
          { label: 'Volume: 25%', value: 'vol_25_' + guildId, emoji: '\uD83D\uDD08' },
          { label: 'Volume: 50%', value: 'vol_50_' + guildId, emoji: '\uD83D\uDD09' },
          { label: 'Volume: 100%', value: 'vol_100_' + guildId, emoji: '\uD83D\uDD0A' },
          { label: 'Volume: 150%', value: 'vol_150_' + guildId, emoji: '\uD83D\uDD0A' },
          { label: 'Clear Queue', value: 'clear_' + guildId, emoji: '\uD83D\uDDD1\uFE0F' },
        ),
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('music_np_' + guildId).setEmoji('\uD83C\uDFB5').setLabel('Now Playing').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('music_close_' + guildId).setEmoji('\u274C').setLabel('Close').setStyle(ButtonStyle.Danger),
    ),
  ];
}

// ============================================================================
//  SEARCH MENU
// ============================================================================

const searchCache = new Map();

async function sendSearchMenu(channel, query, requester, guildId) {
  const loading = await channel.send({
    embeds: [new EmbedBuilder().setColor(C.ACCENT).setDescription('Searching: `' + query.substring(0, 60) + '`...')]
  });

  const results = await loadMultiple(query, CONFIG.SEARCH_RESULTS, requester);
  if (!results || results.length === 0) {
    await loading.edit({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('No results for `' + query + '`')] });
    return null;
  }

  const embed = new EmbedBuilder()
    .setColor(C.GREEN)
    .setTitle('Search: "' + query.substring(0, 50) + '"')
    .setDescription('Found ' + results.length + ' tracks. Select one:')
    .setFooter({ text: 'ARCHITECT CG-223 // Lavalink' })
    .setTimestamp();

  const select = new StringSelectMenuBuilder()
    .setCustomId('music_search_' + guildId + '_' + Date.now())
    .setPlaceholder('Select a track...')
    .addOptions(results.map(r => {
      const cacheId = Math.random().toString(36).slice(2, 10);
      searchCache.set(cacheId, r);
      setTimeout(() => searchCache.delete(cacheId), 300000);
      return {
        label: r.label,
        description: r.description,
        value: cacheId,
        emoji: '\uD83C\uDFB5',
      };
    }));

  await loading.edit({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
  return results;
}

// ============================================================================
//  COMPONENT HANDLERS
// ============================================================================

async function handleComponent(interaction) {
  const id = interaction.customId;
  if (!id.startsWith('music_')) return false;

  const gid = interaction.guild.id;
  const s = getState(gid);
  const action = id.split('_')[1];

  if (action === 'search') return handleSearchSelection(interaction, gid);

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'pp': {
      if (!s.player) break;
      if (s.paused) { await s.player.setPaused(false); s.paused = false; }
      else { await s.player.setPaused(true); s.paused = true; }
      break;
    }
    case 'stop': {
      destroyState(gid);
      await interaction.editReply({ embeds: [new EmbedBuilder().setColor(C.DARK).setDescription('Stopped.')], components: [] }).catch(() => {});
      return true;
    }
    case 'next': { if (s.player) s.player.stopTrack(); break; }
    case 'prev': {
      if (s.history.length >= 2) {
        s.queue.unshift(s.current);
        s.current = s.history[s.history.length - 2];
        s.history = s.history.slice(0, -2);
        await playTrack(gid, s.current);
      }
      break;
    }
    case 'loop': {
      const modes = ['off', 'track', 'queue'];
      s.loop = modes[(modes.indexOf(s.loop) + 1) % 3];
      break;
    }
    case 'vd': case 'vu': {
      s.volume = Math.max(0, Math.min(200, s.volume + (action === 'vu' ? 10 : -10)));
      if (s.player) await s.player.setVolume(s.volume / 100);
      break;
    }
    case 'shuf': {
      for (let i = s.queue.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [s.queue[i], s.queue[j]] = [s.queue[j], s.queue[i]];
      }
      break;
    }
    case 'dash': { await sendDashboard(gid, interaction.channel); break; }
    case 'close': { s.dashboardMsg = null; break; }
    case 'np': { await sendNowPlaying(gid, interaction.channel); break; }
  }

  updateNowPlaying(gid);
  if (s.dashboardMsg) try { await s.dashboardMsg.edit({ embeds: [buildDashEmbed(gid)], components: buildDashComponents(gid) }); } catch {}
  return true;
}

async function handleSearchSelection(interaction, guildId) {
  const s = getState(guildId);
  const cacheId = interaction.values[0];
  const track = searchCache.get(cacheId);
  if (!track) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Search expired.')], ephemeral: true }).catch(() => {});
    return true;
  }
  searchCache.delete(cacheId);

  const vc = interaction.member.voice.channel;
  if (!vc) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel!')], ephemeral: true }).catch(() => {});
    return true;
  }

  try {
    if (!s.player || s.player.state !== 'CONNECTED') {
      await connectVoice(guildId, vc, interaction.channel);
    }

    if (s.current) {
      s.queue.push(track);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription('Queued: [' + track.title + '](' + track.url + ')')] }).catch(() => {});
    } else {
      await playTrack(guildId, track);
      await sendNowPlaying(gid, interaction.channel);
      await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.GREEN).setDescription('Now Playing: [' + track.title + '](' + track.url + ')')] }).catch(() => {});
    }
  } catch (err) {
    await interaction.reply({ embeds: [new EmbedBuilder().setColor(C.RED).setDescription(err.message)], ephemeral: true }).catch(() => {});
  }
  return true;
}

async function handleSelectMenu(interaction) {
  if (interaction.customId !== 'music_dashboard_select') return false;

  const parts = interaction.values[0].split('_');
  const action = parts[0];
  const gid = parts[parts.length - 1];
  const s = getState(gid);

  await interaction.deferUpdate().catch(() => {});

  switch (action) {
    case 'loop': { s.loop = parts[1]; break; }
    case 'vol': {
      s.volume = parseInt(parts[1]);
      if (s.player) await s.player.setVolume(s.volume / 100);
      break;
    }
    case 'clear': { s.queue = []; break; }
  }

  if (s.dashboardMsg) try { await s.dashboardMsg.edit({ embeds: [buildDashEmbed(gid)], components: buildDashComponents(gid) }); } catch {}
  updateNowPlaying(gid);
  return true;
}

// ============================================================================
//  EXPORTS
// ============================================================================

module.exports = {
  name: 'music',
  aliases: ['play', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc',
    'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'search'],
  category: 'MUSIC',
  description: 'Neural Audio v4.0 Lavalink - Professional music streaming',
  data: new SlashCommandBuilder()
    .setName('music').setDescription('Neural Audio v4.0 - Lavalink music streaming')
    .addSubcommand(s => s.setName('play').setDescription('Play a track').addStringOption(o => o.setName('query').setDescription('Song name or URL').setRequired(true)))
    .addSubcommand(s => s.setName('search').setDescription('Search and pick').addStringOption(o => o.setName('query').setDescription('Search query').setRequired(true)))
    .addSubcommand(s => s.setName('skip').setDescription('Skip current'))
    .addSubcommand(s => s.setName('stop').setDescription('Stop'))
    .addSubcommand(s => s.setName('pause').setDescription('Pause'))
    .addSubcommand(s => s.setName('resume').setDescription('Resume'))
    .addSubcommand(s => s.setName('queue').setDescription('Show queue'))
    .addSubcommand(s => s.setName('volume').setDescription('Set volume').addIntegerOption(o => o.setName('level').setDescription('0-200').setMinValue(0).setMaxValue(200).setRequired(true)))
    .addSubcommand(s => s.setName('loop').setDescription('Toggle loop'))
    .addSubcommand(s => s.setName('nowplaying').setDescription('Show player'))
    .addSubcommand(s => s.setName('disconnect').setDescription('Leave voice')),

  handleComponent,
  handleSelectMenu,
  initLavalink,

  // Prefix commands
  run: async (client, message, args, db, usedCommand, settings, lang) => {
    let cmd, rest;
    if (usedCommand === 'music') { cmd = args[0]?.toLowerCase(); rest = args.slice(1); }
    else { cmd = usedCommand?.toLowerCase(); rest = args; }

    const gid = message.guild?.id;
    if (!gid) return message.reply('Server only.');

    const member = message.member;
    const vc = member.voice.channel;
    const noVc = ['queue', 'q', 'nowplaying', 'np', 'dashboard', 'search'];

    if (!vc && !noVc.includes(cmd)) {
      return message.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel first!')] });
    }

    const s = getState(gid);
    s.textChannel = message.channel;
    const e = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (cmd) {
      case 'play': case 'p': {
        const query = rest.join(' ');
        if (!query) return message.reply({ embeds: [e(C.WARN, 'Provide a query!')] });
        const loading = await message.reply({ embeds: [e(C.ACCENT, 'Loading: `' + query.substring(0, 60) + '`...')] });
        try {
          const track = await loadTrack(query, message.author);
          if (!s.player || s.player.state !== 'CONNECTED') await connectVoice(gid, vc, message.channel);
          if (s.current) { s.queue.push(track); loading.edit({ embeds: [e(C.GREEN, 'Queued: [' + track.title + '](' + track.url + ')')] }); }
          else { await playTrack(gid, track); loading.delete().catch(() => {}); await sendNowPlaying(gid, message.channel); }
        } catch (err) { loading.edit({ embeds: [e(C.RED, err.message)] }); }
        break;
      }
      case 'search': { await sendSearchMenu(message.channel, rest.join(' '), message.author, gid); break; }
      case 'skip': case 's': { if (!s.current) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] }); if (s.player) s.player.stopTrack(); message.reply({ embeds: [e(C.GREEN, 'Skipped!')] }); break; }
      case 'stop': { destroyState(gid); message.reply({ embeds: [e(C.DARK, 'Stopped.')] }); break; }
      case 'pause': { if (s.player) { s.player.setPaused(true); s.paused = true; } message.reply({ embeds: [e(C.GOLD, 'Paused')] }); break; }
      case 'resume': { if (s.player) { s.player.setPaused(false); s.paused = false; } message.reply({ embeds: [e(C.GREEN, 'Resumed')] }); break; }
      case 'queue': case 'q': { if (!s.current) return message.reply({ embeds: [e(C.WARN, 'Queue empty!')] }); const em = new EmbedBuilder().setColor(C.ACCENT).setTitle('Queue - ' + (s.queue.length + 1) + ' tracks'); em.addFields({ name: 'Now', value: '[' + s.current.title + '](' + s.current.url + ')' }); const list = s.queue.slice(0, 15).map((t, i) => '`' + (i + 1) + '.` [' + t.title + '](' + t.url + ')').join('\n'); if (list) em.addFields({ name: 'Up Next', value: list.substring(0, 1024) }); message.reply({ embeds: [em] }); break; }
      case 'volume': case 'vol': { const vol = parseInt(rest[0]); if (isNaN(vol) || vol < 0 || vol > 200) return message.reply({ embeds: [e(C.WARN, '0-200')] }); s.volume = vol; if (s.player) await s.player.setVolume(vol / 100); message.reply({ embeds: [e(C.GREEN, 'Volume: ' + vol + '%')] }); updateNowPlaying(gid); break; }
      case 'loop': { const modes = ['off', 'track', 'queue']; s.loop = modes[(modes.indexOf(s.loop) + 1) % 3]; message.reply({ embeds: [e(C.GREEN, 'Loop: ' + s.loop)] }); updateNowPlaying(gid); break; }
      case 'nowplaying': case 'np': { if (!s.current) return message.reply({ embeds: [e(C.WARN, 'Nothing playing!')] }); await sendNowPlaying(gid, message.channel); break; }
      case 'dashboard': { await sendDashboard(gid, message.channel); break; }
      case 'disconnect': case 'dc': { destroyState(gid); message.reply({ embeds: [e(C.GREEN, 'Disconnected.')] }); break; }
      default: { message.reply({ embeds: [e(C.ACCENT, '!play, !search, !skip, !stop, !pause, !resume, !queue, !volume, !loop, !nowplaying, !dashboard, !disconnect')] }); }
    }
  },

  // Slash commands
  execute: async (interaction, client) => {
    const action = interaction.options.getSubcommand();
    const gid = interaction.guild.id;
    const vc = interaction.member.voice.channel;
    const s = getState(gid);
    s.textChannel = interaction.channel;

    const noVc = ['queue', 'nowplaying'];
    if (!vc && !noVc.includes(action)) {
      return interaction.reply({ embeds: [new EmbedBuilder().setColor(C.WARN).setDescription('Join a voice channel!')], ephemeral: true });
    }

    await interaction.deferReply();
    const e = (color, desc) => new EmbedBuilder().setColor(color).setDescription(desc);

    switch (action) {
      case 'play': {
        const query = interaction.options.getString('query');
        try {
          const track = await loadTrack(query, interaction.user);
          if (!s.player || s.player.state !== 'CONNECTED') await connectVoice(gid, vc, interaction.channel);
          if (s.current) { s.queue.push(track); await interaction.editReply({ embeds: [e(C.GREEN, 'Queued: [' + track.title + '](' + track.url + ')')] }); }
          else { await playTrack(gid, track); await sendNowPlaying(gid, interaction.channel); await interaction.editReply({ embeds: [e(C.GREEN, 'Now Playing: [' + track.title + '](' + track.url + ')')] }); }
        } catch (err) { await interaction.editReply({ embeds: [e(C.RED, err.message)] }); }
        break;
      }
      case 'search': { await sendSearchMenu(interaction.channel, interaction.options.getString('query'), interaction.user, gid); await interaction.editReply({ embeds: [e(C.GREEN, 'Pick a track!')] }); break; }
      case 'skip': { if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Nothing!')] }); if (s.player) s.player.stopTrack(); await interaction.editReply({ embeds: [e(C.GREEN, 'Skipped!')] }); break; }
      case 'stop': { destroyState(gid); await interaction.editReply({ embeds: [e(C.DARK, 'Stopped.')] }); break; }
      case 'pause': { if (s.player) { s.player.setPaused(true); s.paused = true; } await interaction.editReply({ embeds: [e(C.GOLD, 'Paused')] }); break; }
      case 'resume': { if (s.player) { s.player.setPaused(false); s.paused = false; } await interaction.editReply({ embeds: [e(C.GREEN, 'Resumed')] }); break; }
      case 'queue': { if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Empty!')] }); const em = new EmbedBuilder().setColor(C.ACCENT).setTitle('Queue').setDescription('Now: [' + s.current.title + '](' + s.current.url + ')\n' + s.queue.slice(0, 15).map((t, i) => (i + 1) + '. [' + t.title + '](' + t.url + ')').join('\n')); await interaction.editReply({ embeds: [em] }); break; }
      case 'volume': { const vol = interaction.options.getInteger('level'); s.volume = vol; if (s.player) await s.player.setVolume(vol / 100); await interaction.editReply({ embeds: [e(C.GREEN, 'Volume: ' + vol + '%')] }); updateNowPlaying(gid); break; }
      case 'loop': { const modes = ['off', 'track', 'queue']; s.loop = modes[(modes.indexOf(s.loop) + 1) % 3]; await interaction.editReply({ embeds: [e(C.GREEN, 'Loop: ' + s.loop)] }); updateNowPlaying(gid); break; }
      case 'nowplaying': { if (!s.current) return interaction.editReply({ embeds: [e(C.WARN, 'Nothing!')] }); await sendNowPlaying(gid, interaction.channel); await interaction.editReply({ embeds: [e(C.GREEN, 'Updated!')] }); break; }
      case 'disconnect': { destroyState(gid); await interaction.editReply({ embeds: [e(C.GREEN, 'Disconnected!')] }); break; }
    }
  },
};

console.log('Neural Audio Engine v4.0 loaded - Lavalink + Proxy');
