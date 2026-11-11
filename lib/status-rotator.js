// lib/status-rotator.js — Handles the bot's presence, status rotation, and About Me.
module.exports = (client) => {
    const green = '\x1b[32m';
    const reset = '\x1b[0m';
    let statusIndex = 0;
    // The status is the same on every server and can't be translated, so it stays short, in English, and useful to anyone
    const season = () => { try { return String(require('./weapons').getSeason().season || '').split('-')[0]; } catch { return ''; } };
    const STATUS_MESSAGES = [
        () => ({ name: 'Custom Status', type: 4, state: '🦅 /help · bamako-steel-dev.xyz' }),
        () => { const n = client.guilds.cache.size; return { name: `${n.toLocaleString('en-US')} server${n === 1 ? '' : 's'}`, type: 3 }; }, // Watching
        () => ({ name: season() ? `/meta · CODM ${season()}` : '/meta · CODM', type: 0 }),                                               // Playing
        () => ({ name: 'Custom Status', type: 4, state: '🌍 5 languages · /mylang' }),
    ];

    function rotateStatus() {
        if (!client.user) return;
        if (!client.ws?.shards?.size || client.ws.status !== 0) return; // gateway down: skip
        // Music takes priority over the rotation while something is actually playing
        try {
            const players = client.kazagumo?.players;
            if (players?.size) {
                const p = [...players.values()].find(x => x.playing && !x.paused);
                const cur = p?.queue?.current;
                const title = cur?.title || cur?.info?.title;
                if (title) {
                    client.user.setPresence({ status: 'online', activities: [{ name: title.substring(0, 60), type: 2 }] });
                    return;
                }
            }
        } catch (e) { /* fall through to the rotation */ }
        try {
            client.user.setPresence({ status: 'online', activities: [STATUS_MESSAGES[statusIndex]()] });
        } catch (e) { /* gateway mid-reconnect */ }
        statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
    }

// Runs once on ready: start-up tidying, then the status rotation
client.once('clientReady', async () => {
    // Auto-clean orphaned music panels on boot
    try { require('../plugins/music.js').autoCleanOldPanels(client); } catch(e) { console.error('[MUSIC CLEAN]', e.message); }
    // Ticket panels already posted get the current layout and texts (once, 20 s after start, when channels are cached)
    setTimeout(() => { require('../plugins/ticket.js').refreshPostedPanels(client).catch(e => console.error('[TICKET PANELS]', e.message)); }, 20000);
    // The bot's About Me can't be set from code: it is the application's Description in the Discord Developer Portal.

    // Start status rotation
    rotateStatus();
    setInterval(rotateStatus, 60 * 1000); // Every 60s
 client.on('shardResume', () => rotateStatus()); // presence drops on reconnect
    console.log(`${green}[STATUS]${reset} Rotating status active (${STATUS_MESSAGES.length} messages, 60s interval)`);
});

// ── Discord Login ──



};
