const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const commands = [];
const pluginsPath = path.join(__dirname, '../plugins');

// 🚧 On exclut uniquement les fichiers utilitaires ou doublons pour rester sous la limite des 100
const EXCLUDED_FILES = [
    'market-manager.js', 
    'update.js',
    'ttt.js',
    'servericon.js',
    'setgame.js',
    'oldest.js',
    'membercount.js',
    'asset-cache.js', 
    'auto-broadcast.js', 
    'heap-guardian.js',
    'randommeta.js',
    'rename.js',
    'status.js',
    'votesync.js'
];

const commandFiles = fs.readdirSync(pluginsPath).filter(file =>
    file.endsWith('.js') && !EXCLUDED_FILES.includes(file)
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
        }
    } catch (err) {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${file}: ${err.message}`);
    }
}

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID || process.env.DISCORD_CLIENT_ID;

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        console.log(`\x1b[36m[STARLINK]\x1b[0m Deploying ${commands.length} commands to Discord...`);
        await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        );
        console.log('\x1b[32m[STARLINK] ✅ All operational slash commands deployed successfully!\x1b[0m');
    } catch (error) {
        console.error('\x1b[31m[FATAL] Deployment failed:\x1b[0m', error.message);
    }
})();
