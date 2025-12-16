const { Events, EmbedBuilder, PermissionFlagsBits, AuditLogEvent } = require('discord.js');
const { moderateMessage } = require('../utils/automod');
const { getGuildSettings, addModLog } = require('../utils/database');
const config = require('../config/config');
const logger = require('../utils/logger');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignore bots, DMs, and system messages
        if (message.author.bot) return;
        if (!message.guild) return;
        if (message.system) return;

        // Get guild settings
        const settings = getGuildSettings(message.guild.id);
        
        // Check if automod is enabled
        if (!settings.automod_enabled) return;

        // Skip if user has mod permissions (unless configured otherwise)
        if (!settings.automod_mods && message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return;
        }

        // Parse ignored channels
        let ignoredChannels = [];
        try {
            ignoredChannels = JSON.parse(settings.automod_ignored_channels || '[]');
        } catch (e) {
            ignoredChannels = [];
        }

        // Skip ignored channels
        if (ignoredChannels.includes(message.channel.id)) return;

        // Parse ignored roles
        let ignoredRoles = [];
        try {
            ignoredRoles = JSON.parse(settings.automod_ignored_roles || '[]');
        } catch (e) {
            ignoredRoles = [];
        }

        // Skip if user has an ignored role
        if (message.member.roles.cache.some(role => ignoredRoles.includes(role.id))) return;

        try {
            // Run moderation analysis
            const result = await moderateMessage(message.content, {
                username: message.author.username,
                channelName: message.channel.name,
                guildName: message.guild.name
            });

            // If message is safe, do nothing
            if (result.safe) return;

            // Get severity threshold from settings (default: 3)
            const threshold = settings.automod_threshold || 3;
            if (result.severity < threshold) return;

            // Determine action based on severity and guild settings
            let action = result.action;
            
            // Override action based on guild settings
            const maxAction = settings.automod_max_action || 'timeout';
            const actionHierarchy = ['none', 'warn', 'delete', 'timeout', 'kick', 'ban'];
            const maxActionIndex = actionHierarchy.indexOf(maxAction);
            const actionIndex = actionHierarchy.indexOf(action);
            
            if (actionIndex > maxActionIndex) {
                action = maxAction;
            }

            // Execute action
            let actionTaken = false;
            let actionDescription = '';

            // Always try to delete if action is delete or higher
            if (actionIndex >= actionHierarchy.indexOf('delete')) {
                try {
                    await message.delete();
                    actionTaken = true;
                    actionDescription = 'Message deleted';
                } catch (err) {
                    logger.warn(`Failed to delete message: ${err.message}`);
                }
            }

            // Apply timeout if needed
            if (action === 'timeout' && message.member.moderatable) {
                try {
                    // Timeout duration based on severity
                    const timeoutDurations = {
                        4: 60 * 1000,        // 1 minute
                        5: 5 * 60 * 1000,    // 5 minutes
                        6: 15 * 60 * 1000,   // 15 minutes
                        7: 60 * 60 * 1000,   // 1 hour
                        8: 6 * 60 * 60 * 1000, // 6 hours
                        9: 24 * 60 * 60 * 1000, // 1 day
                        10: 7 * 24 * 60 * 60 * 1000 // 1 week
                    };
                    const duration = timeoutDurations[Math.min(10, Math.max(4, result.severity))] || 5 * 60 * 1000;
                    
                    await message.member.timeout(duration, `AutoMod: ${result.reason}`);
                    actionTaken = true;
                    actionDescription += (actionDescription ? ' + ' : '') + `User timed out for ${formatDuration(duration)}`;
                } catch (err) {
                    logger.warn(`Failed to timeout user: ${err.message}`);
                }
            }

            // Create log embed
            const logEmbed = new EmbedBuilder()
                .setColor(getSeverityColor(result.severity))
                .setTitle('🛡️ AutoMod Action')
                .setDescription(`**Violations:** ${result.violations.join(', ')}\n**Reason:** ${result.reason}`)
                .addFields(
                    { name: 'User', value: `${message.author.tag} (${message.author.id})`, inline: true },
                    { name: 'Channel', value: `<#${message.channel.id}>`, inline: true },
                    { name: 'Severity', value: `${result.severity}/10`, inline: true },
                    { name: 'Action', value: actionDescription || 'Warning issued', inline: true },
                    { name: 'Detection', value: result.source === 'ai' ? '🤖 AI Analysis' : '⚡ Pattern Match', inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Message ID: ${message.id}` });

            // Add message content (truncated)
            const truncatedContent = message.content.length > 1000 
                ? message.content.substring(0, 1000) + '...' 
                : message.content;
            logEmbed.addFields({ name: 'Message Content', value: `\`\`\`${truncatedContent}\`\`\`` });

            // Log to mod log channel if configured
            if (settings.log_channel) {
                try {
                    const logChannel = await message.guild.channels.fetch(settings.log_channel);
                    if (logChannel) {
                        await logChannel.send({ embeds: [logEmbed] });
                    }
                } catch (err) {
                    logger.warn(`Failed to log to mod channel: ${err.message}`);
                }
            }

            // Add to database mod logs
            addModLog(
                message.guild.id,
                message.author.id,
                message.client.user.id, // Bot is the moderator
                'AUTOMOD',
                `${result.violations.join(', ')}: ${result.reason}`,
                actionDescription || 'Warning'
            );

            // DM the user (if enabled in settings)
            if (settings.automod_dm !== false) {
                try {
                    const dmEmbed = new EmbedBuilder()
                        .setColor(config.colors.warning)
                        .setTitle(`⚠️ AutoMod Warning - ${message.guild.name}`)
                        .setDescription(`Your message was flagged by our automated moderation system.`)
                        .addFields(
                            { name: 'Reason', value: result.reason },
                            { name: 'Action Taken', value: actionDescription || 'Warning issued' }
                        )
                        .setFooter({ text: 'Repeated violations may result in more severe actions.' })
                        .setTimestamp();

                    await message.author.send({ embeds: [dmEmbed] });
                } catch (err) {
                    // User has DMs disabled, ignore
                }
            }

            // Respond in channel (if message wasn't deleted and warnings are enabled)
            if (!actionTaken && settings.automod_warn_public !== false) {
                try {
                    const warnMessage = await message.reply({
                        embeds: [
                            new EmbedBuilder()
                                .setColor(config.colors.warning)
                                .setDescription(`⚠️ ${message.author}, please be mindful of the server rules.`)
                        ]
                    });

                    // Auto-delete warning after 10 seconds
                    setTimeout(() => {
                        warnMessage.delete().catch(() => {});
                    }, 10000);
                } catch (err) {
                    // Failed to reply, ignore
                }
            }

            logger.info(`AutoMod: ${message.author.tag} in ${message.guild.name} - ${result.violations.join(', ')} (Severity: ${result.severity})`);

        } catch (error) {
            logger.error(`AutoMod error: ${error.message}`);
        }
    }
};

function getSeverityColor(severity) {
    if (severity >= 8) return 0xFF0000; // Red
    if (severity >= 6) return 0xFF6600; // Orange
    if (severity >= 4) return 0xFFCC00; // Yellow
    return 0x00FF00; // Green
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
    return `${seconds} second${seconds > 1 ? 's' : ''}`;
}
