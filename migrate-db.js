// migrate-db.js - Encrypt existing database
const Database = require('better-sqlite3-multiple-ciphers');
const path = require('path');
const fs = require('fs');

console.log('🦅 ARCHITECT CG-223 - DATABASE MIGRATION\n');

const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const backupPath = path.join(__dirname, 'data', `database.sqlite.backup-${Date.now()}`);

// Load .env
require('dotenv').config();
const key = process.env.DB_ENCRYPTION_KEY;

if (!key) {
    console.error('❌ DB_ENCRYPTION_KEY not found in .env!');
    process.exit(1);
}

// Backup
if (fs.existsSync(dbPath)) {
    fs.copyFileSync(dbPath, backupPath);
    console.log(`✅ Backup: ${backupPath}`);
}

try {
    // Open without encryption
    const db = new Database(dbPath, { timeout: 10000 });
    
    // Show stats
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    console.log('\n📊 Current data:');
    tables.forEach(t => {
        const count = db.prepare(`SELECT COUNT(*) as c FROM ${t.name}`).get();
        console.log(`   ${t.name}: ${count.c} records`);
    });
    
    // Apply pragmas
    db.exec('PRAGMA journal_mode = WAL;');
    
    // Encrypt
    console.log('\n🔐 Encrypting...');
    db.exec(`PRAGMA rekey = '${key}'`);
    
    // Verify
    const test = db.prepare('SELECT COUNT(*) as c FROM users').get();
    console.log(`✅ Encrypted! ${test.c} users preserved`);
    db.close();
    
    // Test encrypted access
    console.log('\n🔍 Verifying encrypted access...');
    const encDb = new Database(dbPath, { key, timeout: 10000 });
    const v = encDb.prepare('SELECT COUNT(*) as c FROM users').get();
    console.log(`✅ Access OK! ${v.c} users readable`);
    encDb.close();
    
    console.log('\n🎉 MIGRATION COMPLETE - Safe to upload!');
    
} catch (err) {
    console.error(`\n❌ Failed: ${err.message}`);
    if (fs.existsSync(backupPath)) {
        fs.copyFileSync(backupPath, dbPath);
        console.log('✅ Restored from backup');
    }
    process.exit(1);
}