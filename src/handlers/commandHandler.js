// Advanced Command Handler for ServerSense
// Author: revcodes
// Supports: categories, cooldowns, permissions, dev-only commands

const fs = require('fs');
const path = require('path');
const { Collection } = require('discord.js');
const logger = require('../utils/logger');
const config = require('../config/config');

/**
 * Load all commands from the commands directory (with category subfolders)
 * @param {Client} client - Discord.js client
 */
function loadCommands(client) {
    client.commands = new Collection();
    client.cooldowns = new Collection();

    const commandsPath = path.join(__dirname, '..', 'commands');
    const commandFolders = fs.readdirSync(commandsPath);

    for (const folder of commandFolders) {
        const folderPath = path.join(commandsPath, folder);
        const stat = fs.statSync(folderPath);

        if (stat.isDirectory()) {
            // Category folder
            const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
            for (const file of commandFiles) {
                const filePath = path.join(folderPath, file);
                const command = require(filePath);

                if ('data' in command && 'execute' in command) {
                    command.category = folder;
                    client.commands.set(command.data.name, command);
                    logger.debug(`Loaded command: ${command.data.name} (${folder})`);
                } else {
                    logger.warn(`Command at ${filePath} is missing required "data" or "execute" property.`);
                }
            }
        } else if (folder.endsWith('.js')) {
            // Root-level command file
            const command = require(folderPath);
            if ('data' in command && 'execute' in command) {
                command.category = 'general';
                client.commands.set(command.data.name, command);
                logger.debug(`Loaded command: ${command.data.name} (general)`);
            }
        }
    }

    logger.success(`Loaded ${client.commands.size} commands.`);
}

/**
 * Handle command execution with cooldowns, permissions, etc.
 * @param {Interaction} interaction - Discord.js interaction
 * @param {Client} client - Discord.js client
 */
async function handleCommand(interaction, client) {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    // Log command usage
    logger.command(
        interaction.commandName,
        interaction.user.tag,
        interaction.guild?.name
    );

    // Check if command is dev-only
    if (command.devOnly && !config.developers.includes(interaction.user.id)) {
        return interaction.reply({
            content: `${config.emojis.error} This command is only available to developers.`,
            ephemeral: true,
        });
    }

    // Check if command is guild-only
    if (command.guildOnly && !interaction.guild) {
        return interaction.reply({
            content: `${config.emojis.error} This command can only be used in a server.`,
            ephemeral: true,
        });
    }

    // Check user permissions
    if (command.userPermissions && interaction.guild) {
        const member = interaction.member;
        const missingPerms = command.userPermissions.filter(perm => !member.permissions.has(perm));
        if (missingPerms.length > 0) {
            return interaction.reply({
                content: `${config.emojis.error} You need the following permissions: ${missingPerms.join(', ')}`,
                ephemeral: true,
            });
        }
    }

    // Check bot permissions
    if (command.botPermissions && interaction.guild) {
        const botMember = interaction.guild.members.me;
        const missingPerms = command.botPermissions.filter(perm => !botMember.permissions.has(perm));
        if (missingPerms.length > 0) {
            return interaction.reply({
                content: `${config.emojis.error} I need the following permissions: ${missingPerms.join(', ')}`,
                ephemeral: true,
            });
        }
    }

    // Handle cooldowns
    const { cooldowns } = client;
    if (!cooldowns.has(command.data.name)) {
        cooldowns.set(command.data.name, new Collection());
    }

    const now = Date.now();
    const timestamps = cooldowns.get(command.data.name);
    const cooldownAmount = (command.cooldown ?? config.defaultCooldown) * 1000;

    if (timestamps.has(interaction.user.id)) {
        const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
        if (now < expirationTime) {
            const timeLeft = (expirationTime - now) / 1000;
            return interaction.reply({
                content: `${config.emojis.warning} Please wait ${timeLeft.toFixed(1)}s before using \`/${command.data.name}\` again.`,
                ephemeral: true,
            });
        }
    }

    timestamps.set(interaction.user.id, now);
    setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

    // Execute command
    try {
        await command.execute(interaction, client);
    } catch (error) {
        logger.error(`Error executing command ${interaction.commandName}:`, error);

        const errorMessage = {
            content: `${config.emojis.error} There was an error executing this command.`,
            ephemeral: true,
        };

        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
}

module.exports = { loadCommands, handleCommand };
