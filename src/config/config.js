// ServerSense Bot Configuration
// Author: revcodes

module.exports = {
    // Bot identity
    name: 'ServerSense',
    author: 'revcodes',
    version: '1.0.0',

    // Bot settings
    prefix: '!', // Legacy prefix (if needed)
    defaultCooldown: 3, // Default command cooldown in seconds

    // Colors (for embeds)
    colors: {
        primary: 0x00C7C7,    // Teal/Aqua
        secondary: 0x32E3E3,  // Light Aqua
        success: 0x00FF00,
        error: 0xFF0000,
        warning: 0xFFFF00,
        info: 0x0A1F2E,       // Deep Logic Blue
    },

    // Emojis (customize as needed)
    emojis: {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        loading: '⏳',
        info: 'ℹ️',
    },

    // Developer/Owner IDs (for owner-only commands)
    developers: [
        // Add your Discord user ID here
        // '123456789012345678',
    ],

    // Support server (optional)
    supportServer: '',
    inviteLink: '',
};
