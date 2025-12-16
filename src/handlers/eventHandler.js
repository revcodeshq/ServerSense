// Advanced Event Handler for ServerSense
// Author: revcodes
// Supports: once/on events, dynamic loading

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Load all events from the events directory
 * @param {Client} client - Discord.js client
 */
function loadEvents(client) {
    const eventsPath = path.join(__dirname, '..', 'events');
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    let loadedCount = 0;

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (!event.name) {
            logger.warn(`Event at ${filePath} is missing a "name" property.`);
            continue;
        }

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args, client));
        } else {
            client.on(event.name, (...args) => event.execute(...args, client));
        }

        logger.debug(`Loaded event: ${event.name} (${event.once ? 'once' : 'on'})`);
        loadedCount++;
    }

    logger.success(`Loaded ${loadedCount} events.`);
}

module.exports = { loadEvents };
