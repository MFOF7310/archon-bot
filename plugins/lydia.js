const fs = require('fs');
const path = require('path');

const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia AI (on/off)',

    async execute(message, args) {

        const choice = args[0]?.toLowerCase();

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch (err) {
                statusDB = {};
            }
        }

        if (choice === 'on') {

            statusDB[message.channel.id] = true;

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "🧬 **Lydia AI Activated**\nYou can now mention me to chat!"
            );
        }

        if (choice === 'off') {

            delete statusDB[message.channel.id];

            fs.writeFileSync(
                lydiaPath,
                JSON.stringify(statusDB, null, 4)
            );

            return message.reply(
                "💤 **Lydia AI Deactivated**"
            );
        }

        return message.reply(
            "❓ Usage: `,lydia on` or `,lydia off`"
        );
    },

    async onMessage(message, client) {

        if (message.author.bot) return;

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try {
                statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));
            } catch {}
        }

        if (!statusDB[message.channel.id]) return;

        if (!message.mentions.has(client.user)) return;

        const username = message.member?.displayName || message.author.username;

        const responses = [

            `Hello **${username}** 👋 I'm **Cloud_Gaming-bot**, your friendly AI assistant.`,
            
            `Nice to see you **${username}**! I'm Cloud_Gaming-bot, here to help the server.`,
            
            `Greetings **${username}** 😊 Cloud_Gaming-bot at your service.`,
            
            `Hey **${username}**! Need help with something?`
        ];

        const intro = `✨ **About me**  
I am **Cloud_Gaming-bot**, an AI assistant designed to help and interact with the community.

👨‍💻 **Creator:** Moussa Fofana  
🤖 **Purpose:** Assist, chat, and make this server more fun!`;

        const randomReply = responses[Math.floor(Math.random() * responses.length)];

        message.reply(`${randomReply}\n\n${intro}`);
    }
};