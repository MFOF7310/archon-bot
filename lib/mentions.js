module.exports = (client, name, sub = null) => {
    if (!client || !client.application || !client.application.commands) return `\`/${name}\``;
    const cmd = client.application.commands.cache.find(c => c.name === name);
    if (!cmd) return `\`/${name}\``;
    return sub ? `</${name} ${sub}:${cmd.id}>` : `</${name}:${cmd.id}>`;
};
