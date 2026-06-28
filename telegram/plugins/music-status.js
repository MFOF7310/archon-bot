// ═══════════════════════════════════════════
//  TG COMMAND: /music — Live music status
// ═══════════════════════════════════════════

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' :
        t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function formatTime(s) {
    if (!s || isNaN(s)) return '0:00';
    return `${Math.floor(s/60)}:${Math.floor(s%60).toString().padStart(2,'0')}`;
}

function progressBar(cur, total, len=12) {
    if (!total) return '\u2591'.repeat(len);
    const f = Math.round(Math.min(1, cur/total) * len);
    return '\u2588'.repeat(f) + '\u2591'.repeat(len-f);
}

module.exports = {
    name: 'music',
    description: 'Show live music status across all servers',
    category: 'System',
    usage: '/music',
    aliases: ['np', 'nowplaying', 'playing'],
    ownerOnly: true,

    handler: async (ctx) => {
        const { client } = ctx;
        await ctx.action('typing');

        try {
            const musicMod = require('../../plugins/music.js');
            const getQueue = musicMod.getQueue;

            if (!getQueue) {
                return ctx.replyHTML('\u274c <b>Music module not accessible</b>');
            }

            const guilds = Array.from(client.guilds.cache.values());
            const active = [];

            for (const guild of guilds) {
                const q = getQueue(guild.id);
                if (q && q.currentTrack) {
                    const elapsed = q.startTime
                        ? Math.floor((Date.now() - q.startTime - (q.totalPaused||0)) / 1000)
                        : 0;
                    active.push({
                        guild: guild.name,
                        track: q.currentTrack.title,
                        artist: q.currentTrack.artist || 'Unknown',
                        elapsed,
                        duration: q.currentTrack.duration || 0,
                        source: q.currentTrack.source || 'SoundCloud',
                        paused: q.player?.state?.status === 'paused',
                        queue: q.tracks.length,
                        volume: q.volume,
                        loop: q.loop,
                        requestedBy: q.currentTrack.requestedBy || '?',
                        voiceChannel: q.voiceChannel?.name || '?',
                    });
                }
            }

            if (active.length === 0) {
                return ctx.replyHTML(
                    '\u{1F3B5} <b>MUSIC STATUS</b>\n' +
                    '\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n' +
                    '\u23F9\uFE0F <b>Nothing playing</b>\n\n' +
                    '<i>Use /music play in Discord to start</i>\n\n' +
                    '\u00B7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1 \u00B7'
                );
            }

            let msg = '\u{1F3B5} <b>MUSIC STATUS</b>\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
            msg += `<b>${active.length}</b> server${active.length > 1 ? 's' : ''} playing\n\n`;

            for (let i = 0; i < active.length; i++) {
                const s = active[i];
                const bar = progressBar(s.elapsed, s.duration);
                const pct = s.duration > 0 ? Math.min(100, Math.round((s.elapsed/s.duration)*100)) : 0;
                const status = s.paused ? '\u23F8\uFE0F PAUSED' : '\uD83D\uDFE2 LIVE';
                const srcEmoji = s.source === 'SoundCloud' ? '\uD83D\UDFE0' : s.source === 'YouTube' ? '\uD83D\uDD34' : '\uD83D\uDFE2';

                msg += `\uD83C\uDFF0 <b>${escapeHTML(s.guild)}</b>\n`;
                msg += `\uD83C\uDFB5 ${escapeHTML(s.track.substring(0,45))}\n`;
                msg += `\uD83D\uDC64 ${escapeHTML(s.artist.substring(0,30))}\n`;
                msg += `<code>${bar}</code> ${pct}%\n`;
                msg += `\u23F1\uFE0F ${formatTime(s.elapsed)} / ${formatTime(s.duration)}\n`;
                msg += `${srcEmoji} ${s.source} \u00B7 \uD83D\uDD0A ${escapeHTML(s.voiceChannel)}\n`;
                msg += `\uD83D\uDD0A Vol:${s.volume}% \u00B7 \uD83D\uDD01 ${s.loop?'ON':'OFF'} \u00B7 \uD83D\uDCCB +${s.queue}\n`;
                msg += `\uD83D\uDC64 ${escapeHTML(s.requestedBy)} \u00B7 ${status}\n`;
                if (i < active.length - 1) msg += '\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\n';
            }

            msg += `\n\n<i>${new Date().toLocaleTimeString()} \u00B7 BAMAKO_223 \uD83C\uDDF2\uD83C\uDDF1</i>`;
            await ctx.replyHTML(msg);

        } catch(e) {
            await ctx.replyHTML(`\u274c <b>Error</b>\n<code>${escapeHTML(e.message)}</code>`);
        }
    }
};
