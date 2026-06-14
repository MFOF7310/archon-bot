// ============================================================
// ARCHITECT CG-223 — Music Engine v5.2 (Native play-dl)
// No Lavalink. No Shoukaku. Pure @discordjs/voice + play-dl.
// ============================================================

const {
  joinVoiceChannel, createAudioPlayer, createAudioResource,
  AudioPlayerStatus, VoiceConnectionStatus, StreamType,
  entersState, getVoiceConnection
} = require('@discordjs/voice');

const {
  SlashCommandBuilder, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  PermissionFlagsBits, ComponentType, MessageFlags
} = require('discord.js');

const play = require('play-dl');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// ── Config ──────────────────────────────────────────────────
const TOPGG_TOKEN = process.env.TOPGG_TOKEN || '';
const BOT_ID = process.env.BOT_ID || '';
const YT_PROXY = process.env.YT_PROXY || '';
const YT_BYPASS = process.env.YT_BYPASS || 'none'; // 'proxy' | 'cookie' | 'none'

const MAX_QUEUE = 100;
const LEAVE_EMPTY_MINUTES = 3;
const VOTE_BYPASS_USERS = ['816668279962681427']; // Bot owner

// ── Source Emojis ────────────────────────────────────────────
const SOURCE_EMOJI = {
  youtube: '<:youtube:1322878906998882344>',
  soundcloud: '<:soundcloud:1322878885490221056>',
  spotify: '<:spotify:1322878863772946442>',
  default: '\uD83C\uDFB5'
};

// ── Per-Guild Queues ────────────────────────────────────────
const queues = new Map();

class GuildQueue {
  constructor(guildId) {
    this.guildId = guildId;
    this.songs = [];
    this.player = null;
    this.connection = null;
    this.npMessage = null;
    this.dashMessage = null;
    this.loopMode = 0; // 0=off, 1=track, 2=queue
    this.volume = 100;
    this.history = [];
    this.leaveTimer = null;
    this.isPaused = false;
  }

  async connect(channel) {
    this.connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: true,
      selfMute: false
    });

    this.connection.on(VoiceConnectionStatus.Disconnected, async () => {
      try {
        await Promise.race([
          entersState(this.connection, VoiceConnectionStatus.Signalling, 5_000),
          entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000)
        ]);
      } catch {
        this.destroy();
      }
    });

    // Log connection state changes for debugging
    this.connection.on('stateChange', (oldState, newState) => {
      console.log(`[VOICE] ${channel.guild.id}: ${oldState.status} → ${newState.status}`);
      if (newState.status === VoiceConnectionStatus.Ready) {
        console.log(`[VOICE] ${channel.guild.id}: Connected to ${channel.name}`);
      }
      if (newState.status === VoiceConnectionStatus.Destroyed) {
        console.log(`[VOICE] ${channel.guild.id}: Connection destroyed`);
      }
    });

    this.player = createAudioPlayer();
    this.connection.subscribe(this.player);

    this.player.on(AudioPlayerStatus.Idle, () => this.onTrackEnd());
    this.player.on('error', err => console.error('[AUDIO ERROR]', err.message));

    return entersState(this.connection, VoiceConnectionStatus.Ready, 30_000);
  }

  async play(song) {
    try {
      console.log(`[PLAY] Getting stream for: ${truncate(song.title, 50)}`);
      const stream = await YouTubeBypass.getStream(song.url, song.source);
      const resource = createAudioResource(stream, {
        inputType: StreamType.Arbitrary,
        inlineVolume: true
      });
      if (resource.volume) resource.volume.setVolume(this.volume / 100);
      this.player.play(resource);
      this.isPaused = false;
      console.log(`[PLAY] Started playing: ${truncate(song.title, 50)}`);
      await this.updateNP(song);
    } catch (err) {
      console.error('[PLAY ERROR]', err.message);
      // Notify the channel that playback failed
      if (this.npMessage?.channel) {
        const failEmbed = new EmbedBuilder()
          .setDescription(`\u274C Failed to play **[${truncate(song.title, 60)}](${song.url})**\n\n**Error:** \`${err.message.slice(0, 200)}\`\n\n*Try again or use a different query. If this persists, your proxy may be blocked by YouTube.*`)
          .setColor(0xFF3366);
        this.npMessage.channel.send({ embeds: [failEmbed] }).catch(() => {});
      }
      this.onTrackEnd(true);
    }
  }

  onTrackEnd(skipped = false) {
    if (this.loopMode === 1 && !skipped) {
      this.play(this.songs[0]);
      return;
    }
    if (this.songs.length > 0) {
      this.history.unshift(this.songs.shift());
      if (this.history.length > 50) this.history.pop();
    }
    if (this.songs.length === 0) {
      if (this.loopMode === 2 && this.history.length > 0) {
        this.songs = [...this.history.reverse()];
        this.history = [];
        this.play(this.songs[0]);
        return;
      }
      this.startLeaveTimer();
      this.updateNP(null);
      return;
    }
    this.play(this.songs[0]);
  }

  startLeaveTimer() {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    this.leaveTimer = setTimeout(() => this.destroy(), LEAVE_EMPTY_MINUTES * 60_000);
  }

  destroy() {
    if (this.leaveTimer) clearTimeout(this.leaveTimer);
    if (this.player) this.player.stop();
    if (this.connection) this.connection.destroy();
    queues.delete(this.guildId);
  }

  async updateNP(song) {
    if (!this.npMessage) return;
    try {
      if (!song) {
        await this.npMessage.edit({ embeds: [new EmbedBuilder()
          .setDescription('\u23F3  Queue ended. Add more songs!')
          .setColor(0x5b5b5b)], components: [] });
        return;
      }
      const { embed, row1, row2 } = buildNPEmbed(song, this);
      await this.npMessage.edit({ embeds: [embed], components: [row1, row2] });
    } catch (e) { /* ignore */ }
  }

  async updateDash() {
    if (!this.dashMessage) return;
    try {
      const { embed, row } = buildDashEmbed(this);
      await this.dashMessage.edit({ embeds: [embed], components: [row] });
    } catch (e) { /* ignore */ }
  }
}

function getQueue(guildId) {
  if (!queues.has(guildId)) queues.set(guildId, new GuildQueue(guildId));
  return queues.get(guildId);
}

// ── YouTube Bypass (Proxy / Cookie / Fallback) ──────────────
class YouTubeBypass {
  static async getStream(url, source) {
    // SoundCloud direct
    if (source === 'soundcloud' || url.includes('soundcloud.com')) {
      const so = await play.soundcloud(url);
      return await play.stream_from_info(so);
    }

    // Spotify → search YouTube
    if (source === 'spotify' || url.includes('spotify.com')) {
      const sp = await play.spotify(url);
      const q = `${sp.name} ${sp.artists?.[0]?.name || ''}`.trim();
      const yt = await play.search(q, { limit: 1, source: { youtube: 'video' } });
      if (!yt.length) throw new Error('No YouTube match for Spotify track');
      return this._ytStream(yt[0].url);
    }

    // YouTube with bypass
    return this._ytStream(url);
  }

  static async _ytStream(url) {
    // Strategy 1: Proxy
    if (YT_BYPASS === 'proxy' && YT_PROXY) {
      try {
        const stream = await play.stream(url, {
          quality: 2,
          discordPlayerCompatibility: true,
          requestOptions: { agent: this._proxyAgent() }
        });
        return stream.stream;
      } catch (e) { console.log('[YT] Proxy failed, trying direct...'); }
    }

    // Strategy 2: Direct (sometimes works on Hetzner)
    try {
      const stream = await play.stream(url, { quality: 2, discordPlayerCompatibility: true });
      return stream.stream;
    } catch (e) { console.log('[YT] Direct failed, trying cookie...'); }

    // Strategy 3: Cookie jar if cookies.txt exists
    const cookiePath = path.join(process.cwd(), 'cookies.txt');
    if (fs.existsSync(cookiePath)) {
      try {
        const cookies = fs.readFileSync(cookiePath, 'utf8');
        const stream = await play.stream(url, {
          quality: 2,
          discordPlayerCompatibility: true,
          requestOptions: { headers: { Cookie: cookies } }
        });
        return stream.stream;
      } catch (e) { console.log('[YT] Cookie failed, trying yt-dlp fallback...'); }
    }

    // Strategy 4: yt-dlp child process fallback
    try {
      return this._ytDlpStream(url);
    } catch (e) {
      throw new Error('All YouTube bypass strategies failed. Try a different query or check proxy.');
    }
  }

  static _proxyAgent() {
    const proxyUrl = new URL(YT_PROXY);
    const isHttps = proxyUrl.protocol === 'https:';
    const agentModule = isHttps ? https : http;
    return new agentModule.Agent({
      host: proxyUrl.hostname,
      port: parseInt(proxyUrl.port) || (isHttps ? 443 : 80),
      auth: proxyUrl.username && proxyUrl.password
        ? `${decodeURIComponent(proxyUrl.username)}:${decodeURIComponent(proxyUrl.password)}`
        : undefined
    });
  }

  static _ytDlpStream(url) {
    return new Promise((resolve, reject) => {
      const args = [
        '-f', 'bestaudio[ext=webm]/bestaudio/best',
        '--no-playlist',
        '-o', '-',
        '--quiet',
        '--no-warnings',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        '--extractor-args', 'youtube:player_client=web'
      ];

      // Pass proxy to yt-dlp if configured
      if (YT_BYPASS === 'proxy' && YT_PROXY) {
        args.push('--proxy', YT_PROXY);
        args.push('--no-check-certificates'); // Some proxies have SSL issues
        console.log('[YT] Passing proxy to yt-dlp:', YT_PROXY.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
      }

      args.push(url);

      const ytdlp = spawn('yt-dlp', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let stderr = '';

      ytdlp.on('error', (err) => reject(new Error(`yt-dlp spawn failed: ${err.message}`)));
      ytdlp.stderr.on('data', d => {
        const chunk = d.toString();
        stderr += chunk;
        console.log('[yt-dlp]', chunk.slice(0, 200));
      });

      // Give yt-dlp 20s to start producing data
      const timer = setTimeout(() => {
        ytdlp.kill();
        reject(new Error(`yt-dlp timeout (20s). Stderr: ${stderr.slice(0, 300)}`));
      }, 20000);

      ytdlp.stdout.once('data', () => {
        clearTimeout(timer);
        console.log('[YT] yt-dlp started streaming audio');
        resolve(ytdlp.stdout);
      });

      ytdlp.on('exit', (code) => {
        if (code !== 0 && code !== null) {
          clearTimeout(timer);
          reject(new Error(`yt-dlp exited with code ${code}. Stderr: ${stderr.slice(0, 300)}`));
        }
      });
    });
  }

  static async search(query, limit = 10) {
    // Try YouTube first
    try {
      const results = await play.search(query, { limit, source: { youtube: 'video' } });
      if (results.length) {
        return results.map(v => ({
          title: v.title || 'Unknown',
          url: v.url,
          duration: v.durationInSec || 0,
          thumbnail: v.thumbnails?.[0]?.url || '',
          author: v.channel?.name || 'Unknown',
          source: 'youtube'
        }));
      }
    } catch (e) { console.log('[Search] YouTube failed, trying SoundCloud...'); }

    // Fallback: SoundCloud
    try {
      const results = await play.search(query, { limit, source: { soundcloud: 'tracks' } });
      if (results.length) {
        return results.map(t => ({
          title: t.name || 'Unknown',
          url: t.permalink_url || t.url,
          duration: Math.floor(t.duration / 1000) || 0,
          thumbnail: t.artwork_url || '',
          author: t.user?.username || 'Unknown',
          source: 'soundcloud'
        }));
      }
    } catch (e) { console.log('[Search] SoundCloud also failed'); }

    return [];
  }
}

// ── Vote Guard ──────────────────────────────────────────────
async function checkVote(userId) {
  if (!TOPGG_TOKEN || !BOT_ID) return true; // No vote guard if not configured
  if (VOTE_BYPASS_USERS.includes(userId)) return true;
  try {
    const res = await fetch(`https://top.gg/api/bots/${BOT_ID}/check?userId=${userId}`, {
      headers: { Authorization: TOPGG_TOKEN }
    });
    const data = await res.json();
    return data.voted === 1;
  } catch {
    return true; // Fail open
  }
}

function voteGuardEmbed() {
  return new EmbedBuilder()
    .setTitle('\uD83D\uDD12 Vote Required')
    .setDescription('You need to **[vote for ARCHITECT on Top.gg](https://top.gg/bot/' + BOT_ID + '/vote)** to use music commands!\n\n*Voting is free and helps us grow.*')
    .setColor(0xFF3366)
    .setImage('https://top.gg/images/dblnew.png');
}

// ── Formatting Helpers ──────────────────────────────────────
function formatTime(sec) {
  if (!sec || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function buildProgressBar(current, total, size = 15) {
  if (!total) return '`[■■■■■■■■■■■■■■■]`';
  const pct = Math.min(current / total, 1);
  const filled = Math.floor(pct * size);
  const empty = size - filled;
  return '`[' + '█'.repeat(filled) + '░'.repeat(empty) + ']`';
}

function truncate(str, max) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max - 3) + '...' : str;
}

// ── Embed Builders ──────────────────────────────────────────
function buildNPEmbed(song, q) {
  const isPaused = q.isPaused;
  const status = isPaused ? '\u23F8\uFE0F Paused' : '\u25B6\uFE0F Playing';
  const loopEmoji = q.loopMode === 1 ? ' \uD83D\uDD02' : q.loopMode === 2 ? ' \uD83D\uDD01' : '';

  const embed = new EmbedBuilder()
    .setAuthor({ name: status + loopEmoji, iconURL: 'https://cdn.discordapp.com/emojis/893292935759982652.gif' })
    .setTitle(truncate(song.title, 100))
    .setURL(song.url)
    .setThumbnail(song.thumbnail || 'https://cdn.discordapp.com/embed/avatars/0.png')
    .addFields(
      { name: '\uD83D\uDC64 Channel', value: song.author || 'Unknown', inline: true },
      { name: '\u23F1\uFE0F Duration', value: formatTime(song.duration), inline: true },
      { name: '\uD83D\uDD0A Volume', value: q.volume + '%', inline: true }
    )
    .setFooter({ text: 'Queue: ' + q.songs.length + ' track(s) | History: ' + q.history.length })
    .setColor(isPaused ? 0xFFA500 : 0x5865F2)
    .setTimestamp();

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music_pp_${q.guildId}`).setEmoji(isPaused ? '\u25B6\uFE0F' : '\u23F8\uFE0F').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId(`music_sk_${q.guildId}`).setEmoji('\u23ED\uFE0F').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_st_${q.guildId}`).setEmoji('\u23F9\uFE0F').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`music_lp_${q.guildId}`).setEmoji('\uD83D\uDD02').setStyle(q.loopMode ? ButtonStyle.Success : ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_dash_${q.guildId}`).setEmoji('\uD83D\uDD27').setStyle(ButtonStyle.Secondary)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music_volm_${q.guildId}`).setEmoji('\uD83D\uDD09').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_vdown_${q.guildId}`).setLabel('-10%').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_vup_${q.guildId}`).setLabel('+10%').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_volp_${q.guildId}`).setEmoji('\uD83D\uDD0A').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_shuf_${q.guildId}`).setEmoji('\uD83D\uDD00').setStyle(ButtonStyle.Secondary)
  );

  return { embed, row1, row2 };
}

function buildDashEmbed(q) {
  const songs = q.songs;
  let desc = '';

  if (songs.length === 0) {
    desc = '\uD83D\uDCBF *Queue is empty.*';
  } else {
    songs.slice(0, 15).forEach((s, i) => {
      const emoji = i === 0 ? '\u25B6\uFE0F' : `\`${(i).toString().padStart(2, ' ')}\``;
      const title = truncate(s.title, 45);
      const time = formatTime(s.duration);
      desc += `${emoji} [${title}](${s.url}) \`[${time}]\`\n`;
    });
    if (songs.length > 15) desc += `\n*...and ${songs.length - 15} more*`;
  }

  const embed = new EmbedBuilder()
    .setTitle('\uD83C\uDFBC Music Dashboard')
    .setDescription(desc)
    .addFields(
      { name: 'Loop', value: q.loopMode === 0 ? 'Off' : q.loopMode === 1 ? 'Track' : 'Queue', inline: true },
      { name: 'Volume', value: q.volume + '%', inline: true },
      { name: 'Total', value: formatTime(songs.reduce((a, s) => a + (s.duration || 0), 0)), inline: true }
    )
    .setColor(0x5865F2)
    .setFooter({ text: 'ARCHITECT CG-223 Music System' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`music_refresh_${q.guildId}`).setEmoji('\uD83D\uDDD8\uFE0F').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`music_clear_${q.guildId}`).setEmoji('\uD83D\uDEBD').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`music_np_${q.guildId}`).setEmoji('\uD83C\uDFA4').setStyle(ButtonStyle.Primary)
  );

  return { embed, row };
}

// ── Slash Command Data ──────────────────────────────────────
const slashData = new SlashCommandBuilder()
  .setName('play')
  .setDescription('Play a song from YouTube, SoundCloud, or Spotify')
  .addStringOption(opt =>
    opt.setName('query')
      .setDescription('Song name or URL')
      .setRequired(true)
      .setAutocomplete(true)
  );

// ═════════════════════════════════════════════════════════════
//  CRITICAL: runPrefix — handles !!play, !!skip, etc.
//  NOTE: params: ['message','args','client','usedCommand']
//        is defined in module.exports to match index.js loader
// ═════════════════════════════════════════════════════════════
async function runPrefix(message, args, client, usedCommand) {
  const cmd = (usedCommand || '').toLowerCase();
  const query = (args || []).join(' ').trim();

  // ── !!play / !!p ─────────────────────────────────────────
  if (cmd === 'play' || cmd === 'p') {
    if (!query) return message.reply('Provide a song name or URL. Example: `!!play Never Gonna Give You Up`');

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel) return message.reply('\u274C Join a voice channel first!');

    if (!await checkVote(message.author.id)) {
      return message.reply({ embeds: [voteGuardEmbed()] });
    }

    const perms = voiceChannel.permissionsFor(message.client.user);
    if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.Speak)) {
      return message.reply('\u274C I need **Connect** and **Speak** permissions in that voice channel!');
    }

    await message.channel.sendTyping();
    const results = await YouTubeBypass.search(query, 1);
    if (!results.length) return message.reply('\u274C No results found. Try a different query or check your proxy.');

    const song = results[0];
    const q = getQueue(message.guild.id);

    // Connect if not connected
    if (!q.connection || q.connection.state.status === VoiceConnectionStatus.Destroyed) {
      try {
        await Promise.race([
          q.connect(voiceChannel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Voice connection timeout — run: npm install libsodium-wrappers')), 8000))
        ]);
      } catch (err) {
        return message.reply(`\u274C **Voice connection failed:** ${err.message}`);
      }
    } else if (q.connection.joinConfig.channelId !== voiceChannel.id) {
      q.destroy();
      const fresh = getQueue(message.guild.id);
      try {
        await Promise.race([
          fresh.connect(voiceChannel),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Voice connection timeout — run: npm install libsodium-wrappers')), 8000))
        ]);
      } catch (err) {
        return message.reply(`\u274C **Voice connection failed:** ${err.message}`);
      }
    }

    const freshQ = getQueue(message.guild.id);
    const wasEmpty = freshQ.songs.length === 0;
    freshQ.songs.push(song);

    // Send added confirmation
    const addEmbed = new EmbedBuilder()
      .setAuthor({ name: 'Added to Queue', iconURL: message.author.displayAvatarURL() })
      .setTitle(truncate(song.title, 100))
      .setURL(song.url)
      .setThumbnail(song.thumbnail || '')
      .addFields(
        { name: 'Channel', value: song.author, inline: true },
        { name: 'Duration', value: formatTime(song.duration), inline: true },
        { name: 'Position', value: `#${freshQ.songs.length}`, inline: true }
      )
      .setColor(0x00FF88)
      .setFooter({ text: SOURCE_EMOJI[song.source] || SOURCE_EMOJI.default });

    const addMsg = await message.reply({ embeds: [addEmbed] });

    if (wasEmpty) {
      await freshQ.play(song);
      const { embed, row1, row2 } = buildNPEmbed(song, freshQ);
      const npMsg = await message.channel.send({ embeds: [embed], components: [row1, row2] });
      freshQ.npMessage = npMsg;
    }
    return;
  }

  // ── !!skip / !!s ──────────────────────────────────────────
  if (cmd === 'skip' || cmd === 's') {
    const q = getQueue(message.guild.id);
    if (!q.player) return message.reply('\u274C Nothing is playing!');
    q.player.stop();
    return message.react('\u23ED\uFE0F');
  }

  // ── !!stop ────────────────────────────────────────────────
  if (cmd === 'stop') {
    const q = getQueue(message.guild.id);
    if (!q.connection) return message.reply('\u274C Not in a voice channel!');
    q.destroy();
    return message.react('\u23F9\uFE0F');
  }

  // ── !!disconnect / !!dc ──────────────────────────────────
  if (cmd === 'disconnect' || cmd === 'dc') {
    const q = getQueue(message.guild.id);
    if (!q.connection) return message.reply('\u274C Not in a voice channel!');
    q.destroy();
    return message.react('\uD83D\uDC4B');
  }

  // ── !!queue / !!q ─────────────────────────────────────────
  if (cmd === 'queue' || cmd === 'q') {
    const q = getQueue(message.guild.id);
    if (!q.songs.length) return message.reply('\uD83D\uDCBF Queue is empty.');
    const { embed, row } = buildDashEmbed(q);
    const dashMsg = await message.reply({ embeds: [embed], components: [row] });
    q.dashMessage = dashMsg;
    return;
  }

  // ── !!np / !!nowplaying ──────────────────────────────────
  if (cmd === 'np' || cmd === 'nowplaying') {
    const q = getQueue(message.guild.id);
    if (!q.songs.length) return message.reply('\u274C Nothing is playing!');
    const { embed, row1, row2 } = buildNPEmbed(q.songs[0], q);
    const npMsg = await message.reply({ embeds: [embed], components: [row1, row2] });
    q.npMessage = npMsg;
    return;
  }

  // ── !!pause ───────────────────────────────────────────────
  if (cmd === 'pause') {
    const q = getQueue(message.guild.id);
    if (!q.player || q.isPaused) return message.reply('\u274C Not playing or already paused!');
    q.player.pause();
    q.isPaused = true;
    await q.updateNP(q.songs[0]);
    return message.react('\u23F8\uFE0F');
  }

  // ── !!resume ──────────────────────────────────────────────
  if (cmd === 'resume') {
    const q = getQueue(message.guild.id);
    if (!q.player || !q.isPaused) return message.reply('\u274C Not paused!');
    q.player.unpause();
    q.isPaused = false;
    await q.updateNP(q.songs[0]);
    return message.react('\u25B6\uFE0F');
  }

  // ── !!volume / !!vol ─────────────────────────────────────
  if (cmd === 'volume' || cmd === 'vol') {
    const q = getQueue(message.guild.id);
    if (!args[0]) return message.reply(`\uD83D\uDD0A Current volume: **${q.volume}%**`);
    const vol = parseInt(args[0]);
    if (isNaN(vol) || vol < 0 || vol > 200) return message.reply('\u274C Volume must be 0-200!');
    q.volume = vol;
    if (q.player?.state?.resource?.volume) {
      q.player.state.resource.volume.setVolume(vol / 100);
    }
    await q.updateNP(q.songs[0]);
    return message.reply(`\uD83D\uDD0A Volume set to **${vol}%**`);
  }

  // ── !!loop ────────────────────────────────────────────────
  if (cmd === 'loop') {
    const q = getQueue(message.guild.id);
    const mode = args[0]?.toLowerCase();
    if (mode === 'track' || mode === '1') q.loopMode = 1;
    else if (mode === 'queue' || mode === 'all' || mode === '2') q.loopMode = 2;
    else if (mode === 'off' || mode === '0') q.loopMode = 0;
    else q.loopMode = (q.loopMode + 1) % 3;

    const labels = ['Off', 'Track', 'Queue'];
    return message.reply(`\uD83D\uDD02 Loop mode: **${labels[q.loopMode]}**`);
  }

  // ── !!shuffle ─────────────────────────────────────────────
  if (cmd === 'shuffle') {
    const q = getQueue(message.guild.id);
    if (q.songs.length < 3) return message.reply('\u274C Need at least 3 songs to shuffle!');
    const current = q.songs.shift();
    for (let i = q.songs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [q.songs[i], q.songs[j]] = [q.songs[j], q.songs[i]];
    }
    q.songs.unshift(current);
    return message.react('\uD83D\uDD00');
  }

  // ── !!search ──────────────────────────────────────────────
  if (cmd === 'search') {
    if (!query) return message.reply('Provide a search query. Example: `!!search lo-fi hip hop`');
    await message.channel.sendTyping();
    const results = await YouTubeBypass.search(query, 10);
    if (!results.length) return message.reply('\u274C No results found.');

    const options = results.slice(0, 10).map((r, i) => ({
      label: truncate(r.title, 100),
      description: `${r.author} • ${formatTime(r.duration)}`,
      value: `${i}`,
      emoji: SOURCE_EMOJI[r.source] || SOURCE_EMOJI.default
    }));

    const menu = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`music_search_${message.guild.id}_${Date.now()}`)
        .setPlaceholder('Select a song to play...')
        .addOptions(options)
    );

    // Store results temporarily on client for lookup
    if (!client._musicSearch) client._musicSearch = new Map();
    client._musicSearch.set(message.author.id, results);

    const embed = new EmbedBuilder()
      .setTitle(`\uD83D\uDD0D Results for "${truncate(query, 50)}"`)
      .setDescription(results.map((r, i) => `\`${i + 1}.\` [${truncate(r.title, 60)}](${r.url}) \`[${formatTime(r.duration)}]\``).join('\n'))
      .setColor(0x5865F2)
      .setFooter({ text: 'Select a track from the menu below' });

    return message.reply({ embeds: [embed], components: [menu] });
  }

  // ── !!dashboard ───────────────────────────────────────────
  if (cmd === 'dashboard') {
    const q = getQueue(message.guild.id);
    const { embed, row } = buildDashEmbed(q);
    const dashMsg = await message.reply({ embeds: [embed], components: [row] });
    q.dashMessage = dashMsg;
    return;
  }
}

// ═════════════════════════════════════════════════════════════
//  Slash: /play
// ═════════════════════════════════════════════════════════════
async function executeSlash(interaction) {
  const query = interaction.options.getString('query', true);
  const voiceChannel = interaction.member?.voice?.channel;

  if (!voiceChannel) {
    return interaction.reply({ content: '\u274C Join a voice channel first!', flags: [MessageFlags.Ephemeral] });
  }

  if (!await checkVote(interaction.user.id)) {
    return interaction.reply({ embeds: [voteGuardEmbed()], flags: [MessageFlags.Ephemeral] });
  }

  // Quick permission check BEFORE deferring
  const perms = voiceChannel.permissionsFor(interaction.client.user);
  if (!perms?.has(PermissionFlagsBits.Connect) || !perms?.has(PermissionFlagsBits.Speak)) {
    return interaction.reply({ content: '\u274C I need **Connect** and **Speak** permissions!', flags: [MessageFlags.Ephemeral] });
  }

  await interaction.deferReply();

  const results = await YouTubeBypass.search(query, 1);
  if (!results.length) {
    return interaction.editReply('\u274C No results found. Try a different query or check your proxy configuration.');
  }

  const song = results[0];
  const q = getQueue(interaction.guild.id);

  if (!q.connection || q.connection.state.status === VoiceConnectionStatus.Destroyed) {
    try {
      // Set a shorter timeout for voice connection to fail fast
      await Promise.race([
        q.connect(voiceChannel),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Voice connection timeout — libsodium-wrappers may not be installed')), 8000))
      ]);
    } catch (err) {
      return interaction.editReply(`\u274C **Voice connection failed:** ${err.message}\n\n**Fix:** Run \`npm install libsodium-wrappers --save\` on your VPS, then \`pm2 delete all && pm2 start index.js\``);
    }
  }

  const freshQ = getQueue(interaction.guild.id);
  const wasEmpty = freshQ.songs.length === 0;
  freshQ.songs.push(song);

  const addEmbed = new EmbedBuilder()
    .setAuthor({ name: 'Added to Queue', iconURL: interaction.user.displayAvatarURL() })
    .setTitle(truncate(song.title, 100))
    .setURL(song.url)
    .setThumbnail(song.thumbnail || '')
    .addFields(
      { name: 'Channel', value: song.author, inline: true },
      { name: 'Duration', value: formatTime(song.duration), inline: true },
      { name: 'Position', value: `#${freshQ.songs.length}`, inline: true }
    )
    .setColor(0x00FF88)
    .setFooter({ text: SOURCE_EMOJI[song.source] || SOURCE_EMOJI.default });

  await interaction.editReply({ embeds: [addEmbed] });

  if (wasEmpty) {
    await freshQ.play(song);
    const { embed, row1, row2 } = buildNPEmbed(song, freshQ);
    const npMsg = await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
    freshQ.npMessage = npMsg;
  }
}

// ═════════════════════════════════════════════════════════════
//  Autocomplete
// ═════════════════════════════════════════════════════════════
async function autocomplete(interaction) {
  const focused = interaction.options.getFocused();
  if (!focused || focused.length < 2) {
    return interaction.respond([
      { name: '\uD83C\uDFB5 Type a song name or paste a YouTube/SoundCloud/Spotify URL...', value: 'help' }
    ]);
  }

  try {
    const results = await YouTubeBypass.search(focused, 7);
    if (!results.length) return interaction.respond([{ name: 'No results found', value: 'none' }]);

    const choices = results.map(r => ({
      name: `${SOURCE_EMOJI[r.source] || ''} ${truncate(r.title, 80)} — ${r.author} [${formatTime(r.duration)}]`,
      value: r.url
    }));
    return interaction.respond(choices.slice(0, 25));
  } catch {
    return interaction.respond([{ name: 'Search error — try again', value: 'error' }]);
  }
}

// ═════════════════════════════════════════════════════════════
//  Button Handler
// ═════════════════════════════════════════════════════════════
async function handleButton(interaction) {
  const customId = interaction.customId;
  if (!customId.startsWith('music_')) return false;

  const q = getQueue(interaction.guild.id);
  const parts = customId.split('_');
  const action = parts[1];

  // Permission: must be in same voice channel
  const memberVC = interaction.member?.voice?.channel;
  if (q.connection && memberVC?.id !== q.connection.joinConfig.channelId) {
    if (!interaction.replied && !interaction.deferred) {
      return interaction.reply({ content: '\u274C Join the bot\'s voice channel to use controls!', flags: [MessageFlags.Ephemeral] });
    }
    return true;
  }

  switch (action) {
    case 'pp': { // play/pause
      if (!q.player) return interaction.reply({ content: '\u274C Nothing playing!', flags: [MessageFlags.Ephemeral] });
      if (q.isPaused) {
        q.player.unpause();
        q.isPaused = false;
      } else {
        q.player.pause();
        q.isPaused = true;
      }
      await q.updateNP(q.songs[0]);
      return interaction.deferUpdate().catch(() => {});
    }

    case 'sk': { // skip
      if (!q.player) return interaction.reply({ content: '\u274C Nothing playing!', flags: [MessageFlags.Ephemeral] });
      q.player.stop();
      return interaction.deferUpdate().catch(() => {});
    }

    case 'st': { // stop
      q.destroy();
      return interaction.reply({ content: '\u23F9\uFE0F Stopped and cleared queue.', flags: [MessageFlags.Ephemeral] });
    }

    case 'lp': { // loop toggle
      q.loopMode = (q.loopMode + 1) % 3;
      const labels = ['Off', 'Track', 'Queue'];
      await q.updateNP(q.songs[0]);
      return interaction.reply({ content: `\uD83D\uDD02 Loop: **${labels[q.loopMode]}**`, flags: [MessageFlags.Ephemeral] });
    }

    case 'volm': { // volume mute
      q.volume = Math.max(0, q.volume - 50);
      if (q.player?.state?.resource?.volume) q.player.state.resource.volume.setVolume(q.volume / 100);
      await q.updateNP(q.songs[0]);
      return interaction.deferUpdate().catch(() => {});
    }

    case 'vdown': { // volume -10
      q.volume = Math.max(0, q.volume - 10);
      if (q.player?.state?.resource?.volume) q.player.state.resource.volume.setVolume(q.volume / 100);
      await q.updateNP(q.songs[0]);
      return interaction.deferUpdate().catch(() => {});
    }

    case 'vup': { // volume +10
      q.volume = Math.min(200, q.volume + 10);
      if (q.player?.state?.resource?.volume) q.player.state.resource.volume.setVolume(q.volume / 100);
      await q.updateNP(q.songs[0]);
      return interaction.deferUpdate().catch(() => {});
    }

    case 'volp': { // volume max
      q.volume = Math.min(200, q.volume + 50);
      if (q.player?.state?.resource?.volume) q.player.state.resource.volume.setVolume(q.volume / 100);
      await q.updateNP(q.songs[0]);
      return interaction.deferUpdate().catch(() => {});
    }

    case 'shuf': { // shuffle
      if (q.songs.length < 3) return interaction.reply({ content: '\u274C Need 3+ songs!', flags: [MessageFlags.Ephemeral] });
      const current = q.songs.shift();
      for (let i = q.songs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [q.songs[i], q.songs[j]] = [q.songs[j], q.songs[i]];
      }
      q.songs.unshift(current);
      return interaction.reply({ content: '\uD83D\uDD00 Shuffled!', flags: [MessageFlags.Ephemeral] });
    }

    case 'dash': { // open dashboard
      const { embed, row } = buildDashEmbed(q);
      const dashMsg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
      q.dashMessage = dashMsg;
      return;
    }

    case 'refresh': { // refresh dashboard
      const fresh = buildDashEmbed(q);
      return interaction.update({ embeds: [fresh.embed], components: [fresh.row] });
    }

    case 'clear': { // clear queue
      if (q.songs.length > 1) q.songs.splice(1);
      return interaction.reply({ content: '\uD83D\uDEBD Queue cleared (except current track).', flags: [MessageFlags.Ephemeral] });
    }

    case 'np': { // show now playing from dash
      if (!q.songs.length) return interaction.reply({ content: '\u274C Nothing playing!', flags: [MessageFlags.Ephemeral] });
      const { embed, row1, row2 } = buildNPEmbed(q.songs[0], q);
      const npMsg = await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
      q.npMessage = npMsg;
      return interaction.deferUpdate().catch(() => {});
    }

    default:
      return false;
  }
}

// ═════════════════════════════════════════════════════════════
//  Select Menu Handler
// ═════════════════════════════════════════════════════════════
async function handleSelectMenu(interaction) {
  const customId = interaction.customId;
  if (!customId.startsWith('music_')) return false;

  const parts = customId.split('_');
  if (parts[1] !== 'search') return false;

  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    return interaction.reply({ content: '\u274C Join a voice channel first!', flags: [MessageFlags.Ephemeral] });
  }

  const results = interaction.client._musicSearch?.get(interaction.user.id);
  if (!results) return interaction.reply({ content: '\u274C Search expired. Run !!search again.', flags: [MessageFlags.Ephemeral] });

  const idx = parseInt(interaction.values[0]);
  const song = results[idx];
  if (!song) return interaction.reply({ content: '\u274C Invalid selection.', flags: [MessageFlags.Ephemeral] });

  await interaction.deferUpdate().catch(() => {});

  const q = getQueue(interaction.guild.id);
  if (!q.connection || q.connection.state.status === VoiceConnectionStatus.Destroyed) {
    await q.connect(voiceChannel);
  }

  const freshQ = getQueue(interaction.guild.id);
  const wasEmpty = freshQ.songs.length === 0;
  freshQ.songs.push(song);

  const addEmbed = new EmbedBuilder()
    .setAuthor({ name: 'Added to Queue', iconURL: interaction.user.displayAvatarURL() })
    .setTitle(truncate(song.title, 100))
    .setURL(song.url)
    .setThumbnail(song.thumbnail || '')
    .addFields(
      { name: 'Channel', value: song.author, inline: true },
      { name: 'Duration', value: formatTime(song.duration), inline: true },
      { name: 'Position', value: `#${freshQ.songs.length}`, inline: true }
    )
    .setColor(0x00FF88);

  await interaction.editReply({ embeds: [addEmbed], components: [] });

  if (wasEmpty) {
    await freshQ.play(song);
    const { embed, row1, row2 } = buildNPEmbed(song, freshQ);
    const npMsg = await interaction.channel.send({ embeds: [embed], components: [row1, row2] });
    freshQ.npMessage = npMsg;
  }

  interaction.client._musicSearch?.delete(interaction.user.id);
  return true;
}

// ═════════════════════════════════════════════════════════════
//  Exports — MUST have .run for index.js plugin loader
// ═════════════════════════════════════════════════════════════
module.exports = {
  name: 'play',
  aliases: ['music', 'p', 'skip', 's', 'queue', 'q', 'stop', 'disconnect', 'dc', 'volume', 'vol', 'loop', 'pause', 'resume', 'np', 'nowplaying', 'dashboard', 'search', 'shuffle'],
  category: 'MUSIC',
  description: 'Play music from YouTube, SoundCloud, and Spotify',
  usage: '<prefix>play <query>',
  params: ['message', 'args', 'client', 'usedCommand'],
  data: slashData,
  run: runPrefix,
  execute: executeSlash,
  autocomplete,
  handleComponent: handleButton,
  handleSelectMenu,
  // initLavalink is called by index.js at boot — no-op since we're native
  initLavalink() {
    console.log('[MUSIC] v5.3 Native Engine ready — no Lavalink needed.');

    // ── Sodium Diagnostic (REQUIRED for voice) ──────────────
    let sodiumOk = false;
    try {
      const sodium = require('sodium-native');
      if (sodium.crypto_secretbox_easy && sodium.crypto_secretbox_open_easy) sodiumOk = true;
      console.log('[MUSIC] sodium-native: OK (preferred)');
    } catch {
      try {
        const libsodium = require('libsodium-wrappers');
        if (libsodium.ready) libsodium.ready.then(() => {
          console.log('[MUSIC] libsodium-wrappers: OK (fallback)');
        }).catch(() => {
          console.log('[MUSIC] libsodium-wrappers: FAILED to initialize');
        });
        else console.log('[MUSIC] libsodium-wrappers: OK (fallback)');
        sodiumOk = true;
      } catch {
        console.log('[MUSIC] libsodium-wrappers: NOT FOUND');
      }
    }
    if (!sodiumOk) {
      console.log('\x1b[31m[MUSIC] FATAL: No sodium encryption library found!\x1b[0m');
      console.log('\x1b[31m[MUSIC] Voice will NOT work. Run: npm install libsodium-wrappers --save\x1b[0m');
      console.log('\x1b[31m[MUSIC] If that fails, try: npm install sodium-native --save\x1b[0m');
    }

    // Validate proxy config
    if (YT_BYPASS === 'proxy' && YT_PROXY) {
      console.log('[MUSIC] YouTube proxy configured:', YT_PROXY.replace(/:\/\/[^:]+:[^@]+@/, '://***:***@'));
    } else if (YT_BYPASS === 'none') {
      console.log('[MUSIC] WARNING: No YouTube bypass configured. Hetzner IPs are blocked by YouTube!');
      console.log('[MUSIC] Set YT_BYPASS=proxy and YT_PROXY in your .env file.');
    }
  }
};
