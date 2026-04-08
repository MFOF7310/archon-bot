// plugins/changelog.js
module.exports = {
    name: 'changelog',
    aliases: ['updates', 'changes', 'version'],
    description: '📋 View the latest bot updates',
    category: 'SYSTEM',
    
    run: async (client, message, args) => {
        const fs = require('fs');
        const path = require('path');
        
        // Read version
        const version = fs.readFileSync(path.join(__dirname, '../version.txt'), 'utf8').trim();
        
        // Read changelog (can be .md or .txt)
        const changelog = fs.readFileSync(path.join(__dirname, '../CHANGELOG.md'), 'utf8');
        
        // Extract latest version section
        const latestSection = changelog.split('## [v')[1]?.split('## [v')[0] || changelog;
        
        const embed = new EmbedBuilder()
            .setColor('#00fbff')
            .setAuthor({ name: `🏗️ ARCHITECT CG-223 v${version}`, iconURL: client.user.displayAvatarURL() })
            .setTitle('📋 CHANGELOG')
            .setDescription(`\`\`\`markdown\n${latestSection.substring(0, 4000)}\`\`\``)
            .setFooter({ text: 'Full changelog on GitHub: https://github.com/MFOF7310/Architect-CG-223' })
            .setTimestamp();
        
        message.reply({ embeds: [embed] });
    }
};