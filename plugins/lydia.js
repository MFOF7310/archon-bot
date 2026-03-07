const fs = require('fs');
const path = require('path');
const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia Auto-AI mode.',
    async execute(message, args, client) {
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const isAdmin = message.member.permissions.has('Administrator');

        if (!isArchitect && !isAdmin) return message.reply("❌ **Restricted.**");

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try { statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8')); } catch (e) {}
        }

        if (!statusDB[message.channel.id]) {
            statusDB[message.channel.id] = true;
            message.reply("🧬 **Lydia:** [ONLINE]");
        } else {
            delete statusDB[message.channel.id];
            message.reply("💤 **Lydia:** [OFFLINE]");
        }
        fs.writeFileSync(lydiaPath, JSON.stringify(statusDB, null, 4));
    },
};
