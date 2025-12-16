// Config command - manage guild settings
// Author: revcodes

const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const { getGuildSettings, updateGuildSettings } = require('../../utils/database');
const config = require('../../config/config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Manage ServerSense settings for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('View current server settings')
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('ai')
                .setDescription('Configure AI settings')
                .addStringOption(option =>
                    option.setName('setting')
                        .setDescription('AI setting to change')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Enabled', value: 'ai_enabled' },
                            { name: 'Model', value: 'ai_model' },
                            { name: 'Max Tokens', value: 'ai_max_tokens' },
                            { name: 'Temperature', value: 'ai_temperature' },
                            { name: 'System Prompt', value: 'ai_system_prompt' }
                        )
                )
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('New value for the setting')
                        .setRequired(true)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('welcome')
                .setDescription('Configure welcome messages')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable welcome messages')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send welcome messages')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Welcome message (use {user}, {server}, {memberCount})')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('leave')
                .setDescription('Configure leave messages')
                .addBooleanOption(option =>
                    option.setName('enabled')
                        .setDescription('Enable or disable leave messages')
                        .setRequired(true)
                )
                .addChannelOption(option =>
                    option.setName('channel')
                        .setDescription('Channel to send leave messages')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('Leave message (use {user}, {server}, {memberCount})')
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('logs')
                .setDescription('Configure logging channels')
                .addChannelOption(option =>
                    option.setName('mod_log')
                        .setDescription('Channel for moderation logs')
                        .addChannelTypes(ChannelType.GuildText)
                )
                .addChannelOption(option =>
                    option.setName('general_log')
                        .setDescription('Channel for general logs')
                        .addChannelTypes(ChannelType.GuildText)
                )
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('autorole')
                .setDescription('Set auto-role for new members')
                .addRoleOption(option =>
                    option.setName('role')
                        .setDescription('Role to assign to new members (leave empty to disable)')
                )
        ),
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown: 5,
    async execute(interaction, client) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        switch (subcommand) {
            case 'view':
                await handleView(interaction, guildId);
                break;
            case 'ai':
                await handleAI(interaction, guildId);
                break;
            case 'welcome':
                await handleWelcome(interaction, guildId);
                break;
            case 'leave':
                await handleLeave(interaction, guildId);
                break;
            case 'logs':
                await handleLogs(interaction, guildId);
                break;
            case 'autorole':
                await handleAutoRole(interaction, guildId);
                break;
        }
    },
};

async function handleView(interaction, guildId) {
    const settings = getGuildSettings(guildId);

    const embed = new EmbedBuilder()
        .setColor(config.colors.primary)
        .setTitle(`${config.emojis.info} Server Configuration`)
        .setDescription(`Settings for **${interaction.guild.name}**`)
        .addFields(
            {
                name: '🤖 AI Settings',
                value: [
                    `**Enabled:** ${settings.ai_enabled ? 'Yes' : 'No'}`,
                    `**Model:** ${settings.ai_model}`,
                    `**Max Tokens:** ${settings.ai_max_tokens}`,
                    `**Temperature:** ${settings.ai_temperature}`,
                    `**System Prompt:** ${settings.ai_system_prompt ? 'Custom' : 'Default'}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '👋 Welcome/Leave',
                value: [
                    `**Welcome:** ${settings.welcome_enabled ? 'Enabled' : 'Disabled'}`,
                    `**Welcome Channel:** ${settings.welcome_channel_id ? `<#${settings.welcome_channel_id}>` : 'Not set'}`,
                    `**Leave:** ${settings.leave_enabled ? 'Enabled' : 'Disabled'}`,
                    `**Leave Channel:** ${settings.leave_channel_id ? `<#${settings.leave_channel_id}>` : 'Not set'}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '📝 Logging',
                value: [
                    `**Mod Log:** ${settings.mod_log_channel_id ? `<#${settings.mod_log_channel_id}>` : 'Not set'}`,
                    `**General Log:** ${settings.log_channel_id ? `<#${settings.log_channel_id}>` : 'Not set'}`,
                ].join('\n'),
                inline: true,
            },
            {
                name: '🎭 Auto Role',
                value: settings.auto_role_id ? `<@&${settings.auto_role_id}>` : 'Disabled',
                inline: true,
            }
        )
        .setFooter({ text: `Use /config <setting> to change values` })
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleAI(interaction, guildId) {
    const setting = interaction.options.getString('setting');
    const value = interaction.options.getString('value');

    let parsedValue;
    let displayValue;

    switch (setting) {
        case 'ai_enabled':
            parsedValue = ['true', '1', 'yes', 'on'].includes(value.toLowerCase()) ? 1 : 0;
            displayValue = parsedValue ? 'Enabled' : 'Disabled';
            break;
        case 'ai_model':
            const validModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'];
            if (!validModels.includes(value)) {
                return interaction.reply({
                    content: `${config.emojis.error} Invalid model. Valid options: ${validModels.join(', ')}`,
                    ephemeral: true,
                });
            }
            parsedValue = value;
            displayValue = value;
            break;
        case 'ai_max_tokens':
            parsedValue = parseInt(value);
            if (isNaN(parsedValue) || parsedValue < 100 || parsedValue > 4096) {
                return interaction.reply({
                    content: `${config.emojis.error} Max tokens must be between 100 and 4096.`,
                    ephemeral: true,
                });
            }
            displayValue = parsedValue.toString();
            break;
        case 'ai_temperature':
            parsedValue = parseFloat(value);
            if (isNaN(parsedValue) || parsedValue < 0 || parsedValue > 2) {
                return interaction.reply({
                    content: `${config.emojis.error} Temperature must be between 0 and 2.`,
                    ephemeral: true,
                });
            }
            displayValue = parsedValue.toString();
            break;
        case 'ai_system_prompt':
            if (value.toLowerCase() === 'reset' || value.toLowerCase() === 'default') {
                parsedValue = null;
                displayValue = 'Default';
            } else {
                parsedValue = value;
                displayValue = value.length > 100 ? value.substring(0, 100) + '...' : value;
            }
            break;
    }

    updateGuildSettings(guildId, { [setting]: parsedValue });

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} AI Setting Updated`)
        .addFields(
            { name: 'Setting', value: setting.replace('ai_', '').replace('_', ' ').toUpperCase(), inline: true },
            { name: 'New Value', value: displayValue, inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleWelcome(interaction, guildId) {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    const updates = { welcome_enabled: enabled ? 1 : 0 };
    if (channel) updates.welcome_channel_id = channel.id;
    if (message) updates.welcome_message = message;

    updateGuildSettings(guildId, updates);

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Welcome Settings Updated`)
        .addFields(
            { name: 'Enabled', value: enabled ? 'Yes' : 'No', inline: true },
            { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unchanged', inline: true },
            { name: 'Message', value: message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : 'Unchanged', inline: false }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleLeave(interaction, guildId) {
    const enabled = interaction.options.getBoolean('enabled');
    const channel = interaction.options.getChannel('channel');
    const message = interaction.options.getString('message');

    const updates = { leave_enabled: enabled ? 1 : 0 };
    if (channel) updates.leave_channel_id = channel.id;
    if (message) updates.leave_message = message;

    updateGuildSettings(guildId, updates);

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Leave Settings Updated`)
        .addFields(
            { name: 'Enabled', value: enabled ? 'Yes' : 'No', inline: true },
            { name: 'Channel', value: channel ? `<#${channel.id}>` : 'Unchanged', inline: true },
            { name: 'Message', value: message ? (message.length > 100 ? message.substring(0, 100) + '...' : message) : 'Unchanged', inline: false }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleLogs(interaction, guildId) {
    const modLog = interaction.options.getChannel('mod_log');
    const generalLog = interaction.options.getChannel('general_log');

    const updates = {};
    if (modLog) updates.mod_log_channel_id = modLog.id;
    if (generalLog) updates.log_channel_id = generalLog.id;

    if (Object.keys(updates).length === 0) {
        return interaction.reply({
            content: `${config.emojis.error} Please specify at least one channel to set.`,
            ephemeral: true,
        });
    }

    updateGuildSettings(guildId, updates);

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Logging Settings Updated`)
        .addFields(
            { name: 'Mod Log', value: modLog ? `<#${modLog.id}>` : 'Unchanged', inline: true },
            { name: 'General Log', value: generalLog ? `<#${generalLog.id}>` : 'Unchanged', inline: true }
        )
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}

async function handleAutoRole(interaction, guildId) {
    const role = interaction.options.getRole('role');

    updateGuildSettings(guildId, { auto_role_id: role ? role.id : null });

    const embed = new EmbedBuilder()
        .setColor(config.colors.success)
        .setTitle(`${config.emojis.success} Auto Role Updated`)
        .setDescription(role ? `New members will receive <@&${role.id}>` : 'Auto role has been disabled.')
        .setTimestamp();

    await interaction.reply({ embeds: [embed] });
}
