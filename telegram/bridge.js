// ================= TELEGRAM BRIDGE CORE v1.7.0 =================
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

module.exports = {
    initialize: (client) => ({
        enabled: false,
        token: process.env.TELEGRAM_BOT_TOKEN || null,
        chatId: process.env.TELEGRAM_CHAT_ID || null,
        
        status: () => ({
            configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
            enabled: client.telegramBridge?.enabled || false,
            version: '1.7.0'
        }),
        
        send: async (content, options = {}) => {
            const bridge = client.telegramBridge;
            if (!bridge.enabled) return { success: false, error: 'Bridge disabled' };
            if (!bridge.token || !bridge.chatId) return { success: false, error: 'Missing credentials' };
            
            try {
                const url = `https://api.telegram.org/bot${bridge.token}/sendMessage`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        chat_id: bridge.chatId,
                        text: content,
                        parse_mode: options.parse_mode || 'HTML',
                        disable_web_page_preview: options.disable_preview || false
                    })
                });
                
                const data = await response.json();
                if (data.ok) {
                    console.log(`${green}[TELEGRAM]${reset} Message sent to ${bridge.chatId}`);
                    return { success: true, data };
                }
                console.error(`${red}[TELEGRAM]${reset} API Error:`, data.description);
                return { success: false, error: data.description };
            } catch (err) {
                console.error(`${red}[TELEGRAM]${reset} Error:`, err.message);
                return { success: false, error: err.message };
            }
        },
        
        activate: () => {
            if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.TELEGRAM_CHAT_ID) {
                console.log(`${yellow}[TELEGRAM]${reset} Missing credentials in .env`);
                return { success: false, error: 'Missing credentials in .env' };
            }
            client.telegramBridge.enabled = true;
            console.log(`${green}[TELEGRAM]${reset} ACTIVATED - BAMAKO_223 🇲🇱 connected to ${client.telegramBridge.chatId}`);
            return { success: true, message: 'Activated' };
        },
        
        deactivate: () => {
            client.telegramBridge.enabled = false;
            console.log(`${yellow}[TELEGRAM]${reset} DEACTIVATED`);
            return { success: true, message: 'Deactivated' };
        },
        
        info: () => {
            const status = client.telegramBridge.status();
            return {
                ...status,
                token: client.telegramBridge.token ? '***configured***' : 'missing',
                chatId: client.telegramBridge.chatId || 'missing'
            };
        }
    })
};