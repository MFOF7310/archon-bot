module.exports = {
    name: 'refreshxp',
    description: '[ADMIN] Recalculate all users\' levels based on current XP.',
    aliases: ['recalc', 'refresh'],
    async run(client, message, args, database) {
        // Check admin permissions
        if (!message.member.permissions.has('Administrator')) {
            return message.reply('❌ You need **Administrator** permissions to use this.');
        }

        let updated = 0;
        for (const userId in database) {
            // Skip any non-user entries (like metadata if you ever add)
            if (isNaN(userId)) continue;

            const userData = database[userId];
            if (userData.xp !== undefined) {
                const oldLevel = userData.level || 1;
                const newLevel = Math.floor(userData.xp / 1000) + 1;
                if (oldLevel !== newLevel) {
                    userData.level = newLevel;
                    updated++;
                }
            }
        }

        // Save changes
        client.saveDatabase();

        message.reply(`✅ **Levels refreshed!** Updated **${updated}** agents.`);
    }
};