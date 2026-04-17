const { exec } = require('child_process');
const axios = require('axios');

async function checkStarlinkConnection() {
    try {
        // Ping Discord API
        const start = Date.now();
        await axios.get('https://discord.com/api/v10/gateway', { timeout: 5000 });
        const latency = Date.now() - start;
        
        console.log(`\x1b[32m[STARLINK]\x1b[0m Connexion OK - Latence: ${latency}ms`);
        
        // Si latence > 1000ms, restart PM2
        if (latency > 1000) {
            console.log(`\x1b[33m[STARLINK]\x1b[0m Latence élevée, vérification du réseau...`);
        }
        
        return true;
    } catch (error) {
        console.error(`\x1b[31m[STARLINK]\x1b[0m Perte de connexion: ${error.message}`);
        return false;
    }
}

// Exécution
checkStarlinkConnection();