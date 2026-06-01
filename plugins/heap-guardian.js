// plugins/heap-guardian.js - Memory Leak Defense System
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

class HeapGuardian {
    constructor(client) {
        this.client = client;
        this.warningMB = parseInt(process.env.HEAP_WARN_MB) || 300;
        this.snapshotMB = parseInt(process.env.HEAP_SNAP_MB) || 500;
        this.criticalMB = parseInt(process.env.HEAP_CRITICAL_MB) || 700;
        this.snapshotDir = path.join(__dirname, '..', 'heap-snapshots');
        this.lastSnapshot = 0;
        this.snapshotCooldown = 15 * 60 * 1000;
        
        if (!fs.existsSync(this.snapshotDir)) {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
        }
    }

    start() {
        this.interval = setInterval(() => this.check(), 60000);
        this.gcInterval = setInterval(() => this.gc(), 1800000);
        
        const used = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
        console.log(`\x1b[35m[HEAP]\x1b[0m Guardian active (${used}MB) | WARN:${this.warningMB}MB SNAP:${this.snapshotMB}MB CRIT:${this.criticalMB}MB`);
    }

    check() {
        const used = process.memoryUsage().heapUsed / 1024 / 1024;
        
        if (used > this.criticalMB) {
            console.log(`\x1b[31m[HEAP CRITICAL]\x1b[0m ${used.toFixed(0)}MB - Emergency GC + Snapshot`);
            this.gc();
            this.snapshot('critical');
            this.alertOwner('CRITICAL', used);
        } else if (used > this.snapshotMB) {
            console.log(`\x1b[33m[HEAP HIGH]\x1b[0m ${used.toFixed(0)}MB - Taking snapshot`);
            this.snapshot('threshold');
        } else if (used > this.warningMB) {
            console.log(`\x1b[33m[HEAP WARN]\x1b[0m ${used.toFixed(0)}MB`);
        }
    }

    snapshot(reason = 'manual') {
        const now = Date.now();
        if (now - this.lastSnapshot < this.snapshotCooldown) return;
        this.lastSnapshot = now;
        
        try {
            const ts = new Date().toISOString().replace(/[:.]/g, '-');
            const file = path.join(this.snapshotDir, `heap-${reason}-${ts}.heapsnapshot`);
            v8.writeHeapSnapshot(file);
            console.log(`\x1b[35m[HEAP]\x1b[0m Snapshot saved: ${path.basename(file)}`);
            
            const files = fs.readdirSync(this.snapshotDir)
                .filter(f => f.endsWith('.heapsnapshot'))
                .sort()
                .slice(0, -5);
            files.forEach(f => fs.unlinkSync(path.join(this.snapshotDir, f)));
        } catch (e) {
            console.error(`\x1b[31m[HEAP]\x1b[0m Snapshot error: ${e.message}`);
        }
    }

    gc() {
        if (global.gc) {
            const before = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
            global.gc();
            const after = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
            if (before !== after) {
                console.log(`\x1b[35m[HEAP]\x1b[0m GC: ${before}MB → ${after}MB`);
            }
        }
    }

    async alertOwner(level, mem) {
        try {
            const owner = await this.client.users.fetch(process.env.OWNER_ID).catch(() => null);
            if (!owner) return;
            await owner.send(
                `🧠 **HEAP ${level}**\n` +
                `Memory: ${mem.toFixed(0)}MB\n` +
                `Uptime: ${Math.floor(process.uptime() / 60)} min\n` +
                `Node: BAMAKO_223 🇲🇱\n` +
                `Snapshot saved for analysis`
            ).catch(() => {});
        } catch (e) {}
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        if (this.gcInterval) clearInterval(this.gcInterval);
        console.log(`\x1b[35m[HEAP]\x1b[0m Guardian stopped`);
    }
}

module.exports = HeapGuardian;