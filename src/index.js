// ServerSense - Advanced AI-powered Discord Bot
// Author: revcodes
// Main entry point

require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands } = require('./handlers/commandHandler');
const { loadEvents } = require('./handlers/eventHandler');
const { initDatabase } = require('./utils/database');
const logger = require('./utils/logger');
const config = require('./config/config');

// Initialize database
initDatabase();

// Validate required environment variables
if (!process.env.BOT_TOKEN) {
    logger.error('BOT_TOKEN is not set in .env file!');
    process.exit(1);
}

// Create Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    partials: [
        Partials.Channel, // For DM support
        Partials.Message,
        Partials.User,
    ],
});

// Load handlers
logger.info('Loading commands...');
loadCommands(client);

logger.info('Loading events...');
loadEvents(client);

// Error handling
process.on('unhandledRejection', (error) => {
    logger.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception:', error);
});

// Login to Discord
client.login(process.env.BOT_TOKEN).catch(error => {
    logger.error('Failed to login:', error);
    process.exit(1);
});
