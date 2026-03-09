const fs = require('fs');
const path = require('path');

module.exports = {
    name: 'setprefix',
    aliases: ['prefix', 'config-prefix'],
    description: 'Updates the system prefix and rewrites the .env file.',
    run: async (client, message, args, database) => {
        // 1. SECURITY: STRICT OWNER CHECK
        // Replace process.env.OWNER_ID with your actual Discord ID if not in .env
        if (message.author.id !== process.env.OWNER_ID) {
            return message.reply("⛔ **ACCESS DENIED:** This protocol is reserved for the Master Architect.");
        }

        const newPrefix = args[0];
        if (!newPrefix) return message.reply("🛰️ **Usage:** `,setprefix [new_prefix]`");
        if (newPrefix.length > 3) return message.reply("⚠️ **Error:** Prefix must be 3 characters or less.");

        try {
            // 2. LIVE UPDATE: Change the prefix in the running process immediately
            // Note: Ensure your index.js uses 'client.prefix' or similar to check commands
            client.prefix = newPrefix; 

            // 3. PERSISTENCE: Rewrite the .env file
            const envPath = path.join(__dirname, '../.env');
            let envContent = fs.readFileSync(envPath, 'utf8');

            // Regular expression to find PREFIX=any_value and replace it
            const regex = /^PREFIX=.*$/m;
            
            if (regex.test(envContent)) {
                envContent = envContent.replace(regex, `PREFIX=${newPrefix}`);
            } else {
                // If PREFIX doesn't exist for some reason, append it
                envContent += `\nPREFIX=${newPrefix}`;
            }

            fs.writeFileSync(envPath, envContent);

            // 4. CONFIRMATION
            return message.reply({
                content: `🚀 **ARCHITECT CONFIGURATION UPDATED**\n> System prefix migrated to: \`${newPrefix}\`\n> *.env file synchronized successfully.*`
            });

        } catch (error) {
            console.error("Prefix Update Error:", error);
            return message.reply("❌ **SYSTEM FAILURE:** Failed to write to .env file. Check file permissions.");
        }
    }
};
