const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const backupDir = path.join(__dirname, 'backups');
const date = new Date().toISOString().replace(/:/g, '-').split('.')[0] + 'Z';

// Création dossier backup si inexistant
if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
}

// Backup de la base de données SQLite
const dbPath = path.join(__dirname, 'data.db');
if (fs.existsSync(dbPath)) {
    try {
        const db = new Database(dbPath);
        // Vérification intégrité DB avant backup
        db.pragma('integrity_check');
        
        const backupPath = path.join(backupDir, `BAMAKO_223_${date}.db`);
        fs.copyFileSync(dbPath, backupPath);
        
        // Nettoyage des vieux backups (garde 7 jours)
        const files = fs.readdirSync(backupDir);
        const oldBackups = files.filter(f => {
            const fileDate = new Date(f.split('_')[2]?.split('.')[0] || 0);
            return Date.now() - fileDate > 7 * 24 * 60 * 60 * 1000;
        });
        
        oldBackups.forEach(file => {
            fs.unlinkSync(path.join(backupDir, file));
            console.log(`\x1b[33m[CLEANUP]\x1b[0m Supprimé: ${file}`);
        });
        
        console.log(`\x1b[32m[BACKUP]\x1b[0m ✅ BAMAKO_223_${date}.db (${files.length - oldBackups.length} backups actifs)`);
        db.close();
    } catch (err) {
        console.error(`\x1b[31m[BACKUP ERROR]\x1b[0m ${err.message}`);
    }
}

// Backup du fichier .env (sans l'écraser)
const envBackup = path.join(backupDir, `.env.${date}.backup`);
if (fs.existsSync('.env')) {
    fs.copyFileSync('.env', envBackup);
    console.log(`\x1b[32m[BACKUP]\x1b[0m ✅ Configuration sauvegardée`);
}