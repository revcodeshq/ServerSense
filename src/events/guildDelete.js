// GuildDelete event - fires when bot is removed from a server
// Author: revcodes

const logger = require('../utils/logger');

module.exports = {
    name: 'guildDelete',
    once: false,
    execute(guild, client) {
        logger.info(`Left server: ${guild.name} (${guild.id})`);
        logger.info(`Now serving ${client.guilds.cache.size} servers.`);
    },
};
