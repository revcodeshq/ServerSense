// GuildCreate event - fires when bot joins a new server
// Author: revcodes

const logger = require('../utils/logger');

module.exports = {
    name: 'guildCreate',
    once: false,
    execute(guild, client) {
        logger.info(`Joined new server: ${guild.name} (${guild.id}) | Members: ${guild.memberCount}`);
        logger.info(`Now serving ${client.guilds.cache.size} servers.`);

        // Optional: Send welcome message to system channel or owner
        // const channel = guild.systemChannel;
        // if (channel) {
        //     channel.send('Thanks for adding ServerSense! Use `/help` to get started.');
        // }
    },
};
