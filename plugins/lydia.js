const fs = require('fs');
const path = require('path');
const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {
    name: 'lydia',
    category: 'AI',
    description: 'Toggle Lydia (on/off).',
    async execute(message, args) {
        const choice = args[0]?.toLowerCase();
        let statusDB = {};
        if (fs.existsSync(lydiaPath)) {
            try { statusDB = JSON.parse(fs.readFileSync(lydiaPath, 'utf8')); } catch (e) {}
        }

        if (choice === 'on') {
            statusDB[message.channel.id] = true;
            fs.writeFileSync(lydiaPath, JSON.stringify(statusDB, null, 4));
            return message.reply("🧬 **Lydia Activated**");
        } 
        if (choice === 'off') {
            delete statusDB[message.channel.id];
            fs.writeFileSync(lydiaPath, JSON.stringify(statusDB, null, 4));
            return message.reply("💤 **Lydia Deactivated**");
        }
        return message.reply("❓ Usage: `,lydia on` or `,lydia off`").then(m => setTimeout(() => m.delete(), 5000));
    }
};
