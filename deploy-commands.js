const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');

const commands = [];
const pluginsPath = path.join(__dirname, 'plugins');

// Vérification Starlink-friendly avec retry
const commandFiles = fs.readdirSync(pluginsPath).filter(file => 
    file.endsWith('.js') && 
    !['lydia.js', 'market-manager.js'].includes(file) // Exclusion des modules économiques
);

for (const file of commandFiles) {
    const filePath = path.join(pluginsPath, file);
    try {
        const command = require(filePath);
        if (command.data) {
            commands.push(command.data.toJSON());
            console.log(`\x1b[32m[DEPLOY]\x1b[0m ✅ ${command.data.name}`);
        } else if (command.name && command.description) {
            // Fallback pour les anciens plugins
            const { SlashCommandBuilder } = require('discord.js');
            const slashCmd = new SlashCommandBuilder()
                .setName(command.name)
                .setDescription(command.description);
            commands.push(slashCmd.toJSON());
            console.log(`\x1b[33m[DEPLOY]\x1b[0m ⚠️ ${command.name} (legacy)`);
        }
    } catch (err) {
        console.error(`\x1b[31m[ERROR]\x1b[0m ${file}: ${err.message}`);
    }
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

// Fonction retry pour les connexions Starlink instables
async function deployWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            console.log(`\x1b[36m[STARLINK]\x1b[0m Tentative de déploiement ${i + 1}/${maxRetries}...`);
            
            await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            
            console.log(`\x1b[32m[SUCCESS]\x1b[0m ${commands.length} commandes déployées sur BAMAKO_223!`);
            return true;
        } catch (error) {
            console.error(`\x1b[31m[RETRY ${i + 1}]\x1b[0m ${error.message}`);
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Attente 5s
        }
    }
}

(async () => {
    try {
        await deployWithRetry();
    } catch (error) {
        console.error(`\x1b[31m[FATAL]\x1b[0m Échec du déploiement: ${error.message}`);
        process.exit(1);
    }
})();