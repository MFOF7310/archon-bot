// ═══ ARCHON CG-223 — POSTCHECK: ACCESS VERIFICATION TERMINAL ═══
const { EmbedBuilder, SlashCommandBuilder, ChannelType } = require('discord.js');
const cp = require('../lib/canPost');

const S = {
    en: { granted: '✅ ACCESS GRANTED', denied: '⛔ ACCESS DENIED', node: 'NODE', cause: 'CAUSE',
          blockedBy: 'BLOCKED BY', missing: 'MISSING', causePrivate: 'Private channel — not on the access list',
          okLine: 'All required permissions verified', fix: 'RESOLUTION PROTOCOL',
          s1: 'Edit Channel → Permissions', s2: 'Add the **{bot}** role', s3: 'Allow **{perms}**', s4: 'Re-run your command',
          footer: 'ARCHON CG-223 • BAMAKO_223 🇲🇱 • UNCLASSIFIED' },
    fr: { granted: '✅ ACCÈS AUTORISÉ', denied: '⛔ ACCÈS REFUSÉ', node: 'NŒUD', cause: 'CAUSE',
          blockedBy: 'BLOQUÉ PAR', missing: 'MANQUANT', causePrivate: "Salon privé — absent de la liste d'accès",
          okLine: 'Toutes les permissions requises vérifiées', fix: 'PROTOCOLE DE RÉSOLUTION',
          s1: 'Modifier le salon → Permissions', s2: 'Ajoute le rôle **{bot}**', s3: 'Autorise **{perms}**', s4: 'Relance ta commande',
          footer: 'ARCHON CG-223 • BAMAKO_223 🇲🇱 • UNCLASSIFIED' },
    zh: { granted: '✅ 访问已授予', denied: '⛔ 访问被拒绝', node: '节点', cause: '原因',
          blockedBy: '阻止者', missing: '缺少权限', causePrivate: '私密频道——不在允许列表中',
          okLine: '所有必需权限已验证', fix: '解决方案',
          s1: '编辑频道 → 权限', s2: '添加 **{bot}** 身份组', s3: '允许 **{perms}**', s4: '重新运行你的命令',
          footer: 'ARCHON CG-223 • BAMAKO_223 🇲🇱 • UNCLASSIFIED' },
    ar: { granted: '✅ تم منح الوصول', denied: '⛔ تم رفض الوصول', node: 'القناة', cause: 'السبب',
          blockedBy: 'المانع', missing: 'الأذونات المفقودة', causePrivate: 'قناة خاصة — لا أظهر في قائمتها',
          okLine: 'جميع الأذونات المطلوبة متحقق منها', fix: 'بروتوكول الحل',
          s1: 'Edit Channel → Permissions', s2: 'أضف دور **{bot}**', s3: 'اسمح بـ **{perms}**', s4: 'أعد تشغيل أمرك',
          footer: 'ARCHON CG-223 • BAMAKO_223 🇲🇱 • UNCLASSIFIED' },
};

function buildReply(d, target, me, L) {
    const bot = me.roles.botRole?.name || me.displayName;
    const icon = me.client.user.displayAvatarURL();
    if (d.ok) {
        return { embeds: [new EmbedBuilder().setColor(0x2ecc71)
            .setAuthor({ name: L.granted, iconURL: icon })
            .setDescription(`\`\`\`\n▸ ${L.node}   ${target}\n▸ ${L.okLine}\n\`\`\``)
            .setFooter({ text: L.footer })] };
    }
    const cause = d.reason === 'private' ? L.causePrivate
        : d.reason === 'missing_perm' ? `${L.missing} — server level` : null;
    const lines = [`▸ ${L.node}   ${target}`];
    if (cause) lines.push(`▸ ${L.cause}   ${cause}`);
    if (d.role) lines.push(`▸ ${L.blockedBy}   ${d.role}`);
    lines.push(`▸ ${L.missing}   ${(d.missing || []).join(', ')}`);
    const steps = [L.s1, L.s2.replace('{bot}', bot), L.s3.replace('{perms}', (d.missing || []).join(', ')), L.s4]
        .map((s, i) => '`' + (i + 1) + '` ' + s).join('\n');
    return { embeds: [new EmbedBuilder().setColor(0xe74c3c)
        .setAuthor({ name: L.denied, iconURL: icon })
        .setDescription(`\`\`\`\n${lines.join('\n')}\n\`\`\`\n**${L.fix}**\n${steps}`)
        .setFooter({ text: L.footer })] };
}

module.exports = {
    name: 'postcheck',
    aliases: ['checkperms', 'canipost', 'accesscheck'],
    description: '🔍 Verify I can post in a channel — on-demand access diagnosis',
    category: 'UTILITY',
    cooldown: 3000,
    usage: '.postcheck [#channel]',
    examples: ['.postcheck', '.postcheck #welcome', '.checkperms #staff'],

    data: new SlashCommandBuilder()
        .setName('postcheck')
        .setDescription('🔍 Check whether I can post in a channel')
        .addChannelOption(o => o.setName('channel').setDescription('Channel to check (default: this one)').setRequired(false)
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)),

    run: async (client, message, args, db, serverSettings, usedCommand, lang) => {
        const L = S[lang] || S.en;
        const target = message.mentions.channels.first() || message.channel;
        const d = cp.diagnose(message.guild, target, message.guild.members.me);
        return message.reply(buildReply(d, target.toString(), message.guild.members.me, L)).catch(() => {});
    },

    execute: async (interaction, client) => {
        const lang = client.detectLanguage ? client.detectLanguage('postcheck', interaction.guild.id) : 'en';
        const L = S[lang] || S.en;
        const target = interaction.options.getChannel('channel') || interaction.channel;
        const d = cp.diagnose(interaction.guild, target, interaction.guild.members.me);
        return interaction.reply({ ...buildReply(d, target.toString(), interaction.guild.members.me, L), flags: 64 });
    }
};
