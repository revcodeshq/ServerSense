// Simple Discord.js bot for ServerSense
// Author: revcodes

const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

const BOT_NAME = 'ServerSense';
const AUTHOR = 'revcodes';

// Development guild ID (set in .env as GUILD_ID)
const GUILD_ID = process.env.GUILD_ID || 'YOUR_GUILD_ID_HERE';

// Command loader for slash commands
client.commands = new Collection();
const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());
}

client.once('clientReady', async () => {
    console.log(`${BOT_NAME} is online! Developed by ${AUTHOR}.`);
    // Register slash commands for development guild
    const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE');
    try {
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, GUILD_ID),
            { body: commands }
        );
        console.log('Slash commands registered for development guild.');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;
    const command = client.commands.get(interaction.commandName);
    if (!command) return;
    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        await interaction.reply({ content: 'There was an error executing that command.', ephemeral: true });
    }
});

client.login(process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE'); // Use dotenv or replace with your bot token
