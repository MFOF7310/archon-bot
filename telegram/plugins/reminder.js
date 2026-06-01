// ═══════════════════════════════════════════
//  TG COMMAND: Reminder (NEW)
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

const activeReminders = new Map();
const TIMEOUT = 300000;

function parseDuration(str) {
    if (!str) return null;
    const m = str.match(/^(\d+)([smhd])$/i);
    if (!m) return null;
    const val = parseInt(m[1]);
    const unit = m[2].toLowerCase();
    const mult = { s: 1, m: 60, h: 3600, d: 86400 };
    return { seconds: val * (mult[unit] || 1), text: `${val} ${unit === 's' ? 'sec' : unit === 'm' ? 'min' : unit === 'h' ? 'hour' : 'day'}${val > 1 ? 's' : ''}` };
}

module.exports = {
    name: 'reminder',
    description: 'Set a reminder that pings you later',
    category: 'Utility',
    usage: '/reminder 2h Check the oven',
    aliases: ['remind', 'rem', 'timer'],

    handler: async (ctx) => {
        const args = ctx.args;
        const action = args[0]?.toLowerCase();

        // List
        if (!action || action === 'list') {
            const userRems = getUserReminders(ctx.userId);
            if (userRems.length === 0) {
                return ctx.replyHTML(
                    `⏰ <b>Your Reminders</b>\n\n` +
                    `No active reminders.\n\n<code>/reminder 1h Take a break</code>`
                );
            }
            let msg = `⏰ <b>Your Reminders</b>\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            userRems.forEach((r, i) => {
                const left = Math.max(0, Math.floor((r.fireAt - Date.now()) / 60000));
                msg += `${i + 1}. ${escapeHTML(r.text.substring(0, 40))}\n   ⏳ ${left}m left\n`;
            });
            return ctx.replyHTML(msg);
        }

        // Cancel
        if (action === 'cancel') {
            const userRems = getUserReminders(ctx.userId);
            const index = parseInt(args[1]) - 1;
            if (isNaN(index) || index < 0 || index >= userRems.length) {
                return ctx.replyHTML(`❌ Invalid. Use <code>/reminder list</code>.`);
            }
            clearTimeout(userRems[index].timer);
            activeReminders.delete(userRems[index].id);
            return ctx.replyHTML(`✅ Cancelled: "${escapeHTML(userRems[index].text)}"`);
        }

        // Set
        const duration = parseDuration(args[0]);
        if (!duration) {
            return ctx.replyHTML(
                `⏰ <b>Reminder</b>\n\n` +
                `<code>/reminder 30m Check oven</code>\n` +
                `<code>/reminder 2h Meeting</code>\n` +
                `<code>/reminder 1d Birthday</code>\n\n` +
                `Units: s, m, h, d`
            );
        }

        const text = args.slice(1).join(' ') || 'Reminder!';
        const fireAt = Date.now() + (duration.seconds * 1000);
        const id = `rem_${ctx.userId}_${Date.now()}`;

        const timer = setTimeout(() => {
            ctx.replyHTML(
                `⏰ <b>REMINDER</b>\n━━━━━━━━━━━━━━━━━━━━\n\n` +
                `🔔 ${escapeHTML(text)}\n\n<i>Set ${duration.text} ago</i>`
            ).catch(() => {});
            activeReminders.delete(id);
        }, duration.seconds * 1000);

        activeReminders.set(id, { id, userId: ctx.userId, chatId: ctx.chatId, text, fireAt, timer });

        ctx.replyHTML(
            `✅ <b>Reminder Set!</b>\n\n` +
            `📝 ${escapeHTML(text.substring(0, 100))}\n` +
            `⏰ In: <b>${duration.text}</b>\n\n` +
            `<code>/reminder list</code> · <code>/reminder cancel 1</code>`
        );
    }
};

function getUserReminders(userId) {
    return Array.from(activeReminders.values()).filter(r => r.userId === userId);
}
