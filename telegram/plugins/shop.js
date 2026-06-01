// ═══════════════════════════════════════════
//  TG COMMAND: Shop
// ═══════════════════════════════════════════

function escapeHTML(t) { return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const formatNumber = (n) => n?.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',') || '0';

module.exports = {
    name: 'shop',
    description: 'Browse the Neural Marketplace',
    category: 'Economy',
    usage: '/shop [category]',
    aliases: ['store', 'market', 'buy'],

    handler: async (ctx) => {
        const items = ctx.client?.shopItems || [];
        const category = ctx.args[0]?.toLowerCase();
        const filtered = category ? items.filter(i => i.type === category) : items;

        if (filtered.length === 0) {
            return ctx.replyHTML(`🛒 <b>NEURAL MARKETPLACE</b>\n📍 BAMAKO_223 🇲🇱\n\nComing soon! Use <code>/balance</code>.`);
        }

        let msg = `🛒 <b>NEURAL MARKETPLACE</b>\n📍 BAMAKO_223 🇲🇱\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        filtered.slice(0, 15).forEach(item => {
            const name = item.en?.name || item.id;
            const desc = item.en?.perk || item.en?.desc || '';
            msg += `${item.emoji || '📦'} <b>${escapeHTML(name)}</b>\n`;
            msg += `   💰 ${formatNumber(item.price || 0)} Credits\n`;
            msg += `   📝 ${escapeHTML(desc)}\n\n`;
        });

        if (filtered.length > 15) msg += `<i>...and ${filtered.length - 15} more</i>\n\n`;
        msg += `💰 Total: ${filtered.length} items`;
        await ctx.replyHTML(msg);
    }
};
