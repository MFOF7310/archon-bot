// plugins/heap-guardian.js — watches ARCHON's memory and tells the owner when it climbs.
// Looks at both the JS heap and RSS (everything the process holds, canvas and sharp images included).
//   warn  (HEAP_WARN_MB, 300)      one log line when it crosses, not one a minute
//   high  (HEAP_SNAP_MB, 500)      log line; a heap snapshot only if HEAP_SNAPSHOTS=1
//   crit  (HEAP_CRITICAL_MB, 700)  log line + one DM to OWNER_ID, at most once an hour; a GC if node has --expose-gc
// RSS uses its own limit (HEAP_RSS_MB, default crit × 1.5): native memory grows apart from the heap.
// Snapshots are off by default: writing one freezes the bot for seconds and needs about as much free RAM as the heap
// itself, which at the critical level could be what crashes it. Restarting on a memory limit is PM2's job
// (max_memory_restart in ecosystem.config.cjs), which restarts cleanly through the SIGINT shutdown.
const v8 = require('v8');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const num = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };

class HeapGuardian {
    constructor(client) {
        this.client = client;
        this.warningMB = num(process.env.HEAP_WARN_MB, 300);
        this.snapshotMB = num(process.env.HEAP_SNAP_MB, 500);
        this.criticalMB = num(process.env.HEAP_CRITICAL_MB, 700);
        this.rssMB = num(process.env.HEAP_RSS_MB, Math.round(this.criticalMB * 1.5));
        this.snapshots = process.env.HEAP_SNAPSHOTS === '1';
        this.snapshotDir = path.join(__dirname, '..', 'heap-snapshots');
        this.level = 0;            // 0 ok · 1 warn · 2 high · 3 critical: lines are logged when the level changes
        this.lastSnapshot = 0;
        this.lastAlert = 0;
        this.peak = 0;
    }

    start() {
        if (this.interval) return;
        this.interval = setInterval(() => this.check(), 60 * 1000);
        this.interval.unref?.();
        const m = process.memoryUsage();
        console.log(`\x1b[35m[HEAP]\x1b[0m Guardian active · heap ${Math.round(m.heapUsed / MB)}MB · rss ${Math.round(m.rss / MB)}MB | WARN:${this.warningMB} HIGH:${this.snapshotMB} CRIT:${this.criticalMB} RSS:${this.rssMB}MB | GC ${global.gc ? 'available' : 'not exposed'} · snapshots ${this.snapshots ? 'on' : 'off'}`);
    }

    check() {
        let m;
        try { m = process.memoryUsage(); } catch { return; }
        const heap = m.heapUsed / MB;
        const rss = m.rss / MB;
        this.peak = Math.max(this.peak, heap);
        const level = heap > this.criticalMB || rss > this.rssMB ? 3 : heap > this.snapshotMB ? 2 : heap > this.warningMB ? 1 : 0;
        const changed = level !== this.level;
        this.level = level;
        const figures = `heap ${heap.toFixed(0)}MB · rss ${rss.toFixed(0)}MB`;

        if (level === 0) { if (changed) console.log(`\x1b[35m[HEAP]\x1b[0m back to normal (${figures})`); return; }
        if (level === 1) { if (changed) console.log(`\x1b[33m[HEAP WARN]\x1b[0m ${figures}`); return; }
        if (level === 2) {
            if (changed) console.log(`\x1b[33m[HEAP HIGH]\x1b[0m ${figures}`);
            this.snapshot('high', heap);
            return;
        }
        // critical: say it once per crossing, DM at most once an hour, try a GC if node allows it
        if (changed) console.log(`\x1b[31m[HEAP CRITICAL]\x1b[0m ${figures}`);
        this.gc();
        if (Date.now() - this.lastAlert > 60 * 60 * 1000) {
            this.lastAlert = Date.now();
            this.alertOwner(heap, rss);
        }
    }

    snapshot(reason, heap) {
        if (!this.snapshots) return;
        const now = Date.now();
        if (now - this.lastSnapshot < 60 * 60 * 1000) return;
        // a snapshot needs about as much free memory as the heap: skip it when the machine doesn't have it
        try { if (require('os').freemem() / MB < heap * 1.2) return console.log('\x1b[33m[HEAP]\x1b[0m snapshot skipped: not enough free RAM'); } catch { /* go on */ }
        this.lastSnapshot = now;
        try {
            fs.mkdirSync(this.snapshotDir, { recursive: true });
            const file = path.join(this.snapshotDir, `heap-${reason}-${new Date().toISOString().replace(/[:.]/g, '-')}.heapsnapshot`);
            v8.writeHeapSnapshot(file);
            console.log(`\x1b[35m[HEAP]\x1b[0m Snapshot saved: ${path.basename(file)}`);
            // keep the 2 newest: each one is about the size of the heap
            fs.readdirSync(this.snapshotDir).filter((f) => f.endsWith('.heapsnapshot')).sort().slice(0, -2)
                .forEach((f) => { try { fs.unlinkSync(path.join(this.snapshotDir, f)); } catch { /* next time */ } });
        } catch (e) {
            console.error(`\x1b[31m[HEAP]\x1b[0m Snapshot error: ${e.message}`);
        }
    }

    gc() {
        if (typeof global.gc !== 'function') return;
        const before = process.memoryUsage().heapUsed / MB;
        try { global.gc(); } catch { return; }
        const after = process.memoryUsage().heapUsed / MB;
        console.log(`\x1b[35m[HEAP]\x1b[0m GC: ${before.toFixed(0)}MB → ${after.toFixed(0)}MB`);
    }

    async alertOwner(heap, rss) {
        try {
            if (!process.env.OWNER_ID) return;
            const owner = await this.client.users.fetch(process.env.OWNER_ID).catch(() => null);
            if (!owner) return;
            const up = Math.floor(process.uptime() / 60);
            await owner.send(
                `🧠 **ARCHON is using a lot of memory**\n` +
                `Heap ${heap.toFixed(0)} MB · total ${rss.toFixed(0)} MB (limit ${this.criticalMB} / ${this.rssMB} MB)\n` +
                `Up for ${up >= 60 ? `${Math.floor(up / 60)} h ${up % 60} min` : `${up} min`} · highest heap since start ${this.peak.toFixed(0)} MB\n` +
                `-# Next alert in an hour at the earliest. A restart frees it: pm2 restart Architect-CG223`
            ).catch(() => {});
        } catch { /* never let an alert break the bot */ }
    }

    stop() {
        if (this.interval) clearInterval(this.interval);
        this.interval = null;
        console.log('\x1b[35m[HEAP]\x1b[0m Guardian stopped');
    }
}

module.exports = HeapGuardian;
