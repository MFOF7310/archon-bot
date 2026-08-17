const { exec } = require('child_process');

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function run(cmd, timeout = 15000) {
    return new Promise((res) =>
        exec(cmd, { timeout }, (err, stdout, stderr) =>
            res({ out: stdout?.trim() || '', err: stderr?.trim() || err?.message || '' })
        )
    );
}

const PROCESSES = {
    'arch': 'Architect-CG223',
    'bot': 'Architect-CG223',
    'dash': 'architect-dashboard',
    'dashboard': 'architect-dashboard',
    'lava': 'lavalink',
    'lavalink': 'lavalink',
    'wa': 'archon-wa',
    'whatsapp': 'archon-wa',
};

module.exports = {
    name: 'sysctl',
    aliases: ['admin', 'sys', 'process', 'pm2cmd'],
    description: 'PM2 process manager from Telegram',
    category: 'System',
    usage: '/pm2 <command>',
    ownerOnly: true,

    handler: async (ctx) => {
        const tgOwnerId = process.env.TELEGRAM_CHAT_ID || process.env.OWNER_ID;
if (String(ctx.userId) !== String(tgOwnerId) && !ctx.isOwner()) return ctx.replyHTML(`⛔ Owner only command.`);

        const sub = ctx.args[0]?.toLowerCase();
        const target = ctx.args[1]?.toLowerCase();
        const proc = PROCESSES[target] || target;

        await ctx.action('typing');

        // ── STATUS ──
        if (!sub || sub === 'status' || sub === 'list' || sub === 'ls') {
            const { out } = await run('pm2 jlist');
            try {
                const list = JSON.parse(out);
                let msg = `🖥️ <b>PM2 Process Status</b>\n━━━━━━━━━━━━━━━━\n\n`;
                list.forEach(p => {
                    const status = p.pm2_env?.status;
                    const emoji = status === 'online' ? '🟢' : status === 'stopped' ? '🔴' : '🟡';
                    const mem = ((p.monit?.memory || 0) / 1024 / 1024).toFixed(1);
                    const cpu = p.monit?.cpu || 0;
                    const restarts = p.pm2_env?.restart_time || 0;
                    msg += `${emoji} <b>${escapeHTML(p.name)}</b> <code>[${p.pm_id}]</code>\n`;
                    msg += `   📊 ${status} • 💾 ${mem}MB • ⚡ ${cpu}% • 🔄 ${restarts} restarts\n\n`;
                });
                msg += `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`;
                return ctx.replyHTML(msg);
            } catch(e) {
                return ctx.replyHTML(`<pre>${escapeHTML(out.substring(0, 3000))}</pre>`);
            }
        }

        // ── LOGS ──
        if (sub === 'logs' || sub === 'log') {
            const lines = ctx.args[2] || ctx.args[3] || '20';
            const procName = proc || 'Architect-CG223';
            const { out, err } = await run(`pm2 logs ${procName} --lines ${lines} --nostream 2>&1`);
            const combined = (out + '\n' + err).trim();
            // Clean PM2 formatting
            const clean = combined
                .split('\n')
                .filter(l => l.trim())
                .map(l => l.replace(/^\d+\|[\w-]+\s*\|\s*/, '').trim())
                .filter(l => l)
                .slice(-30)
                .join('\n');
            return ctx.replyHTML(
                `📋 <b>Logs: ${escapeHTML(procName)}</b> (last ${lines} lines)\n━━━━━━━━━━━━━━━━\n\n` +
                `<pre>${escapeHTML(clean.substring(0, 3500))}</pre>`
            );
        }

        // ── RESTART ──
        if (sub === 'restart' || sub === 'rs') {
            if (!proc) return ctx.replyHTML(`💡 Usage: <code>/pm2 restart arch|dash|lava|wa</code>`);
            await ctx.replyHTML(`🔄 <i>Restarting ${escapeHTML(proc)}...</i>`);
            // Use correct working directory for env loading
            const dirs = {
                'Architect-CG223': '/root/cloud-gaming-223-digital-engine',
                'architect-dashboard': '/opt/dashboard',
                'levanter': '/root/levanter',
                'neo-afriquiz': '/root/neo-bot',
                'openclaw-gateway': '/root'
            };
            const cwd = dirs[proc] || '/root';
            const { out, err } = await run(`cd ${cwd} && pm2 restart ${proc} --update-env 2>&1`);
            // Wait 3s then verify it's actually online
            await new Promise(r => setTimeout(r, 3000));
            const { out: check } = await run(`pm2 jlist`);
            let online = false;
            try {
                const list = JSON.parse(check);
                const p = list.find(p => p.name === proc);
                online = p?.pm2_env?.status === 'online';
            } catch {}
            return ctx.replyHTML(
                `${online ? '✅' : '❌'} <b>${escapeHTML(proc)}</b> is ${online ? 'online' : 'NOT online — check logs!'}\n\n` +
                `<pre>${escapeHTML((out + err).substring(0, 800))}</pre>`
            );
        }

        // ── STOP ──
        if (sub === 'stop') {
            if (!proc) return ctx.replyHTML(`💡 Usage: <code>/pm2 stop arch|dash|lava|wa</code>`);
            if (proc === 'Architect-CG223') return ctx.replyHTML(`⚠️ Can't stop the main bot from here!`);
            const { out } = await run(`pm2 stop ${proc} 2>&1`);
            return ctx.replyHTML(`🔴 <b>Stopped: ${escapeHTML(proc)}</b>\n<pre>${escapeHTML(out.substring(0, 500))}</pre>`);
        }

        // ── RELOAD ──
        if (sub === 'reload') {
            if (!proc) return ctx.replyHTML(`💡 Usage: <code>/pm2 reload arch|dash</code>`);
            const { out } = await run(`pm2 reload ${proc} 2>&1`);
            return ctx.replyHTML(`♻️ <b>Reloaded: ${escapeHTML(proc)}</b>\n<pre>${escapeHTML(out.substring(0, 500))}</pre>`);
        }

        // ── FLUSH ──
        if (sub === 'flush') {
            const { out } = await run(`pm2 flush 2>&1`);
            return ctx.replyHTML(`🗑️ <b>Logs flushed!</b>\n<pre>${escapeHTML(out.substring(0, 500))}</pre>`);
        }

        // ── SAVE ──
        if (sub === 'save') {
            const { out } = await run(`pm2 save 2>&1`);
            return ctx.replyHTML(`💾 <b>PM2 state saved!</b>\n<pre>${escapeHTML(out.substring(0, 500))}</pre>`);
        }

        // ── INFO ──
        if (sub === 'info' || sub === 'show') {
            if (!proc) return ctx.replyHTML(`💡 Usage: <code>/pm2 info arch|dash</code>`);
            const { out } = await run(`pm2 show ${proc} 2>&1`);
            const clean = out.replace(/\x1b\[[0-9;]*m/g, '').substring(0, 3000);
            return ctx.replyHTML(`ℹ️ <b>Info: ${escapeHTML(proc)}</b>\n<pre>${escapeHTML(clean)}</pre>`);
        }

        // ── MONIT (quick stats) ──
        if (sub === 'monit' || sub === 'stats') {
            const { out } = await run(`pm2 jlist`);
            try {
                const list = JSON.parse(out);
                const total_mem = list.reduce((s, p) => s + (p.monit?.memory || 0), 0);
                let msg = `📊 <b>System Monitor</b>\n━━━━━━━━━━━━━━━━\n\n`;
                msg += `💾 Total RAM: <b>${(total_mem / 1024 / 1024).toFixed(1)}MB</b>\n`;
                msg += `🔄 Processes: <b>${list.length}</b>\n`;
                msg += `🟢 Online: <b>${list.filter(p => p.pm2_env?.status === 'online').length}</b>\n\n`;
                list.forEach(p => {
                    const mem = ((p.monit?.memory || 0) / 1024 / 1024).toFixed(1);
                    const cpu = p.monit?.cpu || 0;
                    msg += `• <b>${escapeHTML(p.name)}</b> — ${mem}MB / ${cpu}%\n`;
                });
                return ctx.replyHTML(msg + `\n🦅 BAMAKO_223 🇲🇱`);
            } catch(e) {
                return ctx.replyHTML(`❌ Failed to parse PM2 data`);
            }
        }

        // ── HELP ──
        return ctx.replyHTML(
            `🖥️ <b>PM2 Manager</b> — Owner Only\n━━━━━━━━━━━━━━━━\n\n` +
            `<code>/pm2 status</code> — All processes\n` +
            `<code>/pm2 logs arch 30</code> — Last 30 lines\n` +
            `<code>/pm2 logs dash</code> — Dashboard logs\n` +
            `<code>/pm2 restart arch</code> — Restart bot\n` +
            `<code>/pm2 restart dash</code> — Restart dashboard\n` +
            `<code>/pm2 reload arch</code> — Zero-downtime reload\n` +
            `<code>/pm2 stop lava</code> — Stop Lavalink\n` +
            `<code>/pm2 flush</code> — Clear all logs\n` +
            `<code>/pm2 save</code> — Save PM2 state\n` +
            `<code>/pm2 monit</code> — Quick stats\n` +
            `<code>/pm2 info arch</code> — Detailed info\n\n` +
            `📌 Aliases: arch=bot, dash=dashboard, lava=lavalink, wa=whatsapp\n\n` +
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
        );
    }
};
