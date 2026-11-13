// lib/role-rules.js — the role settings ARCHON knows about, and which roles may fill each one.
// Shared by /roles, /serversettings, the dashboard API and the ticket settings, so every path applies the same rules.
const { PermissionsBitField: P } = require('discord.js');
const { DANGEROUS } = require('./verify-guard');
const { t } = require('./i18n');

// profile:
//   grant  ARCHON gives this role to members by itself: no sensitive permissions, below ARCHON's role
//   mute   same as grant, and it must not be reused by any other setting (muting someone would give them a reward, or the reverse)
//   staff  ARCHON never gives it, it only opens ticket channels to it: only @everyone, bot roles and Administrator are refused
// Member, Mute and Gamer were removed: nothing in the bot used them (mutes are Discord timeouts). Saved values stay in the table.
const SLOTS = [
    { key: 'autorole',      col: 'join_role_id',        setting: 'joinRoleId',          group: 'core',    profile: 'grant', env: 'AUTO_ROLE_ID' },
    { key: 'staff',         col: 'ticket_staff_role',   setting: 'ticketStaffRole',     group: 'core',    profile: 'staff', env: 'TICKET_STAFF_ROLE_ID' },
    { key: 'investor',      col: 'investor_role',       setting: 'investorRoleId',      group: 'economy', profile: 'grant', env: 'INVESTOR_ROLE_ID' },
    { key: 'quizmaster',    col: 'quiz_master_role',    setting: 'quizMasterRoleId',    group: 'economy', profile: 'grant', env: 'QUIZ_MASTER_ROLE_ID' },
    { key: 'duelist',       col: 'duelist_role',        setting: 'duelistRoleId',       group: 'economy', profile: 'grant', env: 'DUELIST_ROLE_ID' },
    { key: 'dailyinitiate', col: 'daily_initiate_role', setting: 'dailyInitiateRoleId', group: 'daily',   profile: 'grant', env: 'DAILY_INITIATE_ROLE_ID' },
    { key: 'dailywarrior',  col: 'daily_warrior_role',  setting: 'dailyWarriorRoleId',  group: 'daily',   profile: 'grant', env: 'DAILY_WARRIOR_ROLE_ID' },
    { key: 'dailychampion', col: 'daily_champion_role', setting: 'dailyChampionRoleId', group: 'daily',   profile: 'grant', env: 'DAILY_CHAMPION_ROLE_ID' },
    { key: 'dailylegend',   col: 'daily_legend_role',   setting: 'dailyLegendRoleId',   group: 'daily',   profile: 'grant', env: 'DAILY_LEGEND_ROLE_ID' },
    // given at levels 5 to 25 (/leveling): they were only reachable through /leveling setrole
    { key: 'level5',  col: 'level_5_role',  group: 'levels', profile: 'grant' },
    { key: 'level10', col: 'level_10_role', group: 'levels', profile: 'grant' },
    { key: 'level15', col: 'level_15_role', group: 'levels', profile: 'grant' },
    { key: 'level20', col: 'level_20_role', group: 'levels', profile: 'grant' },
    { key: 'level25', col: 'level_25_role', group: 'levels', profile: 'grant' },
];
const BY_KEY = Object.fromEntries(SLOTS.map(s => [s.key, s]));
const GROUPS = ['core', 'economy', 'daily', 'levels'];
const SNOWFLAKE = /^\d{17,20}$/;

const human = (flag) => String(flag).replace(/([a-z])([A-Z])/g, '$1 $2');

// The sensitive permissions a role carries (Administrator alone says it all)
function sensitivePerms(role) {
    if (role.permissions.has(P.Flags.Administrator)) return ['Administrator'];
    return new P(DANGEROUS.filter(f => role.permissions.has(f))).toArray().map(human);
}

// Can `role` fill a setting with this profile? Returns null when it can, or { code, perms? } saying why not.
// `actor` is the member making the change (null for checks made by the bot itself).
function checkRole(guild, role, profile, actor) {
    if (!guild || !role) return { code: 'missing' };
    if (role.id === guild.id) return { code: 'everyone' };
    if (role.managed) return { code: 'managed' };
    if (profile === 'staff') {
        if (role.permissions.has(P.Flags.Administrator)) return { code: 'admin_staff' };
    } else {
        const bad = sensitivePerms(role);
        if (bad.length) return { code: 'dangerous', perms: bad };
        const me = guild.members.me;
        if (!me || role.position >= me.roles.highest.position) return { code: 'above_bot' };
    }
    if (actor && actor.id !== guild.ownerId && role.position >= actor.roles.highest.position) return { code: 'above_actor' };
    return null;
}

function reasonText(err, lang) {
    if (!err) return '';
    return t(`roles.reason_${err.code}`, lang || 'en', { perms: (err.perms || []).join(', ') });
}

// The saved value of every slot, straight from the database (the settings cache can lag behind)
function readSlots(db, guildId) {
    let row = {};
    try { row = db.prepare(`SELECT ${SLOTS.map(s => s.col).join(', ')}, auto_role_id, member_role FROM server_settings WHERE guild_id = ?`).get(String(guildId)) || {}; }
    catch (e) { console.error('[ROLES] read:', e.message); }
    const out = {};
    for (const s of SLOTS) out[s.key] = row[s.col] ? String(row[s.col]) : null;
    // the auto role saved by the old .settings command or by /setup is given too (lib/joinrole): show it here as well
    if (!out.autorole) out.autorole = row.auto_role_id ? String(row.auto_role_id) : row.member_role ? String(row.member_role) : null;
    return out;
}

// Check a set of changes against the rules and against each other. Returns { ok: true, next } or { ok: false, slot, err }.
// changes: { slotKey: roleId | null }
function validateChanges(guild, current, changes, actor) {
    const next = { ...current };
    for (const [key, value] of Object.entries(changes)) {
        const slot = BY_KEY[key];
        if (!slot) return { ok: false, slot: key, err: { code: 'unknown_slot' } };
        if (value === null) { next[key] = null; continue; }
        if (!SNOWFLAKE.test(String(value))) return { ok: false, slot: key, err: { code: 'missing' } };
        const err = checkRole(guild, guild.roles.cache.get(String(value)), slot.profile, actor);
        if (err) return { ok: false, slot: key, err };
        next[key] = String(value);
    }
    // The mute role must not be shared with any other setting
    if (next.mute) {
        const clash = BY_KEY.mute && SLOTS.find(s => s.key !== 'mute' && next[s.key] === next.mute);
        if (clash) return { ok: false, slot: Object.prototype.hasOwnProperty.call(changes, 'mute') ? 'mute' : clash.key, err: { code: 'mute_conflict' } };
    }
    return { ok: true, next };
}

// Write the changed slots in one transaction and drop the cached settings
function writeSlots(client, db, guildId, current, next) {
    const changed = SLOTS.filter(s => (current[s.key] || null) !== (next[s.key] || null));
    if (!changed.length) return [];
    db.prepare('INSERT OR IGNORE INTO server_settings (guild_id) VALUES (?)').run(String(guildId));
    const tx = db.transaction(() => {
        for (const s of changed) {
            db.prepare(`UPDATE server_settings SET ${s.col} = ? WHERE guild_id = ?`).run(next[s.key] || null, String(guildId));
            if (s.key === 'autorole') db.prepare('UPDATE server_settings SET auto_role_id = NULL, member_role = NULL WHERE guild_id = ?').run(String(guildId));
        }
    });
    tx();
    client.settings?.delete?.(String(guildId));
    client.invalidateGuildCache?.(String(guildId));
    return changed.map(s => ({ key: s.key, before: current[s.key] || null, after: next[s.key] || null }));
}

// A short record in the mod-log for each change (no pings)
async function logChanges(guild, db, changes, actorId, via, lang) {
    if (!changes.length) return;
    try {
        const ch = require('./modlog').resolveModLog(guild, db);
        if (!ch) return;
        const { EmbedBuilder } = require('discord.js');
        const show = (id) => (id ? `<@&${id}>` : t('roles.not_set', lang));
        const lines = changes.map(c => `**${t(`roles.labels.${c.key}`, lang)}** · ${show(c.before)} → ${show(c.after)}`);
        await ch.send({
            embeds: [new EmbedBuilder().setColor(0x5b6b7c).setTitle(t('roles.log_title', lang))
                .setDescription(`${lines.join('\n')}\n\n${t('roles.log_by', lang, { user: `<@${actorId}>`, via: t(via === 'dashboard' ? 'roles.via_dashboard' : 'roles.via_discord', lang) })}`)
                .setTimestamp()],
            allowedMentions: { parse: [] },
        });
    } catch (e) { console.error(`[ROLES] mod-log guild=${guild.id}:`, e.message); }
}

// Who may change role settings: Manage Server and Manage Roles (or Administrator, or the owner)
function canManage(member) {
    if (!member) return false;
    if (member.guild?.ownerId === member.id) return true;
    const p = member.permissions;
    return p.has(P.Flags.Administrator) || (p.has(P.Flags.ManageGuild) && p.has(P.Flags.ManageRoles));
}

module.exports = { SLOTS, BY_KEY, GROUPS, checkRole, reasonText, readSlots, validateChanges, writeSlots, logChanges, canManage, sensitivePerms };
