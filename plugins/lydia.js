const fs = require('fs');
const path = require('path');
const statusPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia Auto-AI mode (Reply-based).',

    async execute(message, args, client, model) {
        // 1. Check Permissions (Architect or Admin only)
        const ARCHITECT_ID = process.env.OWNER_ID;
        if (message.author.id !== ARCHITECT_ID && !message.member.permissions.has('Administrator')) {
            return message.reply("❌ **Restricted:** Only the Architect or Admins can toggle Lydia.");
        }

        // 2. Load Status Database
        let statusDB = {};
        if (fs.existsSync(statusPath)) {
            statusDB = JSON.parse(fs.readFileSync(statusPath, 'utf8'));
        }

        const channelID = message.channel.id;

        // 3. Toggle Logic (ON/OFF)
        if (!statusDB[channelID]) {
            statusDB[channelID] = true;
            fs.writeFileSync(statusPath, JSON.stringify(statusDB, null, 4));
            return message.reply("🧬 **Lydia System:** [ONLINE] - *I will now respond to replies in this channel.*");
        } else {
            delete statusDB[channelID];
            fs.writeFileSync(statusPath, JSON.stringify(statusDB, null, 4));
            return message.reply("💤 **Lydia System:** [OFFLINE] - *Powering down...*");
        }
    },
};
