const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'setprefix',
    category: 'SYSTEM',
    run: async (client, message, args, database) => {
        if (message.author.id !== process.env.OWNER_ID) return message.reply("⛔ **RESTRICTED.**");

        const newPrefix = args[0];
        if (!newPrefix || newPrefix.length > 3) return message.reply("⚠️ Prefix must be 1-3 characters.");

        try {
            const envPath = path.join(__dirname, '../.env');
            let envContent = fs.readFileSync(envPath, 'utf8');
            const regex = /^PREFIX=.*$/m;
            
            envContent = regex.test(envContent) ? envContent.replace(regex, `PREFIX=${newPrefix}`) : envContent + `\nPREFIX=${newPrefix}`;
            fs.writeFileSync(envPath, envContent);

            return message.reply(`🚀 **SYSTEM PREFIX MIGRATED:** Use \`${newPrefix}\` from now on.`);
        } catch (error) {
            return message.reply("❌ **FS ERROR:** Could not update .env.");
        }
    }
};
