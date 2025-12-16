// InteractionCreate event - handles slash commands, buttons, etc.
// Author: revcodes

const { handleCommand } = require('../handlers/commandHandler');
const logger = require('../utils/logger');
const config = require('../config/config');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        // Handle slash commands
        if (interaction.isChatInputCommand()) {
            await handleCommand(interaction, client);
            return;
        }

        // Handle autocomplete
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (!command || !command.autocomplete) return;

            try {
                await command.autocomplete(interaction, client);
            } catch (error) {
                logger.error(`Autocomplete error for ${interaction.commandName}:`, error);
            }
            return;
        }

        // Handle buttons
        if (interaction.isButton()) {
            logger.debug(`Button interaction: ${interaction.customId}`);
            // Add button handling logic here or in separate handlers
            return;
        }

        // Handle select menus
        if (interaction.isStringSelectMenu()) {
            logger.debug(`Select menu interaction: ${interaction.customId}`);
            // Add select menu handling logic here
            return;
        }

        // Handle modals
        if (interaction.isModalSubmit()) {
            logger.debug(`Modal submission: ${interaction.customId}`);
            // Add modal handling logic here
            return;
        }
    },
};
