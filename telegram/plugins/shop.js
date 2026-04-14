module.exports = {
    name: 'shop',
    aliases: ['store', 'market', 'boutique'],
    run: async (ctx) => {
        const shopItems = ctx.client?.shopItems || [];
        const version = ctx.client?.version || '1.7.0';
        const args = ctx.args || [];
        const category = args[0]?.toLowerCase();
        
        let filteredItems = shopItems;
        if (category) {
            filteredItems = shopItems.filter(item => item.type === category);
        }
        
        if (filteredItems.length === 0) {
            await ctx.replyWithHTML(
                `🛒 <b>NEURAL MARKETPLACE v${version}</b>\n\n` +
                `❌ No items found.\n\n` +
                `<b>Categories:</b> consumable, role, badge`
            );
            return;
        }
        
        let shopText = `🛒 <b>NEURAL MARKETPLACE v${version}</b>\n`;
        shopText += `📍 BAMAKO_223 🇲🇱\n`;
        shopText += `━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        filteredItems.slice(0, 10).forEach(item => {
            shopText += `${item.emoji} <b>${item.en?.name || item.id}</b>\n`;
            shopText += `   💰 ${item.price.toLocaleString()} Credits\n`;
            shopText += `   📝 ${item.en?.perk || item.en?.desc || ''}\n\n`;
        });
        
        if (filteredItems.length > 10) {
            shopText += `<i>...and ${filteredItems.length - 10} more items</i>\n\n`;
        }
        
        shopText += `━━━━━━━━━━━━━━━━━━━━\n`;
        shopText += `💰 Total: ${shopItems.length} items\n`;
        shopText += `🛒 Use /balance to check credits`;
        
        await ctx.replyWithHTML(shopText);
    }
};