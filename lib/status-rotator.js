// lib/status-rotator.js — Handles the bot's presence, status rotation, and About Me.
module.exports = (client) => {
    const green = '\x1b[32m';
    const reset = '\x1b[0m';
    const yellow = '\x1b[33m';
    let statusIndex = 0;
    const STATUS_MESSAGES = [
        { name: 'with the Bamako Steel', type: 0 },
        { name: 'over the Eagle Community', type: 3 },
        { name: 'over 18 servers', type: 3 },
        { name: 'customstatus', type: 4, state: 'ARCHON CG-223 | bamako-steel-dev.xyz' }
    ];

    function rotateStatus() {
    // If music is playing in any guild, show music status
    const musicPlugin = client.commands?.get('music');
    if (false) {
        const activeQueues = [];
        if (activeQueues.length > 0) {
            const p = client.kazagumo?.players?.get(activeQueues[0]);
            const trackName = p?.queue?.current?.info?.title?.substring(0, 40) || 'music';
            client.user.setActivity(trackName, { type: 2 }); // Listening to <track>
            return;
        }
    }
    if (!client.user) return;
    // Music takes priority over the rotation while something is actually playing
    try {
        const players = client.kazagumo?.players;
        if (players?.size) {
            const p = [...players.values()].find(x => x.playing && !x.paused);
            const cur = p?.queue?.current;
            const title = cur?.title || cur?.info?.title;
            if (title) {
                client.user.setPresence({ status: 'online',
                    activities: [{ name: title.substring(0, 60), type: 2 }] });
                return;
            }
        }
    } catch (e) { /* fall through to normal rotation */ }
    const msg = STATUS_MESSAGES[statusIndex];
    let name = msg.name;
    // Replace dynamic placeholders
    if (name.includes('{guilds}')) name = name.replace('{guilds}', client.guilds.cache.size.toLocaleString());
    if (name.includes('{users}')) name = name.replace('{users}', client.guilds.cache.reduce((t, g) => t + g.memberCount, 0).toLocaleString());
    if (msg.dynamic === 'plugins') name = `${client.commands?.size || 0} plugins loaded ⚡`;
    if (!client.ws?.shards?.size || client.ws.status !== 0) return; // gateway down — skip
    const activity = msg.type === 4
        ? { name: name, type: 4, state: name }
        : { name, type: msg.type, ...(msg.url ? { url: msg.url } : {}) }; // Streaming needs a Twitch/YouTube url for the Watch button
    try {
        client.user.setPresence({ status: 'online', activities: [activity] });
    } catch (e) { /* gateway mid-reconnect */ }
    statusIndex = (statusIndex + 1) % STATUS_MESSAGES.length;
}

// Set About Me (bot profile description) — runs once on ready
client.once('clientReady', async () => {
    // Auto-clean orphaned music panels on boot
    try { require('../plugins/music.js').autoCleanOldPanels(client); } catch(e) { console.error('[MUSIC CLEAN]', e.message); }
    // Ticket panels already posted get the current layout and texts (once, 20 s after start, when channels are cached)
    setTimeout(() => { require('../plugins/ticket.js').refreshPostedPanels(client).catch(e => console.error('[TICKET PANELS]', e.message)); }, 20000);
    try {
        const _servers = client.guilds.cache.size;
        const _users = client.guilds.cache.reduce((t, g) => t + g.memberCount, 0);
        const _cmds = client.commands?.size || 0;
        const _ver = client.version || '3.1.0';
        await client.user.setAboutMe(
            `Hey! I'm ARCHON CG-223 🦅\n\n` +
            `Running on ${_servers} servers, helping ${_users.toLocaleString()} people ` +
            `manage their communities — built from scratch in Bamako, Mali 🇲🇱\n\n` +
            `What I do:\n` +
            `• Lydia AI speaks 28 languages naturally\n` +
            `• Economy, leveling & daily rewards\n` +
            `• AutoMod, tickets & smart broadcast\n` +
            `• Music, games, giveaways & trivia\n` +
            `• Auto-replies that feel human\n\n` +
            `${_cmds} commands • v${_ver} • Not a fork, not a template.\n\n` +
            `🌐 bamako-steel-dev.xyz\n` +
            `💬 discord.gg/NFSMFJajp9\n\n` +
            `— @MFOF7310`
        );
        console.log(`${green}[PROFILE]${reset} About Me set successfully`);
    } catch (e) {
        // setAboutMe not supported for bots — skipping silently
    }

    // Start status rotation
    rotateStatus();
    setInterval(rotateStatus, 60 * 1000); // Every 60s
 client.on('shardResume', () => rotateStatus()); // presence drops on reconnect
    console.log(`${green}[STATUS]${reset} Rotating status active (${STATUS_MESSAGES.length} messages, 60s interval)`);
});

// ── Discord Login ──



};
