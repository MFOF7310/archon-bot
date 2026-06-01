// ═══════════════════════════════════════════
//  TG COMMAND: Lydia AI (OpenRouter)
// ═══════════════════════════════════════════

const https = require('https');

const MAX_HISTORY = 12;
const AI_MODEL = process.env.AI_MODEL || 'google/gemini-2.0-flash-001';
const AI_FALLBACK = process.env.AI_FALLBACK_MODEL || 'google/gemini-2.0-flash-001';

module.exports = {
    name: 'lydia',
    description: 'AI assistant powered by OpenRouter',
    category: 'AI',
    usage: '/lydia <message> | /lydia on | /lydia off | /lydia clear',
    aliases: ['ai', 'ask', 'chat', 'gpt'],

    handler: async (ctx) => {
        const args = ctx.args;
        const chatId = String(ctx.chatId);
        const userId = String(ctx.userId);
        const username = ctx.username;
        const userMsg = args.join(' ');
        const apiKey = process.env.OPENROUTER_API_KEY;

        // Sub-commands
        if (!userMsg || userMsg.toLowerCase() === 'help') {
            return ctx.reply(
                `🦅 Lydia AI Assistant\n\n` +
                `/lydia <msg>  · Ask anything\n` +
                `/lydia on     · Enable auto-reply\n` +
                `/lydia off    · Disable auto-reply\n` +
                `/lydia clear  · Reset memory\n` +
                `/lydia status · View status`
            );
        }

        if (userMsg.toLowerCase() === 'on') {
            ctx.lydiaActiveChats.add(chatId);
            return ctx.replyHTML(`🟢 <b>AI activated</b> in this chat.`);
        }
        if (userMsg.toLowerCase() === 'off') {
            ctx.lydiaActiveChats.delete(chatId);
            return ctx.replyHTML(`⚪ <b>AI deactivated</b>.`);
        }
        if (userMsg.toLowerCase() === 'clear') {
            ctx.conversations.set(userId, []);
            return ctx.replyHTML(`✅ <b>Memory cleared</b>.`);
        }
        if (userMsg.toLowerCase() === 'status') {
            const history = ctx.conversations.get(userId) || [];
            return ctx.reply(`🟢 Lydia Online · ${history.length / 2}/${MAX_HISTORY / 2} exchanges · ${ctx.lydiaActiveChats.size} active chats`);
        }

        // AI Chat
        if (!apiKey) {
            console.log('[LYDIA] No OPENROUTER_API_KEY in env');
            return ctx.replyHTML(`⚠️ AI API key not configured.`);
        }

        await ctx.action('typing');

        if (!ctx.conversations.has(userId)) ctx.conversations.set(userId, []);
        const history = ctx.conversations.get(userId);

        const isCreator = userId === String(process.env.TELEGRAM_CHAT_ID) || username.toLowerCase() === 'mfof7310';
        const isGroup = ctx.isGroup;

        let systemAddon = '';
        if (isCreator) systemAddon = `\nSpeaking to CREATOR Moussa. Show respect.`;
        if (isGroup) systemAddon += `\nGroup chat. Keep responses concise.`;

        let prompt = userMsg;
        if (isGroup) prompt = `[${username}]: ${userMsg}`;
        if (isCreator) prompt = `[${username} (CREATOR)]: ${userMsg}`;

        try {
            const response = await getAIResponse(prompt, history, systemAddon, apiKey);
            history.push({ role: 'user', content: userMsg }, { role: 'assistant', content: response });
            if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
            await ctx.replyHTML(response);
        } catch (err) {
            console.error('[LYDIA] ERROR:', err.message);
            ctx.replyHTML(`⚠️ AI temporarily unavailable.\n\n<i>${escapeHTML(err.message.substring(0, 100))}</i>`);
        }
    }
};

function escapeHTML(t) {
    return !t || typeof t !== 'string' ? '' : t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function getAIResponse(userMessage, history, systemAddon, apiKey) {
    const system = `You are Lydia, the AI assistant of Archon CG-223 — a bot created by Moussa Fofana (@mfof7310) from Bamako, Mali.\n\nRULES:\n- Be concise, natural, polite (under 150 words)\n- Use Telegram HTML: <b>bold</b>, <i>italic</i>, <code>code</code>\n- Creator: Moussa Fofana from Bamako, Mali\n- Version: v3.0.0\n- Node: BAMAKO_223 🇲🇱${systemAddon}`;

    const messages = [
        { role: 'system', content: system },
        ...history,
        { role: 'user', content: userMessage }
    ];

    const requestBody = JSON.stringify({
        model: AI_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 800
    });

    console.log(`[LYDIA] Sending request, model: ${AI_MODEL}, history: ${history.length} msgs`);

    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'openrouter.ai',
            path: '/api/v1/chat/completions',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://github.com/MFOF7310',
                'X-Title': 'ArchonCG223',
                'Content-Length': Buffer.byteLength(requestBody)
            }
        };

        const req = https.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                console.log(`[LYDIA] Response status: ${res.statusCode}`);

                if (res.statusCode !== 200) {
                    console.error(`[LYDIA] API error ${res.statusCode}: ${data.substring(0, 200)}`);
                    reject(new Error(`API error ${res.statusCode}`));
                    return;
                }

                try {
                    const json = JSON.parse(data);
                    if (json.error) {
                        console.error(`[LYDIA] API error: ${JSON.stringify(json.error)}`);
                        reject(new Error(json.error.message || 'API error'));
                        return;
                    }
                    if (json.choices?.[0]?.message?.content) {
                        console.log(`[LYDIA] Got response, length: ${json.choices[0].message.content.length}`);
                        resolve(json.choices[0].message.content);
                    } else {
                        console.error(`[LYDIA] No content in response: ${data.substring(0, 200)}`);
                        reject(new Error('Empty AI response'));
                    }
                } catch (e) {
                    console.error(`[LYDIA] JSON parse error: ${e.message}`);
                    reject(new Error('Parse error'));
                }
            });
        });

        req.on('error', (err) => {
            console.error(`[LYDIA] Request error: ${err.message}`);
            reject(err);
        });

        // Use setTimeout, NOT options.timeout
        req.setTimeout(25000, () => {
            console.error('[LYDIA] Request timed out after 25s');
            req.destroy();
            reject(new Error('Timeout'));
        });

        req.write(requestBody);
        req.end();
    });
}
