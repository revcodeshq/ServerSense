// Ready event - fires when bot is online
// Author: revcodes

const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        logger.success(`${config.name} is online! Logged in as ${client.user.tag}`);
        logger.info(`Serving ${client.guilds.cache.size} servers | ${client.users.cache.size} users`);

        // Set bot status
        client.user.setPresence({
            activities: [{ name: '/help | ServerSense', type: 3 }], // Watching
            status: 'online',
        });
    },
};
