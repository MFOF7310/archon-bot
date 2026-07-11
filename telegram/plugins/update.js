const https = require('https');
const { execSync } = require('child_process');

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function githubFetch(url) {
    return new Promise((res) => {
        https.get(url, { headers: { 'User-Agent': 'ARCHON-CG223' } }, (r) => {
            let d = '';
            r.on('data', c => d += c);
            r.on('end', () => { try { res(JSON.parse(d)); } catch { res(null); } });
        }).on('error', () => res(null));
    });
}

async function checkUpdates() {
    try {
        // Get local commit
        const localHash = execSync('git -C /root/cloud-gaming-223-digital-engine rev-parse HEAD').toString().trim();
        const localShort = localHash.substring(0, 7);

        // Get remote commits
        const commits = await githubFetch('https://api.github.com/repos/MFOF7310/cloud-gaming-223-digital-engine/commits?per_page=5');
        if (!commits || !Array.isArray(commits)) return null;

        const remoteHash = commits[0]?.sha;
        const remoteShort = remoteHash?.substring(0, 7);

        if (!remoteHash || remoteHash === localHash) return { upToDate: true, localShort };

        // Find new commits
        const localIdx = commits.findIndex(c => c.sha === localHash);
        const newCommits = localIdx === -1 ? commits : commits.slice(0, localIdx);

        return {
            upToDate: false,
            localShort,
            remoteShort,
            newCommits: newCommits.map(c => ({
                message: c.commit?.message?.split('\n')[0] || 'Unknown',
                author: c.commit?.author?.name || 'Unknown',
                date: c.commit?.author?.date?.split('T')[0] || '',
            }))
        };
    } catch(e) {
        return null;
    }
}

module.exports = {
    name: 'update',
    aliases: ['checkupdate', 'version', 'ver'],
    description: 'Check for ARCHON updates',
    category: 'System',
    usage: '/update',
    ownerOnly: true,

    // Auto-check called on boot
    autoCheck: async (bridge, chatId) => {
        try {
            const result = await checkUpdates();
            if (!result || result.upToDate) return;

            const commitList = result.newCommits.slice(0, 5).map((c, i) =>
                `${i+1}. ${escapeHTML(c.message)}`
            ).join('\n');

            await bridge.sendTo(chatId,
                `🔄 <b>Update Available!</b>\n━━━━━━━━━━━━━━━━\n\n` +
                `<b>${result.newCommits.length} new commit(s)</b> since <code>${result.localShort}</code>\n\n` +
                `${commitList}\n\n` +
                `💡 Use <code>/update pull</code> to update\n` +
                `⚠️ Always backup before updating!\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
                { parse_mode: 'HTML' }
            );
        } catch(e) {}
    },

    handler: async (ctx) => {
        if (!ctx.isOwner()) return ctx.replyHTML(`⛔ Owner only!`);

        const sub = ctx.args[0]?.toLowerCase();

        // Pull update
        if (sub === 'pull' || sub === 'now') {
            await ctx.replyHTML(`⏳ <i>Pulling latest changes...</i>`);
            try {
                const out = execSync('git -C /root/cloud-gaming-223-digital-engine pull origin main 2>&1', { timeout: 30000 }).toString();
                const clean = out.trim().substring(0, 1000);
                
                if (out.includes('Already up to date')) {
                    return ctx.replyHTML(`✅ <b>Already up to date!</b>\n\n<code>${escapeHTML(clean)}</code>\n\n🦅 ARCHON CG-223`);
                }

                await ctx.replyHTML(
                    `✅ <b>Update pulled!</b>\n\n<code>${escapeHTML(clean)}</code>\n\n` +
                    `⚡ Use <code>/sysctl restart arch</code> to apply changes!\n\n` +
                    `🦅 ARCHON CG-223`
                );
            } catch(e) {
                await ctx.replyHTML(`❌ Pull failed!\n\n<code>${escapeHTML(e.message.substring(0,500))}</code>`);
            }
            return;
        }

        // Check status
        await ctx.action('typing');
        const result = await checkUpdates();

        if (!result) {
            return ctx.replyHTML(`❌ Couldn't check for updates — GitHub might be unreachable!`);
        }

        if (result.upToDate) {
            return ctx.replyHTML(
                `✅ <b>ARCHON is up to date!</b>\n\n` +
                `Current: <code>${result.localShort}</code>\n\n` +
                `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`
            );
        }

        const commitList = result.newCommits.slice(0, 5).map((c, i) =>
            `${i+1}. <code>${escapeHTML(c.message.substring(0,60))}</code>\n   <i>${c.date}</i>`
        ).join('\n\n');

        await ctx.replyHTML(
            `🔄 <b>Update Available!</b>\n━━━━━━━━━━━━━━━━\n\n` +
            `Local:  <code>${result.localShort}</code>\n` +
            `Remote: <code>${result.remoteShort}</code>\n\n` +
            `<b>${result.newCommits.length} new commit(s):</b>\n\n` +
            `${commitList}\n\n` +
            `Use <code>/update pull</code> to update 🚀\n\n` +
            `🦅 ARCHON CG-223 • BAMAKO_223 🇲🇱`,
            {
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🚀 Update Now', callback_data: 'update_pull' },
                        { text: '❌ Later', callback_data: 'update_skip' }
                    ]]
                }
            }
        );
    }
};
