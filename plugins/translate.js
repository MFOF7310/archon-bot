module.exports = {
    name: 'trt',
    async execute(message, args) {
        const lang = args[0];
        const text = args.slice(1).join(" ");
        if (!lang || !text) return message.reply("❌ Usage: `,trt [lang] [text]` (e.g., `,trt fr Hello`)");
        
        const thinking = await message.reply("🔄 **Translating...**");
        // This leverages the Gemini model logic from your index.js
        return message.client.commands.get('gemini').execute(message, [`translate this to ${lang}: ${text}`], message.client);
    }
};
