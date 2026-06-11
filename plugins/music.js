// plugins/music.js
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const ytdl = require('@distube/ytdl-core');
const ytSearch = require('yt-search');
const fs = require('fs');
const path = require('path');
const spotifyWebApi = require('spotify-web-api-node'); // For Spotify

// Configuration
const MUSIC_DIR = path.join(__dirname, '..', 'music_library'); // Local music folder
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

const spotifyApi = new spotifyWebApi({
    clientId: SPOTIFY_CLIENT_ID,
    clientSecret: SPOTIFY_CLIENT_SECRET
});

// Initialize Spotify (runs on bot start)
async function initSpotify() {
    if (SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET) {
        try {
            const data = await spotifyApi.clientCredentialsGrant();
            spotifyApi.setAccessToken(data.body['access_token']);
            console.log('✅ Spotify API connected');
        } catch (err) {
            console.error('❌ Spotify API failed:', err);
        }
    }
}

// Queue system
const queue = new Map();

module.exports = {
    name: 'play',
    aliases: ['p', 'music'],
    category: 'MUSIC',
    description: 'Play music (local files, Spotify, or YouTube)',
    
    async init(client) {
        await initSpotify();
        // Create music directory if it doesn't exist
        if (!fs.existsSync(MUSIC_DIR)) {
            fs.mkdirSync(MUSIC_DIR, { recursive: true });
        }
    },

    async run(client, message, args, db) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('❌ Join a voice channel first!');
        }

        const query = args.join(' ');
        if (!query) {
            return showLibrary(message); // Show available local files
        }

        // Detect source type
        if (query.startsWith('local:')) {
            return playLocalFile(query.replace('local:', ''), client, message, voiceChannel);
        } else if (query.includes('spotify.com')) {
            return playFromSpotify(query, client, message, voiceChannel);
        } else {
            return playFromYouTube(query, client, message, voiceChannel);
        }
    }
};

// 🎵 LOCAL FILE PLAYER
async function playLocalFile(filename, client, message, voiceChannel) {
    const filePath = path.join(MUSIC_DIR, filename);
    
    if (!fs.existsSync(filePath)) {
        return message.reply(`❌ File "${filename}" not found!\nUse \`.play\` to see available songs.`);
    }

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });

    const resource = createAudioResource(filePath, {
        metadata: { title: filename }
    });
    
    const player = createAudioPlayer();
    player.play(resource);
    connection.subscribe(player);

    // Get file info
    const stats = fs.statSync(filePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(1);

    const embed = new EmbedBuilder()
        .setColor('#00ff88')
        .setTitle('🎵 Now Playing (Local)')
        .setDescription(`**${filename}**`)
        .addFields(
            { name: '💾 Size', value: `${fileSizeMB} MB`, inline: true },
            { name: '📁 Source', value: 'Local Library', inline: true },
            { name: '👤 Requested by', value: message.author.username, inline: true }
        )
        .setFooter({ text: 'Playing from local storage 🎧' });

    const controls = createMusicControls();
    await message.reply({ embeds: [embed], components: [controls] });
}

// 🟢 SPOTIFY PLAYER
async function playFromSpotify(spotifyUrl, client, message, voiceChannel) {
    if (!SPOTIFY_CLIENT_ID) {
        return message.reply('❌ Spotify is not configured. Add SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET to your .env');
    }

    try {
        // Extract track ID from URL
        const trackId = spotifyUrl.split('track/')[1]?.split('?')[0];
        if (!trackId) return message.reply('❌ Invalid Spotify URL');

        const track = await spotifyApi.getTrack(trackId);
        const trackData = track.body;

        // Spotify doesn't provide raw audio - you'll need to search YouTube for the song
        const searchQuery = `${trackData.artists[0].name} ${trackData.name}`;
        const searchResult = await ytSearch(searchQuery);
        const video = searchResult.videos[0];

        if (!video) return message.reply('❌ Could not find this song on YouTube');

        // Stream from YouTube as audio source
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: message.guild.id,
            adapterCreator: message.guild.avatarCreator,
        });

        const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
        const resource = createAudioResource(stream);
        const player = createAudioPlayer();
        
        player.play(resource);
        connection.subscribe(player);

        const embed = new EmbedBuilder()
            .setColor('#1DB954')
            .setTitle('🟢 Now Playing from Spotify')
            .setDescription(`**${trackData.name}**`)
            .addFields(
                { name: '🎤 Artist', value: trackData.artists.map(a => a.name).join(', '), inline: true },
                { name: '💿 Album', value: trackData.album.name, inline: true },
                { name: '⏱️ Duration', value: formatDuration(trackData.duration_ms), inline: true },
                { name: '👤 Requested by', value: message.author.username, inline: true }
            )
            .setThumbnail(trackData.album.images[0]?.url)
            .setFooter({ text: 'Spotify → YouTube audio stream' });

        const controls = createMusicControls();
        await message.reply({ embeds: [embed], components: [controls] });

    } catch (error) {
        console.error('Spotify error:', error);
        return message.reply('❌ Error playing from Spotify. The track might not be available.');
    }
}

// 📺 YOUTUBE PLAYER (kept for completeness)
async function playFromYouTube(query, client, message, voiceChannel) {
    const searchResult = await ytSearch(query);
    const video = searchResult.videos[0];
    if (!video) return message.reply('❌ No results found!');

    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
    });

    const stream = ytdl(video.url, { filter: 'audioonly', quality: 'highestaudio' });
    const resource = createAudioResource(stream);
    const player = createAudioPlayer();
    
    player.play(resource);
    connection.subscribe(player);

    const embed = new EmbedBuilder()
        .setColor('#FF0000')
        .setTitle('▶️ Now Playing from YouTube')
        .setDescription(`[${video.title}](${video.url})`)
        .addFields(
            { name: '⏱️ Duration', value: video.duration.timestamp, inline: true },
            { name: '👤 Requested by', value: message.author.username, inline: true },
            { name: '📺 Channel', value: video.author.name, inline: true }
        )
        .setThumbnail(video.thumbnail)
        .setFooter({ text: 'YouTube Audio Stream' });

    const controls = createMusicControls();
    await message.reply({ embeds: [embed], components: [controls] });
}

// 📚 SHOW LOCAL LIBRARY
async function showLibrary(message) {
    const files = fs.readdirSync(MUSIC_DIR).filter(f => 
        f.endsWith('.mp3') || f.endsWith('.wav') || f.endsWith('.ogg') || f.endsWith('.flac')
    );

    const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('📚 Music Library')
        .setDescription('Play a song with: `.play local:filename`\n\nOr use:\n`.play song name` for YouTube\n`.play spotify-url` for Spotify')
        .addFields({
            name: `Local Files (${files.length})`,
            value: files.length > 0 
                ? files.map((f, i) => `${i+1}. ${f}`).join('\n').slice(0, 1024)
                : 'No songs yet! Add .mp3 files to the music_library folder'
        });

    await message.reply({ embeds: [embed] });
}

// 🎛️ MUSIC CONTROLS (unchanged)
function createMusicControls() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('music_like').setLabel('❤️ Like').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_pause').setLabel('⏸️ Pause').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_skip').setLabel('⏭️ Skip').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('music_stop').setLabel('⏹️ Stop').setStyle(ButtonStyle.Danger)
    );
}

function formatDuration(ms) {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
}