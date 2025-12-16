# ServerSense

**Advanced AI-powered Discord Assistant** by revcodes

## Features

- 🤖 **AI Chat** - Natural language conversation powered by OpenAI
- 📁 **Modular Commands** - Easy to add/remove commands via folder structure
- 🎯 **Event Handler** - Dynamic event loading system
- ⚡ **Cooldowns** - Per-command cooldown management
- 🔒 **Permissions** - User and bot permission checks
- 🌐 **Multi-Server** - Built for public bot deployment
- 📊 **Logging** - Colorful console logging with timestamps

## Project Structure

```
ServerSense/
├── src/
│   ├── commands/           # Slash commands (organized by category)
│   │   ├── general/        # General commands
│   │   │   ├── hello.js
│   │   │   ├── help.js
│   │   │   ├── ping.js
│   │   │   └── serverinfo.js
│   │   └── ai/             # AI commands
│   │       └── chat.js
│   ├── events/             # Discord events
│   │   ├── ready.js
│   │   ├── interactionCreate.js
│   │   ├── guildCreate.js
│   │   └── guildDelete.js
│   ├── handlers/           # Command and event handlers
│   │   ├── commandHandler.js
│   │   └── eventHandler.js
│   ├── utils/              # Utility modules
│   │   ├── logger.js
│   │   └── openai.js
│   ├── config/             # Bot configuration
│   │   └── config.js
│   ├── index.js            # Main entry point
│   └── deploy-commands.js  # Command deployment script
├── .env                    # Environment variables (DO NOT COMMIT)
├── .gitignore
├── package.json
└── README.md
```

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Edit `.env` with your credentials:

```env
BOT_TOKEN=your_bot_token_here
CLIENT_ID=your_application_id_here
GUILD_ID=your_dev_guild_id_here
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini
DEBUG=false
```

### 3. Deploy Commands

**Development (single server, instant update):**
```bash
npm run deploy
```

**Production (global, takes up to 1 hour):**
```bash
npm run deploy:global
```

### 4. Start the Bot

```bash
npm start
```

## Adding New Commands

1. Create a new file in `src/commands/<category>/`
2. Use this template:

```javascript
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('commandname')
        .setDescription('Command description'),
    cooldown: 5, // Optional: seconds
    guildOnly: false, // Optional: restrict to servers only
    devOnly: false, // Optional: restrict to developers
    userPermissions: [], // Optional: required user permissions
    botPermissions: [], // Optional: required bot permissions
    async execute(interaction, client) {
        await interaction.reply('Hello!');
    },
};
```

3. Run `npm run deploy` to register the new command

## Adding New Events

1. Create a new file in `src/events/`
2. Use this template:

```javascript
module.exports = {
    name: 'eventName', // Discord.js event name
    once: false, // true = fires once, false = fires every time
    execute(...args, client) {
        // Event logic here
    },
};
```

## Brand Identity

- **Colors:** Teal/Aqua (#00C7C7, #32E3E3), Deep Logic Blue (#0A1F2E)
- **Typography:** Poppins, Inter
- **Logo:** Minimal neural-brain design

## License

ISC © revcodes
