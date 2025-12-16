// Simple logger utility for ServerSense
// Author: revcodes

const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
};

function getTimestamp() {
    return new Date().toISOString().replace('T', ' ').split('.')[0];
}

const logger = {
    info: (message, ...args) => {
        console.log(`${colors.cyan}[${getTimestamp()}] [INFO]${colors.reset} ${message}`, ...args);
    },
    success: (message, ...args) => {
        console.log(`${colors.green}[${getTimestamp()}] [SUCCESS]${colors.reset} ${message}`, ...args);
    },
    warn: (message, ...args) => {
        console.log(`${colors.yellow}[${getTimestamp()}] [WARN]${colors.reset} ${message}`, ...args);
    },
    error: (message, ...args) => {
        console.error(`${colors.red}[${getTimestamp()}] [ERROR]${colors.reset} ${message}`, ...args);
    },
    debug: (message, ...args) => {
        if (process.env.DEBUG === 'true') {
            console.log(`${colors.magenta}[${getTimestamp()}] [DEBUG]${colors.reset} ${message}`, ...args);
        }
    },
    command: (commandName, user, guild) => {
        console.log(`${colors.blue}[${getTimestamp()}] [CMD]${colors.reset} ${commandName} | User: ${user} | Guild: ${guild || 'DM'}`);
    },
    event: (eventName, ...args) => {
        console.log(`${colors.magenta}[${getTimestamp()}] [EVENT]${colors.reset} ${eventName}`, ...args);
    },
};

module.exports = logger;
