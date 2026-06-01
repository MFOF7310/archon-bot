module.exports = {
    name: 'debugpremium',
    ownerOnly: true,
    run: async (client, message, args, db) => {
        const userId = args[0] || message.author.id;
        const row = db.prepare('SELECT * FROM user_premium WHERE user_id = ?').get(userId);
        message.reply({ content: '```json\n' + JSON.stringify(row, null, 2) + '\n```', ephemeral: true });
    }
};