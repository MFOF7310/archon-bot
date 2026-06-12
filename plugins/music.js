// ============================================
// ARCHON CG-223 — Music Engine v2.0
// Source-Agnostic Audio Pipeline with Per-Server Isolation
// Supports: Prefix + Slash | YouTube | SoundCloud | Local Files | Direct URLs
// ============================================

const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
  StreamType
} = require('@discordjs/voice');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder } = require('discord.js');
const playdl = require('play-dl');
const youtubedl = require('youtube-dl-exec');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  LOCAL_MUSIC_DIR: path.join(process.cwd(), 'data', 'music'),
  COOKIES_PATH: path.join(process.cwd(), 'config', 'youtube-cookies.json'),
  MAX_QUEUE_SIZE: 100,
  DEFAULT_VOLUME: 0.8,
  LEAVE_ON_EMPTY: true,
  LEAVE_ON_END: true,
  LEAVE_TIMEOUT_MS: 300000, // 5 minutes
  PROXY_URL: process.env.WARP_PROXY || 'http://127.0.0.1:8080', // Cloudflare WARP
  YT_DLP_PATH: 'yt-dlp'
};

// Ensure directories exist
if (!fs.existsSync(CONFIG.LOCAL_MUSIC_DIR)) {
  fs.mkdirSync(CONFIG.LOCAL_MUSIC_DIR, { recursive: true });
}

// ============================================
// PER-SERVER STATE MANAGER (SQLite WAL backed)
// ============================================
class ServerMusicState {
  constructor(guildId, db) {
    this.guildId = guildId;
    this.db = db;
    this.player = null;
    this.connection = null;
    this.queue = [];
    this.currentTrack = null;
    this.volume = CONFIG.DEFAULT_VOLUME;
    this.leaveTimeout = null;
    this.isPlaying = false;
    this.loopMode = 'off'; // off, track, queue
    this.textChannel = null;
    
    this._initDb();
  }

  _initDb() {
    // Per-server music table (isolated from other plugins)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS music_state_${this.guildId} (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS music_queue_${this.guildId} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT,
        title TEXT,
        artist TEXT,
        duration INTEGER,
        source TEXT,
        requested_by TEXT,
        timestamp INTEGER
      )
    `);
  }

  saveState() {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO music_state_${this.guildId} (key, value) VALUES (?, ?)`
    );
    stmt.run('volume', this.volume.toString());
    stmt.run('loopMode', this.loopMode);
    stmt.run('currentTrack', JSON.stringify(this.currentTrack));
  }

  loadState() {
    const rows = this.db.prepare(
      `SELECT * FROM music_state_${this.guildId}`
    ).all();
    rows.forEach(row => {
      if (row.key === 'volume') this.volume = parseFloat(row.value);
      if (row.key === 'loopMode') this.loopMode = row.value;
      if (row.key === 'currentTrack') this.currentTrack = JSON.parse(row.value);
    });
  }
}

// Global state registry (per-server isolation)
const serverStates = new Map();

function getServerState(guildId, db) {
  if (!serverStates.has(guildId)) {
    serverStates.set(guildId, new ServerMusicState(guildId, db));
  }
  return serverStates.get(guildId);
}

// ============================================
// SOURCE EXTRACTOR ENGINE (Pluggable & Fault-Isolated)
// ============================================
class SourceExtractor {
  constructor() {
    this.cookies = this._loadCookies();
    this.proxyAgent = this._createProxyAgent();
  }

  _loadCookies() {
    try {
      if (fs.existsSync(CONFIG.COOKIES_PATH)) {
        return JSON.parse(fs.readFileSync(CONFIG.COOKIES_PATH, 'utf8'));
      }
    } catch (e) {
      console.warn(`[Music] Could not load cookies: ${e.message}`);
    }
    return null;
  }

  _createProxyAgent() {
    // If using WARP, yt-dlp auto-detects system proxy
    // Otherwise configure explicit proxy
    return null;
  }

  // ============================================
  // STRATEGY 1: play-dl (Fast, no external binary needed)
  // ============================================
  async extractViaPlayDL(query) {
    try {
      // Search or direct URL
      let streamInfo;
      if (playdl.yt_validate(query) === 'video') {
        const info = await playdl.video_info(query);
        streamInfo = await playdl.stream_from_info(info);
        return {
          type: 'youtube',
          url: query,
          title: info.video_details.title,
          artist: info.video_details.channel?.name || 'Unknown',
          duration: info.video_details.durationInSec,
          streamFactory: () => streamInfo.stream,
          thumbnail: info.video_details.thumbnails[0]?.url,
          source: 'play-dl'
        };
      }
      
      // Search
      const search = await playdl.search(query, { limit: 1 });
      if (!search.length) throw new Error('No results found');
      const info = await playdl.video_info(search[0].url);
      streamInfo = await playdl.stream_from_info(info);
      
      return {
        type: 'youtube',
        url: search[0].url,
        title: info.video_details.title,
        artist: info.video_details.channel?.name || 'Unknown',
        duration: info.video_details.durationInSec,
        streamFactory: () => streamInfo.stream,
        thumbnail: info.video_details.thumbnails[0]?.url,
        source: 'play-dl'
      };
    } catch (error) {
      console.warn(`[Music] play-dl extraction failed: ${error.message}`);
      throw error; // Propagate to fallback
    }
  }

  // ============================================
  // STRATEGY 2: yt-dlp (Bypasses datacenter blocks)
  // ============================================
  async extractViaYtdlp(query) {
    return new Promise((resolve, reject) => {
      const args = [
        '--no-warnings',
        '--no-check-certificates',
        '--extractor-args', 'youtube:player_client=web_safari',
        '--format', 'bestaudio[ext=webm]/bestaudio/best',
        '--audio-format', 'opus',
        '--print', '%(title)s|%(uploader)s|%(duration)s|%(thumbnail)s|%(webpage_url)s',
        '--dump-single-json',
        '-o', '-'
      ];

      // Add cookies if available
      if (this.cookies) {
        const cookiesFile = path.join(process.cwd(), 'tmp', `cookies-${Date.now()}.txt`);
        // Convert JSON cookies to netscape format for yt-dlp
        this._writeNetscapeCookies(cookiesFile, this.cookies);
        args.push('--cookies', cookiesFile);
      }

      // Add proxy if configured
      if (CONFIG.PROXY_URL) {
        args.push('--proxy', CONFIG.PROXY_URL);
      }

      const isUrl = query.startsWith('http');
      const target = isUrl ? query : `ytsearch1:${query}`;

      const ytdlp = spawn(CONFIG.YT_DLP_PATH, [...args, target], {
        stdio: ['ignore', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let audioBuffer = Buffer.alloc(0);

      ytdlp.stdout.on('data', (data) => {
        audioBuffer = Buffer.concat([audioBuffer, data]);
      });

      ytdlp.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ytdlp.on('close', (code) => {
        // Clean up temp cookies
        if (this.cookies) {
          const tmpFiles = fs.readdirSync(path.join(process.cwd(), 'tmp')).filter(f => f.startsWith('cookies-'));
          tmpFiles.forEach(f => {
            try { fs.unlinkSync(path.join(process.cwd(), 'tmp', f)); } catch(e) {}
          });
        }

        if (code !== 0) {
          return reject(new Error(`yt-dlp failed: ${stderr}`));
        }

        // Parse metadata from stderr (yt-dlp prints metadata to stderr in some modes)
        // Or parse from the JSON output
        try {
          const jsonStart = stderr.lastIndexOf('{');
          if (jsonStart !== -1) {
            const metadata = JSON.parse(stderr.substring(jsonStart));
            resolve({
              type: 'youtube',
              url: metadata.webpage_url,
              title: metadata.title,
              artist: metadata.uploader || 'Unknown',
              duration: metadata.duration,
              streamFactory: () => {
                // Return the buffered audio as a readable stream
                const { Readable } = require('stream');
                return Readable.from(audioBuffer);
              },
              thumbnail: metadata.thumbnail,
              source: 'yt-dlp'
            });
          } else {
            reject(new Error('Could not parse yt-dlp output'));
          }
        } catch (e) {
          reject(e);
        }
      });

      ytdlp.on('error', (err) => reject(err));
    });
  }

  _writeNetscapeCookies(filePath, cookies) {
    let netscape = '# Netscape HTTP Cookie File\n';
    cookies.forEach(c => {
      const domain = c.domain.startsWith('.') ? c.domain : '.' + c.domain;
      netscape += `${domain}\tTRUE\t${c.path}\t${c.secure ? 'TRUE' : 'FALSE'}\t${c.expirationDate || '0'}\t${c.name}\t${c.value}\n`;
    });
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, netscape);
  }

  // ============================================
  // STRATEGY 3: Local File (100% offline, never fails)
  // ============================================
  async extractLocalFile(filename) {
    const filePath = path.join(CONFIG.LOCAL_MUSIC_DIR, filename);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Local file not found: ${filename}`);
    }
    
    const stats = fs.statSync(filePath);
    return {
      type: 'local',
      url: filePath,
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Local Library',
      duration: 0, // Could use music-metadata library to extract
      streamFactory: () => fs.createReadStream(filePath),
      thumbnail: null,
      source: 'local'
    };
  }

  // ============================================
  // STRATEGY 4: Direct URL (SoundCloud, CDN, etc.)
  // ============================================
  async extractDirectUrl(url) {
    // For SoundCloud, Spotify, etc. — use play-dl
    if (url.includes('soundcloud.com')) {
      const soundcloud = await playdl.soundcloud(url);
      return {
        type: 'soundcloud',
        url: url,
        title: soundcloud.name,
        artist: soundcloud.user?.name || 'Unknown',
        duration: soundcloud.durationInSec,
        streamFactory: () => soundcloud.stream(),
        thumbnail: soundcloud.thumbnail,
        source: 'soundcloud'
      };
    }
    
    // Generic direct URL
    return {
      type: 'url',
      url: url,
      title: 'Direct Stream',
      artist: 'Unknown',
      duration: 0,
      streamFactory: () => {
        const http = url.startsWith('https') ? require('https') : require('http');
        return http.get(url);
      },
      thumbnail: null,
      source: 'direct'
    };
  }

  // ============================================
  // MASTER EXTRACTION: Cascading Fallback
  // ============================================
  async extract(query) {
    const errors = [];
    
    // Detect query type
    const isLocalFile = !query.startsWith('http') && fs.existsSync(path.join(CONFIG.LOCAL_MUSIC_DIR, query));
    const isUrl = query.startsWith('http');
    
    // Priority 1: Local files (never fails, completely isolated from YouTube)
    if (isLocalFile) {
      try {
        return await this.extractLocalFile(query);
      } catch (e) {
        errors.push(`Local: ${e.message}`);
      }
    }

    // Priority 2: Direct URLs (SoundCloud, etc.)
    if (isUrl && !query.includes('youtube.com') && !query.includes('youtu.be')) {
      try {
        return await this.extractDirectUrl(query);
      } catch (e) {
        errors.push(`Direct: ${e.message}`);
      }
    }

    // Priority 3: YouTube via play-dl (fast, no external binary)
    if (isUrl || !isLocalFile) {
      try {
        return await this.extractViaPlayDL(query);
      } catch (e) {
        errors.push(`play-dl: ${e.message}`);
      }
    }

    // Priority 4: YouTube via yt-dlp (bypasses blocks, uses proxy + cookies)
    if (isUrl || !isLocalFile) {
      try {
        return await this.extractViaYtdlp(query);
      } catch (e) {
        errors.push(`yt-dlp: ${e.message}`);
      }
    }

    // All strategies failed
    throw new Error(`All extraction strategies failed:\n${errors.join('\n')}`);
  }
}

// ============================================
// INTERACTIVE PLAYER CONTROLLER
// ============================================
class InteractivePlayer {
  constructor(state) {
    this.state = state;
    this.extractor = new SourceExtractor();
    this.player = createAudioPlayer();
    this._setupPlayerEvents();
  }

  _setupPlayerEvents() {
    this.player.on(AudioPlayerStatus.Playing, () => {
      this.state.isPlaying = true;
      this._updateNowPlaying();
    });

    this.player.on(AudioPlayerStatus.Idle, async () => {
      this.state.isPlaying = false;
      
      // Handle loop modes
      if (this.state.loopMode === 'track' && this.state.currentTrack) {
        await this.playTrack(this.state.currentTrack);
        return;
      }
      
      // Move to next track
      if (this.state.queue.length > 0) {
        const next = this.state.queue.shift();
        await this.playTrack(next);
      } else if (CONFIG.LEAVE_ON_END) {
        this._startLeaveTimeout();
      }
    });

    this.player.on('error', (error) => {
      console.error(`[Music] Player error in guild ${this.state.guildId}:`, error.message);
      // Don't crash — just skip to next
      this._skipToNext();
    });
  }

  async playTrack(track) {
    try {
      this.state.currentTrack = track;
      this.state.saveState();

      // Get stream from factory
      const stream = track.streamFactory();
      
      // Create audio resource with proper stream type detection
      const resource = createAudioResource(stream, {
        inputType: track.type === 'local' ? StreamType.Arbitrary : StreamType.WebmOpus,
        inlineVolume: true
      });

      // Set volume
      resource.volume?.setVolume(this.state.volume);

      // Play
      this.player.play(resource);
      
      // Subscribe connection
      if (this.state.connection) {
        this.state.connection.subscribe(this.player);
      }

      return true;
    } catch (error) {
      console.error(`[Music] Failed to play track:`, error.message);
      this._sendErrorEmbed(`Failed to play **${track.title}**: ${error.message}`);
      this._skipToNext();
      return false;
    }
  }

  async addToQueue(query, requester) {
    try {
      const track = await this.extractor.extract(query);
      track.requestedBy = requester;
      track.timestamp = Date.now();
      
      this.state.queue.push(track);
      
      // If not playing, start immediately
      if (!this.state.isPlaying && !this.state.currentTrack) {
        await this.playTrack(this.state.queue.shift());
      }
      
      return { success: true, track };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  _skipToNext() {
    if (this.state.queue.length > 0) {
      const next = this.state.queue.shift();
      this.playTrack(next);
    } else {
      this.state.currentTrack = null;
      this.state.isPlaying = false;
      if (CONFIG.LEAVE_ON_END) this._startLeaveTimeout();
    }
  }

  _startLeaveTimeout() {
    if (this.state.leaveTimeout) clearTimeout(this.state.leaveTimeout);
    this.state.leaveTimeout = setTimeout(() => {
      if (!this.state.isPlaying && this.state.connection) {
        this.state.connection.destroy();
        this.state.connection = null;
      }
    }, CONFIG.LEAVE_TIMEOUT_MS);
  }

  _updateNowPlaying() {
    if (!this.state.textChannel || !this.state.currentTrack) return;
    
    const track = this.state.currentTrack;
    const embed = new EmbedBuilder()
      .setColor(0x00FF88) // Neural Green
      .setTitle('🎵 Now Playing')
      .setDescription(`**[${track.title}](${track.url})**`)
      .addFields(
        { name: 'Artist', value: track.artist, inline: true },
        { name: 'Source', value: track.source, inline: true },
        { name: 'Requested By', value: track.requestedBy || 'Unknown', inline: true },
        { name: 'Duration', value: track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : 'Live', inline: true }
      )
      .setThumbnail(track.thumbnail || null)
      .setFooter({ text: `ARCHON CG-223 Music Engine | Server: ${this.state.guildId}` })
      .setTimestamp();

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`music:pause:${this.state.guildId}`).setLabel('⏸️ Pause').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`music:skip:${this.state.guildId}`).setLabel('⏭️ Skip').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`music:stop:${this.state.guildId}`).setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`music:loop:${this.state.guildId}`).setLabel(`🔁 Loop: ${this.state.loopMode}`).setStyle(ButtonStyle.Secondary)
    );

    this.state.textChannel.send({ embeds: [embed], components: [row] }).catch(() => {});
  }

  _sendErrorEmbed(message) {
    if (!this.state.textChannel) return;
    const embed = new EmbedBuilder()
      .setColor(0xFF4444)
      .setTitle('❌ Playback Error')
      .setDescription(message)
      .setFooter({ text: 'ARCHON CG-223 Music Engine' });
    this.state.textChannel.send({ embeds: [embed] }).catch(() => {});
  }
}

// ============================================
// COMMAND HANDLER
// ============================================
module.exports = {
  name: 'music',
  aliases: ['m', 'play', 'p', 'queue', 'q', 'skip', 'stop', 'pause', 'resume', 'loop', 'volume', 'np', 'nowplaying'],
  description: 'Advanced music player with per-server isolation and multi-source support',
  category: 'Audio',
  cooldown: 3,
  permissions: ['Connect', 'Speak', 'SendMessages'],
  
  // Slash command definition
  slashCommand: new SlashCommandBuilder()
    .setName('music')
    .setDescription('Music player controls')
    .addSubcommand(sub => sub
      .setName('play')
      .setDescription('Play a song from YouTube, SoundCloud, or local files')
      .addStringOption(opt => opt
        .setName('query')
        .setDescription('Song name, URL, or local filename')
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('queue')
      .setDescription('Show the current queue'))
    .addSubcommand(sub => sub
      .setName('skip')
      .setDescription('Skip the current song'))
    .addSubcommand(sub => sub
      .setName('stop')
      .setDescription('Stop playback and clear queue'))
    .addSubcommand(sub => sub
      .setName('pause')
      .setDescription('Pause the current song'))
    .addSubcommand(sub => sub
      .setName('resume')
      .setDescription('Resume playback'))
    .addSubcommand(sub => sub
      .setName('loop')
      .setDescription('Toggle loop mode')
      .addStringOption(opt => opt
        .setName('mode')
        .setDescription('Loop mode')
        .addChoices(
          { name: 'Off', value: 'off' },
          { name: 'Track', value: 'track' },
          { name: 'Queue', value: 'queue' }
        )))
    .addSubcommand(sub => sub
      .setName('volume')
      .setDescription('Adjust volume')
      .addIntegerOption(opt => opt
        .setName('level')
        .setDescription('Volume level (0-100)')
        .setMinValue(0)
        .setMaxValue(100)
        .setRequired(true)))
    .addSubcommand(sub => sub
      .setName('nowplaying')
      .setDescription('Show currently playing song')),

  // ============================================
  // INIT LIFECYCLE
  // ============================================
  async init(client) {
    // Button interaction handler for interactive controls
    client.on('interactionCreate', async (interaction) => {
      if (!interaction.isButton()) return;
      if (!interaction.customId.startsWith('music:')) return;

      const [_, action, guildId] = interaction.customId.split(':');
      const state = getServerState(guildId, client.db);
      
      if (!state.player) {
        return interaction.reply({ content: '❌ No active player in this server.', ephemeral: true });
      }

      await interaction.deferUpdate().catch(() => {});

      switch (action) {
        case 'pause':
          state.player.player.pause();
          break;
        case 'resume':
          state.player.player.unpause();
          break;
        case 'skip':
          state.player._skipToNext();
          break;
        case 'stop':
          state.player.player.stop();
          state.queue = [];
          state.currentTrack = null;
          if (state.connection) state.connection.destroy();
          break;
        case 'loop':
          const modes = ['off', 'track', 'queue'];
          const currentIdx = modes.indexOf(state.loopMode);
          state.loopMode = modes[(currentIdx + 1) % modes.length];
          state.saveState();
          break;
      }
    });

    console.log('[Music] Engine v2.0 initialized — Source-Agnostic Pipeline active');
  },

  // ============================================
  // RUN LIFECYCLE (Prefix + Slash unified)
  // ============================================
  async run(client, message, args, db) {
    const isSlash = message.commandName !== undefined;
    const guildId = message.guild.id;
    const member = isSlash ? message.member : message.member;
    const textChannel = isSlash ? message.channel : message.channel;
    
    // Get or create server state
    const state = getServerState(guildId, db);
    state.textChannel = textChannel;

    // Determine subcommand
    let subcommand, query;
    if (isSlash) {
      subcommand = message.options.getSubcommand();
      query = message.options.getString('query');
    } else {
      subcommand = args[0] || 'play';
      query = args.slice(1).join(' ');
      // Handle aliases
      if (['play', 'p'].includes(subcommand)) subcommand = 'play';
      if (['queue', 'q'].includes(subcommand)) subcommand = 'queue';
      if (['nowplaying', 'np'].includes(subcommand)) subcommand = 'nowplaying';
    }

    // Voice channel validation
    const voiceChannel = member.voice.channel;
    if (!voiceChannel && ['play', 'pause', 'resume', 'skip'].includes(subcommand)) {
      return this._reply(message, isSlash, {
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Voice Channel Required')
          .setDescription('You must be in a voice channel to use music commands.')]
      });
    }

    // Initialize voice connection if needed
    if (voiceChannel && !state.connection) {
      state.connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true
      });

      state.connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await entersState(state.connection, VoiceConnectionStatus.Connecting, 5000);
        } catch {
          state.connection.destroy();
          state.connection = null;
        }
      });
    }

    // Initialize player if needed
    if (!state.player) {
      state.player = new InteractivePlayer(state);
    }

    // ============================================
    // COMMAND ROUTING
    // ============================================
    try {
      switch (subcommand) {
        case 'play': {
          if (!query) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('⚠️ Missing Query')
                .setDescription('Usage: `!music play <song name/URL/local file>` or `/music play query:`')]
            });
          }

          // Typing indicator for search
          if (!isSlash) await textChannel.sendTyping();

          const result = await state.player.addToQueue(query, member.displayName);
          
          if (!result.success) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder()
                .setColor(0xFF4444)
                .setTitle('❌ Extraction Failed')
                .setDescription(`Failed to resolve: **${query}**\n\`\`\`${result.error}\`\`\``)
                .addFields(
                  { name: 'Tip', value: 'For local files, place them in `./data/music/` and use the filename.\nFor YouTube blocks, the bot auto-falls back to yt-dlp with proxy.', inline: false }
                )]
            });
          }

          const embed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle(state.isPlaying ? '📥 Added to Queue' : '▶️ Now Playing')
            .setDescription(`**[${result.track.title}](${result.track.url})**`)
            .addFields(
              { name: 'Artist', value: result.track.artist, inline: true },
              { name: 'Source', value: `\`${result.track.source}\``, inline: true },
              { name: 'Duration', value: result.track.duration ? `${Math.floor(result.track.duration / 60)}:${(result.track.duration % 60).toString().padStart(2, '0')}` : 'Live', inline: true }
            )
            .setThumbnail(result.track.thumbnail || null)
            .setFooter({ text: `Requested by ${result.track.requestedBy} | Position: ${state.queue.length + (state.isPlaying ? 1 : 0)}` });

          return this._reply(message, isSlash, { embeds: [embed] });
        }

        case 'queue': {
          if (!state.queue.length && !state.currentTrack) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('📭 Queue Empty')
                .setDescription('No songs in queue. Use `!music play <query>` to add one.')]
            });
          }

          const embed = new EmbedBuilder()
            .setColor(0x00AAFF)
            .setTitle(`🎵 Server Queue — ${message.guild.name}`)
            .setDescription(state.currentTrack 
              ? `**Now Playing:** [${state.currentTrack.title}](${state.currentTrack.url}) — \`${state.currentTrack.source}\`\n\n`
              : 'Nothing playing.\n');

          state.queue.slice(0, 10).forEach((track, i) => {
            embed.addFields({
              name: `${i + 1}. ${track.title}`,
              value: `Source: \`${track.source}\` | Requested by: ${track.requestedBy}`,
              inline: false
            });
          });

          if (state.queue.length > 10) {
            embed.setFooter({ text: `...and ${state.queue.length - 10} more tracks` });
          }

          return this._reply(message, isSlash, { embeds: [embed] });
        }

        case 'skip': {
          if (!state.currentTrack) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Nothing Playing')]
            });
          }
          state.player._skipToNext();
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0x00FF88).setTitle('⏭️ Skipped')]
          });
        }

        case 'stop': {
          state.player.player.stop();
          state.queue = [];
          state.currentTrack = null;
          if (state.connection) {
            state.connection.destroy();
            state.connection = null;
          }
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('⏹️ Stopped & Cleared')]
          });
        }

        case 'pause': {
          state.player.player.pause();
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('⏸️ Paused')]
          });
        }

        case 'resume': {
          state.player.player.unpause();
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0x00FF88).setTitle('▶️ Resumed')]
          });
        }

        case 'loop': {
          const mode = isSlash ? message.options.getString('mode') : (args[1] || 'off');
          const validModes = ['off', 'track', 'queue'];
          if (!validModes.includes(mode)) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Invalid Mode').setDescription('Use: `off`, `track`, or `queue`')]
            });
          }
          state.loopMode = mode;
          state.saveState();
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0x00FF88).setTitle(`🔁 Loop: ${mode.toUpperCase()}`)]
          });
        }

        case 'volume': {
          const level = isSlash ? message.options.getInteger('level') : parseInt(args[1]);
          if (isNaN(level) || level < 0 || level > 100) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder().setColor(0xFF4444).setTitle('❌ Invalid Volume').setDescription('Use 0-100')]
            });
          }
          state.volume = level / 100;
          state.saveState();
          // Apply to current resource if playing
          if (state.player.player.state.resource?.volume) {
            state.player.player.state.resource.volume.setVolume(state.volume);
          }
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder().setColor(0x00FF88).setTitle(`🔊 Volume: ${level}%`)]
          });
        }

        case 'nowplaying': {
          if (!state.currentTrack) {
            return this._reply(message, isSlash, {
              embeds: [new EmbedBuilder().setColor(0xFFAA00).setTitle('❌ Nothing Playing')]
            });
          }
          const track = state.currentTrack;
          const embed = new EmbedBuilder()
            .setColor(0x00FF88)
            .setTitle('🎵 Now Playing')
            .setDescription(`**[${track.title}](${track.url})**`)
            .addFields(
              { name: 'Artist', value: track.artist, inline: true },
              { name: 'Source', value: track.source, inline: true },
              { name: 'Loop', value: state.loopMode, inline: true }
            )
            .setThumbnail(track.thumbnail || null);
          return this._reply(message, isSlash, { embeds: [embed] });
        }

        default: {
          return this._reply(message, isSlash, {
            embeds: [new EmbedBuilder()
              .setColor(0xFFAA00)
              .setTitle('📖 Music Commands')
              .setDescription(
                '`!music play <query>` — Play/queue a song\n' +
                '`!music queue` — Show queue\n' +
                '`!music skip` — Skip current\n' +
                '`!music stop` — Stop & clear\n' +
                '`!music pause/resume` — Playback control\n' +
                '`!music loop <off/track/queue>` — Loop mode\n' +
                '`!music volume <0-100>` — Adjust volume\n' +
                '`!music np` — Now playing'
              )]
          });
        }
      }
    } catch (error) {
      console.error(`[Music] Command error in guild ${guildId}:`, error);
      return this._reply(message, isSlash, {
        embeds: [new EmbedBuilder()
          .setColor(0xFF4444)
          .setTitle('❌ Engine Error')
          .setDescription(`\`\`\`${error.message}\`\`\`\nThis error has been logged. The audio pipeline remains stable.`)]
      });
    }
  },

  // Helper for unified reply
  _reply(message, isSlash, payload) {
    if (isSlash) {
      return message.replied ? message.followUp(payload) : message.reply(payload);
    }
    return message.channel.send(payload);
  }
};
