// Deploy slash commands to Discord
// Author: revcodes
// Usage: node src/deploy-commands.js [--global]

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const logger = require('./utils/logger');

const token = process.env.BOT_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const isGlobal = process.argv.includes('--global');

if (!token) {
    logger.error('BOT_TOKEN not set in .env');
    process.exit(1);
}

if (!clientId) {
    logger.error('CLIENT_ID not set in .env');
    process.exit(1);
}

if (!isGlobal && !guildId) {
    logger.error('GUILD_ID not set in .env (required for dev deployment). Use --global for global deployment.');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(commandsPath);

for (const folder of commandFolders) {
    const folderPath = path.join(commandsPath, folder);
    const stat = fs.statSync(folderPath);

    if (stat.isDirectory()) {
        const commandFiles = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
        for (const file of commandFiles) {
            const filePath = path.join(folderPath, file);
            const command = require(filePath);
            if ('data' in command) {
                commands.push(command.data.toJSON());
            }
        }
    } else if (folder.endsWith('.js')) {
        const command = require(folderPath);
        if ('data' in command) {
            commands.push(command.data.toJSON());
        }
    }
}

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
    try {
        logger.info(`Deploying ${commands.length} commands${isGlobal ? ' globally' : ` to guild ${guildId}`}...`);

        if (isGlobal) {
            await rest.put(Routes.applicationCommands(clientId), { body: commands });
            logger.success('Successfully deployed commands globally!');
        } else {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
            logger.success(`Successfully deployed commands to guild ${guildId}!`);
        }
    } catch (error) {
        logger.error('Failed to deploy commands:', error);
    }
})();
