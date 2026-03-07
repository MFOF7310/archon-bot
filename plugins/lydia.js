const fs = require('fs');
const path = require('path');
// Point to the same file the index uses
const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia Auto-AI mode in this channel.',

    async execute(message, args, client) {
        // Permission Check: Architect (from .env) or Server Admin
        const isArchitect = message.author.id === process.env.OWNER_ID;
        const isAdmin = message.member.permissions.has('Administrator');

        if (!isArchitect && !isAdmin) {
            return message.reply("❌ **Restricted:** Only the Architect or Admins can toggle Lydia.");
        }

        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try { statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8')); } catch (e) { statusDB = {}; }
        }

        const channelID = message.channel.id;

        if (!statusDB[channelID]) {
            statusDB[channelID] = true;
            fs.writeFileSync(lydiaPath, JSON.stringify(statusDB, null, 4));
            return message.reply("🧬 **Lydia System:** [ONLINE]\n*I will now auto-reply to any message you reply to me with.*");
        } else {
            delete statusDB[channelID];
            fs.writeFileSync(lydiaPath, JSON.stringify(statusDB, null, 4));
            return message.reply("💤 **Lydia System:** [OFFLINE]\n*Auto-reply disabled for this channel.*");
        }
    },
};