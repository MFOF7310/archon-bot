// plugins/duel.js  (duel v2: Components V2)
//
// The fight rules are the same as before: classes, damage, crits, dodge, energy, abilities, bets, ELO and the database tables.
// What is new: every message is a Components V2 container (no embeds), custom emojis come from config/emojis.js only,
// all texts come from lang/<language>/duel.json (keys starting with d2_), and the money handling is safer:
//   - the two bets are held in an "escrow" that can be settled once: refunded OR paid out, never both
//   - both players pick their class at the same time
//   - a player who does not act in time loses, and the result says so
const {
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, SeparatorBuilder, ThumbnailBuilder,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, SlashCommandBuilder,
} = require('discord.js');
const EMOJIS = require('../config/emojis');
const { t } = require('../lib/i18n');

const C = { green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m', reset: '\x1b[0m' };
const FOOTER = 'ARCHON CG-223 • Neural Arena • BAMAKO_223 🇲🇱';
const COLORS = { challenge: 0xe74c3c, classes: 0xf39c12, battle: 0x00d4ff, victory: 0xffd700, notice: 0x2c3e50 };

// ================= CLASSES =================
// `icon` is a name in config/emojis.js. Names of classes and abilities come from the language files.
const CLASSES = {
    GHOST:  { icon: 'duel_ghost',  hp: 85,  dmg: 28, crit: 35, dodge: 30, armor: 5,  special: 'smoke',    cooldown: 3 },
    TITAN:  { icon: 'shield',      hp: 150, dmg: 18, crit: 10, dodge: 5,  armor: 20, special: 'fortress', cooldown: 4 },
    SNIPER: { icon: 'duel_sniper', hp: 95,  dmg: 32, crit: 45, dodge: 10, armor: 8,  special: 'headshot', cooldown: 3 },
    HACKER: { icon: 'duel_hacker', hp: 105, dmg: 22, crit: 15, dodge: 15, armor: 12, special: 'crash',    cooldown: 3 },
};

// ================= RANKS =================
// `name` is what is saved in the database (unchanged). Shown names come from the language files (d2_rank_<index>).
const DUEL_RANKS = [
    { name: 'Street Rat',        min: 0,    max: 99 },
    { name: 'Neural Initiate',   min: 100,  max: 299 },
    { name: 'Cyber Mercenary',   min: 300,  max: 599 },
    { name: 'Ghost Operative',   min: 600,  max: 999 },
    { name: 'Arena Veteran',     min: 1000, max: 1499 },
    { name: 'Warlord',           min: 1500, max: 2199 },
    { name: 'Neural Gladiator',  min: 2200, max: 2999 },
    { name: 'Supreme Architect', min: 3000, max: Infinity },
];

// Players who are in a duel right now (so nobody can hold two bets at once)
const busy = new Set();

// Arena pacing (ms)
const TIMING = { CHALLENGE: 120000, CLASS: 120000, TURN: 90000, PAUSE: 1500 };

// ================= DB SETUP =================
function setupDuelDB(database) {
    try {
        database.prepare(`CREATE TABLE IF NOT EXISTS duel_scores (
      user_id TEXT NOT NULL, guild_id TEXT NOT NULL, username TEXT,
      duels_played INTEGER DEFAULT 0, duels_won INTEGER DEFAULT 0, duels_lost INTEGER DEFAULT 0,
      elo INTEGER DEFAULT 100, highest_streak INTEGER DEFAULT 0, current_streak INTEGER DEFAULT 0,
      total_damage INTEGER DEFAULT 0, total_kills INTEGER DEFAULT 0, favorite_class TEXT DEFAULT 'GHOST',
      PRIMARY KEY (user_id, guild_id)
    )`).run();
        database.prepare(`CREATE TABLE IF NOT EXISTS duel_global (
      user_id TEXT PRIMARY KEY, username TEXT, global_elo INTEGER DEFAULT 100,
      global_wins INTEGER DEFAULT 0, global_kills INTEGER DEFAULT 0, rank_title TEXT DEFAULT 'Street Rat'
    )`).run();
        console.log(`${C.green}[DUEL]${C.reset} Neural Arena DB initialized`);
    } catch (e) { console.error(`${C.red}[DUEL DB]${C.reset} ${e.message}`); }
}

// ================= HELPERS =================
const ico = (key) => EMOJIS[key] || '';
const line = (...parts) => parts.filter((x) => x !== '' && x != null && x !== false).join(' ');
const fmt = (n) => Number(n).toLocaleString('en-US');
const signed = (n) => (n > 0 ? '+' : '') + n;
const esc = (s) => String(s).replace(/([\\*_~`|>])/g, '\\$1');
const mkT = (lang) => (key, vars) => t('duel.' + key, lang, vars);

// "<:name:id>" or "<a:name:id>" -> the object Discord wants on a button; a plain emoji -> { name }
function toEmoji(value) {
    if (!value) return undefined;
    const m = /^<(a?):(\w+):(\d+)>$/.exec(value);
    return m ? { id: m[3], name: m[2], animated: m[1] === 'a' } : { name: value };
}

function hpBar(current, max, blocks = 10) {
    const filled = Math.max(0, Math.min(blocks, Math.round((current / max) * blocks)));
    return '▰'.repeat(filled) + '▱'.repeat(blocks - filled);
}

function getDuelRank(elo) {
    return DUEL_RANKS.find((r) => elo >= r.min && elo <= r.max) || DUEL_RANKS[DUEL_RANKS.length - 1];
}
const rankIndex = (rank) => DUEL_RANKS.indexOf(rank);

// Fortified (Titan's Fortress): incoming damage is multiplied by this. 0.6 = 40% less damage.
const FORTIFY_DAMAGE_MULT = 0.6;

function calcDamage(attacker, defender, isCrit = false, isSpecial = false) {
    const base = attacker.class.dmg;
    const armor = defender.class.armor;
    let dmg = Math.max(1, Math.floor(base * (1 - (armor / 100))));
    if (isCrit) dmg = Math.floor(dmg * 1.8);
    if (isSpecial) dmg = Math.floor(dmg * 1.5);
    if (defender.armorBuff) dmg = Math.max(1, Math.floor(dmg * FORTIFY_DAMAGE_MULT));
    return dmg;
}

function updateDuelScore(db, client, userId, guildId, username, won, damage, kills) {
    try {
        const current = db.prepare(`SELECT * FROM duel_scores WHERE user_id = ? AND guild_id = ?`).get(userId, guildId) || {};
        const oldElo = current.elo || 100;
        const newElo = won ? oldElo + 25 : Math.max(0, oldElo - 15);
        const streak = won ? (current.current_streak || 0) + 1 : 0;
        const bestStreak = Math.max(current.highest_streak || 0, streak);

        db.prepare(`INSERT INTO duel_scores (user_id, guild_id, username, duels_played, duels_won, duels_lost, elo, current_streak, highest_streak, total_damage, total_kills)
      VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, guild_id) DO UPDATE SET
        duels_played = duels_played + 1, duels_won = duels_won + ?, duels_lost = duels_lost + ?,
        elo = ?, current_streak = ?, highest_streak = ?, total_damage = total_damage + ?, total_kills = total_kills + ?, username = ?`)
            .run(userId, guildId, username, won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills,
                won ? 1 : 0, won ? 0 : 1, newElo, streak, bestStreak, damage, kills, username);

        const rank = getDuelRank(newElo);
        db.prepare(`INSERT INTO duel_global (user_id, username, global_elo, global_wins, global_kills, rank_title)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        global_elo = global_elo + ?, global_wins = global_wins + ?, global_kills = global_kills + ?, rank_title = ?, username = ?`)
            .run(userId, username, newElo, won ? 1 : 0, kills, rank.name,
                won ? 25 : -15, won ? 1 : 0, kills, rank.name, username);

        if (client.queueUserUpdate) {
            const u = client.getUserData ? client.getUserData(userId, guildId) : {};
            client.queueUserUpdate(userId, guildId, { ...u, credits: (u?.credits || 0) + (won ? 0 : 0) });
        }
    } catch (e) { console.error(`${C.red}[DUEL SCORE]${C.reset} ${e.message}`); }
}

// The two bets. They can be settled once: refunded OR paid to the winner, never both.
function makeEscrow(client, db, guildId, aId, bId, bet) {
    const held = new Set();
    let settled = false;
    const add = (id, n) => {
        if (client.addCredits) client.addCredits(id, guildId, n);
        else db.prepare(`UPDATE users SET credits = credits + ? WHERE id = ? AND guild_id = ?`).run(n, id, guildId);
    };
    const take = (id, n) => {
        if (client.removeCredits) client.removeCredits(id, guildId, n);
        else db.prepare(`UPDATE users SET credits = credits - ? WHERE id = ? AND guild_id = ?`).run(n, id, guildId);
    };
    return {
        hold() { for (const id of [aId, bId]) { take(id, bet); held.add(id); } },
        refund() {
            if (settled) return false;
            settled = true;
            for (const id of held) add(id, bet);
            held.clear();
            return true;
        },
        pay(winnerId) {
            if (settled) return false;
            settled = true;
            if (bet > 0) add(winnerId, bet * 2);
            held.clear();
            return true;
        },
        get settled() { return settled; },
    };
}

// ================= VIEWS (Components V2) =================
const td = (content) => new TextDisplayBuilder().setContent(String(content));
const divider = () => new SeparatorBuilder().setDivider(true);
const v2 = (container, extra = {}) => ({ components: [container], flags: MessageFlags.IsComponentsV2, ...extra });

function button(id, label, style, emojiKey) {
    const b = new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
    const e = toEmoji(ico(emojiKey));
    if (e) b.setEmoji(e);
    return b;
}

function noticeView(text, color = COLORS.notice) {
    return v2(new ContainerBuilder().setAccentColor(color).addTextDisplayComponents(td(text)));
}

function challengeView({ tr, avatar, challenger, foe, bet }) {
    const c = new ContainerBuilder().setAccentColor(COLORS.challenge);
    c.addTextDisplayComponents(td(`<@${foe.id}>`));
    const body = [
        `### ${line(ico('duelist'), tr('d2_chTitle'))}`,
        tr('d2_chBody', { who: esc(challenger.username), foe: esc(foe.username) }),
        line(ico('coins'), tr('d2_chBet', { betAmt: fmt(bet) }), '·', tr('d2_chMode')),
    ].join('\n');
    if (avatar) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(td(body)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatar)));
    else c.addTextDisplayComponents(td(body));
    c.addTextDisplayComponents(td(`-# ${tr('d2_chNote', { mins: Math.max(1, Math.round(TIMING.CHALLENGE / 60000)) })}`));
    c.addSeparatorComponents(divider());
    c.addActionRowComponents(new ActionRowBuilder().addComponents(
        button('duel_accept', tr('d2_accept'), ButtonStyle.Success, 'small_check'),
        button('duel_decline', tr('d2_decline'), ButtonStyle.Danger, 'small_cross'),
    ));
    c.addTextDisplayComponents(td(`-# ${FOOTER}`));
    return v2(c, { allowedMentions: { users: [foe.id], repliedUser: false } });
}

function classView({ tr, duel, picks }) {
    const c = new ContainerBuilder().setAccentColor(COLORS.classes);
    c.addTextDisplayComponents(td(`### ${tr('d2_clsTitle')}\n${tr('d2_clsSub')}`));
    c.addSeparatorComponents(divider());
    for (const [key, cls] of Object.entries(CLASSES)) {
        const stats = [`${tr('d2_stHp')} ${cls.hp}`, `${tr('d2_stDmg')} ${cls.dmg}`, `${tr('d2_stCrit')} ${cls.crit}%`];
        if (cls.dodge >= 20) stats.push(`${tr('d2_stDodge')} ${cls.dodge}%`);
        if (cls.armor >= 15) stats.push(`${tr('d2_stArmor')} ${cls.armor}%`);
        const text = `${line(ico(cls.icon), `**${tr('d2_cls_' + key)}**`)}\n-# ${stats.join(' · ')}\n-# ${tr('d2_stSpecial')}: ${tr('d2_sp_' + cls.special)}`;
        c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(td(text))
            .setButtonAccessory(button('duel_class_' + key, tr('d2_pick'), ButtonStyle.Primary)));
    }
    c.addSeparatorComponents(divider());
    const state = (p) => (picks.has(p.id)
        ? line(ico('small_check'), tr('d2_ready', { who: esc(p.user.username) }))
        : line(ico('duel_wait'), tr('d2_choosing', { who: esc(p.user.username) })));
    c.addTextDisplayComponents(td(`${state(duel.p1)}\n${state(duel.p2)}`));
    return v2(c);
}

function playerBlock(tr, p) {
    const status = [
        p.stunned ? tr('d2_stStunned') : '',
        p.dodgeNext ? tr('d2_stDodgeReady') : '',
        p.armorBuff ? tr('d2_stFortified') : '',
        p.bleed > 0 ? tr('d2_stBleed', { n: p.bleed }) : '',
    ].filter(Boolean).join(' · ') || tr('d2_stNormal');
    const energy = Math.max(0, Math.min(100, p.energy));
    return [
        line(ico(p.class.icon), `**${esc(p.user.username)}** · ${tr('d2_cls_' + p.class.key)}`),
        line(ico('duel_heart'), hpBar(p.hp, p.maxHp), `${Math.max(0, p.hp)}/${p.maxHp}`),
        `-# ${line(ico('duel_bolt'), tr('d2_energy', { pct: energy }))} · ${status}`,
    ].join('\n');
}

function battleView({ tr, duel, log, active }) {
    const { p1, p2, bet } = duel;
    const current = duel.turn === p1.id ? p1 : p2;
    const c = new ContainerBuilder().setAccentColor(COLORS.battle);
    c.addTextDisplayComponents(td(`### ${tr('d2_round', { rnd: duel.round, who: esc(current.user.username) })}`));
    c.addSeparatorComponents(divider());
    c.addTextDisplayComponents(td(playerBlock(tr, p1)), td(playerBlock(tr, p2)));
    c.addSeparatorComponents(divider());
    const quoted = log ? log.split('\n').map((l) => `> ${l}`).join('\n') + '\n' : '';
    c.addTextDisplayComponents(td(`${quoted}${line(ico('coins'), tr('d2_pot', { betAmt: fmt(bet) }))}`));
    if (active) {
        c.addSeparatorComponents(divider());
        c.addActionRowComponents(new ActionRowBuilder().addComponents(
            button('duel_attack', tr('d2_btnAttack'), ButtonStyle.Danger, 'duel_sword'),
            button('duel_defend', tr('d2_btnDefend'), ButtonStyle.Primary, 'shield'),
        ));
        const row2 = new ActionRowBuilder();
        if (current.heals > 0) row2.addComponents(button('duel_heal', tr('d2_btnHeal', { left: current.heals }), ButtonStyle.Success, 'duel_heal'));
        if (current.energy >= 75 && current.cooldown <= 0) row2.addComponents(button('duel_special', tr('d2_sp_' + current.class.special), ButtonStyle.Secondary, 'duel_bolt'));
        if (row2.components.length > 0) c.addActionRowComponents(row2);
    }
    return v2(c);
}

function victoryView({ tr, winner, loser, forfeit, elo, eloChange, loserElo, loserEloChange, streak, rank, bet }) {
    const c = new ContainerBuilder().setAccentColor(COLORS.victory);
    const who = esc(winner.user.username);
    const foe = esc(loser.user.username);
    const head = [
        `### ${line(ico('crown'), tr('d2_victory', { who }))}`,
        forfeit ? tr('d2_victoryAfk', { who, foe }) : tr('d2_victoryLine', { who, foe, klass: tr('d2_cls_' + winner.class.key) }),
    ].join('\n');
    const face = winner.user.displayAvatarURL ? winner.user.displayAvatarURL() : '';
    if (face) c.addSectionComponents(new SectionBuilder().addTextDisplayComponents(td(head)).setThumbnailAccessory(new ThumbnailBuilder().setURL(face)));
    else c.addTextDisplayComponents(td(head));
    c.addSeparatorComponents(divider());
    c.addTextDisplayComponents(td([
        `${tr('d2_eloWin', { eloNow: elo, eloChg: signed(eloChange) })} · ${line(ico('duel_flame'), tr('d2_streak', { n: streak }))}`,
        tr('d2_rankLine', { rankName: tr('d2_rank_' + rankIndex(rank)) }),
        `-# ${tr('d2_eloLose', { foe, eloNow: loserElo, eloChg: signed(loserEloChange) })} · ${line(ico('coins'), tr('d2_paidOut', { amt: fmt(bet * 2) }))}`,
    ].join('\n')));
    return v2(c);
}

// ================= INTERACTION HELPERS =================
// Wait for one click from one player. Resolves the interaction, or null on time-out.
function waitForClick(msg, userId, time) {
    return new Promise((resolve) => {
        const col = msg.createMessageComponentCollector({
            filter: (i) => i.user.id === userId && String(i.customId).startsWith('duel_'), max: 1, time,
        });
        let got = null;
        col.on('collect', (i) => { got = i; });
        col.on('end', () => resolve(got));
    });
}

// The challenge: only the challenged player can answer. Anyone else gets a private note.
function waitForAnswer(msg, foeId, tr, foeName) {
    return new Promise((resolve) => {
        const col = msg.createMessageComponentCollector({
            filter: (i) => i.customId === 'duel_accept' || i.customId === 'duel_decline', time: TIMING.CHALLENGE,
        });
        let answer = null;
        col.on('collect', async (i) => {
            if (i.user.id !== foeId) return i.reply({ content: tr('d2_onlyFoe', { foe: esc(foeName) }), flags: 64 }).catch(() => {});
            answer = i;
            col.stop('answered');
        });
        col.on('end', () => resolve(answer));
    });
}

// ================= CLASS SELECTION (both players at the same time) =================
async function classSelection(msg, firstClick, duel, tr) {
    const picks = new Map();
    await firstClick.update(classView({ tr, duel, picks }));

    await new Promise((resolve) => {
        const col = msg.createMessageComponentCollector({ filter: (i) => String(i.customId).startsWith('duel_class_'), time: TIMING.CLASS });
        col.on('collect', async (i) => {
            if (i.user.id !== duel.p1.id && i.user.id !== duel.p2.id) return i.reply({ content: tr('d2_notInDuel'), flags: 64 }).catch(() => {});
            if (picks.has(i.user.id)) return i.reply({ content: tr('d2_pickedAlready'), flags: 64 }).catch(() => {});
            const key = i.customId.replace('duel_class_', '');
            if (!CLASSES[key]) return i.deferUpdate().catch(() => {});
            picks.set(i.user.id, key);
            await i.update(classView({ tr, duel, picks })).catch(() => {});
            if (picks.size === 2) col.stop('done');
        });
        col.on('end', () => resolve());
    });

    const notes = [];
    for (const p of [duel.p1, duel.p2]) {
        if (!picks.has(p.id)) {
            picks.set(p.id, 'GHOST');
            notes.push(tr('d2_autoPick', { who: esc(p.user.username), klass: tr('d2_cls_GHOST') }));
        }
    }
    for (const p of [duel.p1, duel.p2]) {
        const key = picks.get(p.id);
        p.class = { ...CLASSES[key], key };
        p.maxHp = p.class.hp; p.hp = p.class.hp;
        p.energy = 50; p.heals = 2; p.cooldown = 0;
    }
    return notes;
}

// ================= BATTLE LOOP =================
async function runBattle(msg, client, db, duel, escrow, tr, notes) {
    const { p1, p2, bet } = duel;
    let round = 1;
    let turn = Math.random() > 0.5 ? p1.id : p2.id;
    let log = notes.join('\n');
    let forfeit = null;

    // Answer clicks from anyone who is not the player whose turn it is
    const ackCollector = msg.createMessageComponentCollector({
        filter: (i) => String(i.customId).startsWith('duel_'), time: 10 * 60 * 1000,
    });
    ackCollector.on('collect', async (i) => {
        if (i.user.id !== duel.turn) await i.reply({ content: tr('d2_notYourTurn'), flags: 64 }).catch(() => {});
    });

    const processTurnEnd = (player) => {
        if (player.bleed > 0) { player.hp -= player.bleed; player.bleed--; }
        player.energy = Math.min(100, player.energy + 15);
        if (player.cooldown > 0) player.cooldown--;
        if (player.armorBuff > 0) { player.armorBuff--; if (player.armorBuff === 0) player.armorBuff = false; }
        // player.dodgeNext is NOT cleared here: the smoke screen must last until an attack actually misses.
    };

    try {
        while (p1.hp > 0 && p2.hp > 0) {
            duel.turn = turn;
            duel.round = round;
            const current = turn === p1.id ? p1 : p2;
            const opponent = turn === p1.id ? p2 : p1;
            const me = esc(current.user.username);
            const foe = esc(opponent.user.username);

            if (current.stunned) {
                current.stunned = false;
                processTurnEnd(current);
                log = tr('d2_logStunned', { who: me });
                turn = opponent.id;
                round++;
                continue;
            }

            await msg.edit(battleView({ tr, duel, log, active: true })).catch(() => {});

            const click = await waitForClick(msg, current.id, TIMING.TURN);
            if (!click) { forfeit = current; current.hp = 0; break; }
            await click.deferUpdate().catch(() => {});
            const action = click.customId;

            const isCrit = Math.random() * 100 < current.class.crit;
            const isDodged = opponent.dodgeNext || (Math.random() * 100 < opponent.class.dodge);
            const abil = tr('d2_sp_' + current.class.special);

            if (action === 'duel_attack') {
                if (opponent.dodgeNext) opponent.dodgeNext = false; // spent on this attack
                if (isDodged) {
                    log = tr('d2_logDodge', { foe });
                } else {
                    const dmg = calcDamage(current, opponent, isCrit, false);
                    opponent.hp -= dmg;
                    log = tr(isCrit ? 'd2_logCrit' : 'd2_logHit', { who: me, foe, dmg });
                }
            } else if (action === 'duel_defend') {
                current.armorBuff = 2;
                const before = current.hp;
                current.hp = Math.min(current.maxHp, current.hp + 8);
                current.energy = Math.min(100, current.energy + 10);
                const gained = current.hp - before;
                log = gained > 0 ? tr('d2_logDefend', { who: me, hp: gained }) : tr('d2_logDefendFull', { who: me });
            } else if (action === 'duel_heal') {
                current.heals--;
                const before = current.hp;
                current.hp = Math.min(current.maxHp, current.hp + 25);
                log = tr('d2_logHeal', { who: me, hp: current.hp - before });
            } else if (action === 'duel_special') {
                current.energy -= 75;
                current.cooldown = current.class.cooldown;
                if (current.class.special === 'smoke') {
                    current.dodgeNext = true;
                    log = tr('d2_logSmoke', { who: me, abil });
                } else if (current.class.special === 'fortress') {
                    current.armorBuff = 2;
                    log = tr('d2_logFortress', { who: me, abil });
                } else if (current.class.special === 'headshot') {
                    const dmg = calcDamage(current, opponent, true, true);
                    opponent.hp -= dmg;
                    log = tr('d2_logHeadshot', { who: me, foe, dmg });
                } else if (current.class.special === 'crash') {
                    opponent.stunned = true;
                    opponent.bleed = 5;
                    log = tr('d2_logCrash', { who: me, foe, abil });
                }
            }

            if (opponent.hp <= 0) break;

            processTurnEnd(current);
            turn = opponent.id;
            round++;
            duel.turn = turn;
            duel.round = round;

            await msg.edit(battleView({ tr, duel, log, active: false })).catch(() => {});
            await new Promise((r) => setTimeout(r, TIMING.PAUSE));
        }

        const winner = p1.hp > 0 ? p1 : p2;
        const loser = p1.hp > 0 ? p2 : p1;
        const guildId = duel.guildId;

        // From here on the money is settled: nothing below can refund it again.
        escrow.pay(winner.id);

        const readScore = (id) => {
            try { return db.prepare(`SELECT elo, current_streak FROM duel_scores WHERE user_id = ? AND guild_id = ?`).get(id, guildId) || { elo: 100, current_streak: 0 }; }
            catch (e) { return { elo: 100, current_streak: 0 }; }
        };
        const wBefore = readScore(winner.id);
        const lBefore = readScore(loser.id);
        updateDuelScore(db, client, winner.id, guildId, winner.user.username, true, winner.class.dmg * 5, 1);
        updateDuelScore(db, client, loser.id, guildId, loser.user.username, false, 0, 0);
        const wAfter = readScore(winner.id);
        const lAfter = readScore(loser.id);

        await msg.edit(victoryView({
            tr, winner, loser, forfeit: !!forfeit, bet,
            elo: wAfter.elo, eloChange: wAfter.elo - wBefore.elo, streak: wAfter.current_streak,
            rank: getDuelRank(wAfter.elo), loserElo: lAfter.elo, loserEloChange: lAfter.elo - lBefore.elo,
        })).catch(() => {});
    } finally {
        ackCollector.stop();
    }
}

// ================= CHALLENGE FLOW =================
function creditCommand(client) {
    let cmd = '`/credit`';
    try { cmd = require('../lib/mentions')(client, 'credit', 'balance'); } catch (e) { console.error('[DUEL] mention failed:', e.message); }
    return cmd;
}

async function startDuel(ctx, client, db, opponent, bet) {
    const userId = ctx.user.id;
    const guildId = ctx.guild?.id || 'DM';
    const lang = client.detectLanguage('duel', guildId, ctx.interaction || ctx.message);
    const tr = mkT(lang);

    if (opponent.id === userId) return ctx.reply({ content: tr('d2_selfDuel'), flags: 64 });
    if (opponent.bot) return ctx.reply({ content: tr('d2_botDuel'), flags: 64 });
    if (busy.has(userId)) return ctx.reply({ content: tr('d2_busySelf'), flags: 64 });
    if (busy.has(opponent.id)) return ctx.reply({ content: tr('d2_busyFoe', { foe: esc(opponent.username) }), flags: 64 });

    const userData = client.getUserData ? client.getUserData(userId, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(userId, guildId);
    const oppData = client.getUserData ? client.getUserData(opponent.id, guildId) : db.prepare(`SELECT credits FROM users WHERE id = ? AND guild_id = ?`).get(opponent.id, guildId);
    if ((userData?.credits || 0) < bet) return ctx.reply({ content: tr('d2_noCreditsSelf', { amt: fmt(bet), cmd: creditCommand(client) }), flags: 64 });
    if ((oppData?.credits || 0) < bet) return ctx.reply({ content: tr('d2_noCreditsOpp', { amt: fmt(bet), cmd: creditCommand(client) }), flags: 64 });

    busy.add(userId);
    busy.add(opponent.id);
    const escrow = makeEscrow(client, db, guildId, userId, opponent.id, bet);
    let msg = null;
    try {
        escrow.hold();
        const avatar = client.user?.displayAvatarURL ? client.user.displayAvatarURL() : '';
        msg = await ctx.reply(challengeView({ tr, avatar, challenger: ctx.user, foe: opponent, bet }));
        if (!msg) throw new Error('the challenge message could not be sent');

        const answer = await waitForAnswer(msg, opponent.id, tr, opponent.username);
        if (!answer) {
            escrow.refund();
            await msg.edit(noticeView(tr('d2_expired', { foe: esc(opponent.username) }))).catch(() => {});
            return;
        }
        if (answer.customId === 'duel_decline') {
            escrow.refund();
            await answer.update(noticeView(tr('d2_declined', { foe: esc(opponent.username) }))).catch(() => {});
            return;
        }

        const duel = {
            p1: { id: userId, user: ctx.user, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
            p2: { id: opponent.id, user: opponent, hp: 0, maxHp: 0, energy: 0, heals: 2, cooldown: 0, stunned: false, dodgeNext: false, armorBuff: 0, bleed: 0 },
            bet, guildId, turn: null, round: 1, lang,
        };
        const notes = await classSelection(msg, answer, duel, tr);
        await runBattle(msg, client, db, duel, escrow, tr, notes);
    } catch (e) {
        console.error(`${C.red}[DUEL]${C.reset} ${e.stack || e.message}`);
        escrow.refund();   // does nothing if the winner was already paid
        if (msg) await msg.edit(noticeView(tr('d2_error'))).catch(() => {});
        else await ctx.reply({ content: tr('d2_error'), flags: 64 }).catch(() => {});
    } finally {
        busy.delete(userId);
        busy.delete(opponent.id);
    }
}

// ================= SLASH COMMAND =================
const slashCommand = new SlashCommandBuilder()
    .setName('duel').setDescription('⚔️ Neural Arena — Challenge another agent to combat')
    .addUserOption((o) => o.setName('opponent').setDescription('Agent to challenge').setRequired(true))
    .addIntegerOption((o) => o.setName('bet').setDescription('Bet amount').setRequired(false).setMinValue(10).setMaxValue(5000));

async function executeSlashCommand(interaction, client) {
    const db = client.db;
    if (!db) {
        const lang = client.detectLanguage('duel', interaction.guildId, interaction);
        return interaction.reply({ content: mkT(lang)('d2_dbDown'), flags: 64 });
    }
    setupDuelDB(db);

    const opponent = interaction.options.getUser('opponent');
    const bet = interaction.options.getInteger('bet') || 100;
    // fetchReply() returns a REAL Message (an InteractionResponse has no .channel)
    const reply = async (o) => {
        await interaction.reply({ ...o });
        return await interaction.fetchReply().catch(() => null);
    };
    await startDuel({ reply, user: interaction.user, guild: interaction.guild, interaction }, client, db, opponent, bet);
}

async function run(client, message, args, db, serverSettings, usedCommand) {
    const prefix = serverSettings?.prefix || '.';
    const lang = client.detectLanguage('duel', message.guild?.id, message);
    const tr = mkT(lang);
    const opponent = message.mentions.users.first();
    const bet = parseInt(args[1]) || 100;

    if (!opponent) return message.reply(tr('d2_usage', { pfx: prefix })).catch(() => {});
    if (bet < 10) return message.reply(tr('d2_minBet', { amt: 10 })).catch(() => {});
    if (bet > 5000) return message.reply(tr('d2_maxBet', { amt: fmt(5000) })).catch(() => {});

    await startDuel({ reply: async (o) => message.reply(o), user: message.author, guild: message.guild, message }, client, db, opponent, bet);
}

module.exports = {
    name: 'duel',
    aliases: ['fight', 'arena', 'pvp', 'combat'],
    description: '⚔️ Neural Arena — Class-based PvP combat with betting, ELO, and special abilities',
    category: 'GAMING',
    cooldown: 10000,
    usage: '/duel @user [bet]',
    data: slashCommand,
    execute: executeSlashCommand,
    run,
    setupDuelDB,
    _internal: { CLASSES, DUEL_RANKS, TIMING, busy, calcDamage, hpBar, getDuelRank, makeEscrow, toEmoji, esc, startDuel, updateDuelScore },
};
