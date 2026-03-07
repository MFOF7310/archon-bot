const fs = require('fs');

const path = require('path');

const lydiaPath = path.join(__dirname, '../lydia_status.json');

module.exports = {

    name: 'lydia',

    category: 'AI',

    description: 'Enable or disable Lydia AI in this channel',

    async execute(message, args, client) {

        // Only admins can toggle Lydia

        if (!message.member.permissions.has("ManageGuild")) {

            return message.reply("❌ Only server admins can control Lydia.");

        }

        const option = args[0]?.toLowerCase();

        let channels = {};

        if (fs.existsSync(lydiaPath)) {

            try {

                channels = JSON.parse(fs.readFileSync(lydiaPath, 'utf8'));

            } catch {

                channels = {};

            }

        }

        // TURN ON

        if (option === "on") {

            channels[message.channel.id] = true;

            fs.writeFileSync(lydiaPath, JSON.stringify(channels, null, 4));

            return message.reply(

                "🧠 **CLOUD_GAMING AI activated in this channel.**\nMembers can now **mention me or reply to my messages** to chat."

            );

        }

        // TURN OFF

        if (option === "off") {

            delete channels[message.channel.id];

            fs.writeFileSync(lydiaPath, JSON.stringify(channels, null, 4));

            return message.reply(

                "💤 **Cloud_Gaming AI disabled in this channel.**"

            );

        }

        return message.reply(

            "⚙ Usage:\n`,lydia on`\n`,lydia off`"

        );

    }

};