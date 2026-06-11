const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const commands = [];
const pluginsPath = path.join(__dirname, '../plugins'); // adjust if needed

const commandFiles = fs.readdirSync(pluginsPath).filter(file =>
    file.endsWith('.js') &&
    !['lydia.js', 'market-manager.js'].includes(file)
);

for (const file of commandFiles) {
    const filePath = path.join(pluginsPath, file);
    try {
        delete require.cache[require.resolve(filePath)];
        const command = require(filePath);

        if (command.data && typeof command.data.toJSON === 'function') {
            commands.push(command.data.toJSON());
            console.log(`\x1b[32m[DEPLOY]\x1b[0m ✅ ${command.data.name || file}`);
        } else if (command.name && command.description) {
            const { SlashCommandBuilder } = require('discord.js');
            const slashCmd = new SlashCommandBuilder()
                .setName(command.name)
                .setDescription(command.description);
            commands.push(slashCmd.toJSON());
            console.log(`\x1b[33m[DEPLOY]\x1b[0m ⚠️ ${command.name} (legacy fallback)`);
        } else {
            console.log(`\x1b[33m[DEPLOY]\x1b[0m ⏭️ ${file} — no slash data`);
        }
    } catch (err) {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${file}: ${err.message}`);
    }
}

// Match your bot's env vars
const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;
const guildId = process.env.GUILD_ID; // for instant guild registration

if (!token || !clientId) {
    console.error('\x1b[31m[FATAL]\x1b[0m DISCORD_TOKEN and CLIENT_ID are required in .env');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function deployWithRetry(route, body, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`\x1b[36m[STARLINK]\x1b[0m Attempt ${i + 1}/${maxRetries}...`);
            await rest.put(route, { body });
            return true;
        } catch (error) {
            console.error(`\x1b[31m[RETRY ${i + 1}]\x1b[0m ${error.message}`);
            if (i === maxRetries - 1) throw error;
            await new Promise(r => setTimeout(r, 5000));
        }
    }
}

(async () => {
    try {
        if (guildId) {
            // 🚀 INSTANT (recommended for testing)
            await deployWithRetry(
                Routes.applicationGuildCommands(clientId, guildId),
                commands
            );
            console.log(`\x1b[32m[SUCCESS]\x1b[0m ${commands.length} guild commands deployed instantly to ${guildId}`);
        } else {
            // 🌐 GLOBAL (takes up to 1 hour to propagate)
            await deployWithRetry(
                Routes.applicationCommands(clientId),
                commands
            );
            console.log(`\x1b[32m[SUCCESS]\x1b[0m ${commands.length} global commands deployed — may take 1h to appear everywhere`);
        }
    } catch (error) {
        console.error(`\x1b[31m[FATAL]\x1b[0m Deployment failed: ${error.message}`);
        process.exit(1);
    }
})();
