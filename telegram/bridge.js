// ================= TELEGRAM BRIDGE CORE v1.7.0 =================
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const green = "\x1b[32m", yellow = "\x1b[33m", red = "\x1b[31m", cyan = "\x1b[36m", reset = "\x1b[0m";

// ================= SAFE HTML ESCAPE FUNCTION =================
function escapeHTML(text) {
    if (!text || typeof text !== 'string') return "";
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = {
    initialize: (client) => {
        const bridge = {
            enabled: false,
            token: process.env.TELEGRAM_BOT_TOKEN || null,
            chatId: process.env.TELEGRAM_CHAT_ID || null,
            
            status: function() {
                return {
                    configured: !!(this.token && this.chatId),
                    enabled: this.enabled,
                    version: '1.7.0'
                };
            },
            
            send: async function(content, options = {}) {
                if (!this.enabled) return { success: false, error: 'Bridge disabled' };
                if (!this.token || !this.chatId) return { success: false, error: 'Missing credentials' };
                
                // Sécurité : Échapper le texte si ce n'est pas du HTML volontaire
                const finalContent = options.parse_mode === 'HTML' ? content : escapeHTML(content);
                
                try {
                    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
                    const response = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chat_id: this.chatId,
                            text: finalContent,
                            parse_mode: options.parse_mode || 'HTML',
                            disable_web_page_preview: options.disable_preview || false
                        })
                    });
                    
                    const data = await response.json();
                    if (data.ok) {
                        console.log(`${green}[TELEGRAM]${reset} Message sent to ${this.chatId}`);
                        return { success: true, data };
                    }
                    console.error(`${red}[TELEGRAM]${reset} API Error:`, data.description);
                    return { success: false, error: data.description };
                } catch (err) {
                    console.error(`${red}[TELEGRAM]${reset} Error:`, err.message);
                    return { success: false, error: err.message };
                }
            },
            
            activate: function() {
                if (!this.token || !this.chatId) {
                    console.log(`${yellow}[TELEGRAM]${reset} Missing credentials in .env`);
                    return { success: false, error: 'Missing credentials in .env' };
                }
                this.enabled = true;
                console.log(`${green}[TELEGRAM]${reset} ACTIVATED - BAMAKO_223 🇲🇱 connected to ${this.chatId}`);
                return { success: true, message: 'Activated' };
            },
            
            deactivate: function() {
                this.enabled = false;
                console.log(`${yellow}[TELEGRAM]${reset} DEACTIVATED`);
                return { success: true, message: 'Deactivated' };
            },
            
            info: function() {
                const status = this.status();
                return {
                    ...status,
                    token: this.token ? '***configured***' : 'missing',
                    chatId: this.chatId || 'missing'
                };
            }
        };
        
        // Attacher au client
        client.telegramBridge = bridge;
        
        return bridge;
    }
};