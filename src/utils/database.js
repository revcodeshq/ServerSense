// Database utility module for ServerSense
// Author: revcodes
// Uses better-sqlite3 for fast, synchronous SQLite operations

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const logger = require('./logger');

// Ensure data directory exists
const dataDir = path.join(__dirname, '..', '..', 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'serversense.db');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

/**
 * Initialize database tables
 */
function initDatabase() {
    logger.info('Initializing database...');

    // Guild settings table
    db.exec(`
        CREATE TABLE IF NOT EXISTS guild_settings (
            guild_id TEXT PRIMARY KEY,
            ai_enabled INTEGER DEFAULT 1,
            ai_model TEXT DEFAULT 'gpt-4o-mini',
            ai_system_prompt TEXT DEFAULT NULL,
            ai_max_tokens INTEGER DEFAULT 1024,
            ai_temperature REAL DEFAULT 0.7,
            welcome_enabled INTEGER DEFAULT 0,
            welcome_channel_id TEXT DEFAULT NULL,
            welcome_message TEXT DEFAULT NULL,
            leave_enabled INTEGER DEFAULT 0,
            leave_channel_id TEXT DEFAULT NULL,
            leave_message TEXT DEFAULT NULL,
            log_channel TEXT DEFAULT NULL,
            mod_log_channel_id TEXT DEFAULT NULL,
            auto_role_id TEXT DEFAULT NULL,
            automod_enabled INTEGER DEFAULT 0,
            automod_threshold INTEGER DEFAULT 3,
            automod_max_action TEXT DEFAULT 'timeout',
            automod_dm INTEGER DEFAULT 1,
            automod_mods INTEGER DEFAULT 0,
            automod_ignored_channels TEXT DEFAULT '[]',
            automod_ignored_roles TEXT DEFAULT '[]',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // User data table (for AI memory, warnings, etc.)
    db.exec(`
        CREATE TABLE IF NOT EXISTS user_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            warnings INTEGER DEFAULT 0,
            xp INTEGER DEFAULT 0,
            level INTEGER DEFAULT 1,
            last_message_at TEXT DEFAULT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(guild_id, user_id)
        )
    `);

    // AI conversation history (for context memory)
    db.exec(`
        CREATE TABLE IF NOT EXISTS ai_conversations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            channel_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Moderation logs
    db.exec(`
        CREATE TABLE IF NOT EXISTS mod_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            moderator_id TEXT NOT NULL,
            action TEXT NOT NULL,
            reason TEXT DEFAULT NULL,
            duration TEXT DEFAULT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Run migrations for existing databases (add new columns if they don't exist)
    const migrations = [
        { column: 'automod_enabled', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_enabled INTEGER DEFAULT 0' },
        { column: 'automod_threshold', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_threshold INTEGER DEFAULT 3' },
        { column: 'automod_max_action', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_max_action TEXT DEFAULT \'timeout\'' },
        { column: 'automod_dm', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_dm INTEGER DEFAULT 1' },
        { column: 'automod_mods', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_mods INTEGER DEFAULT 0' },
        { column: 'automod_ignored_channels', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_ignored_channels TEXT DEFAULT \'[]\'' },
        { column: 'automod_ignored_roles', sql: 'ALTER TABLE guild_settings ADD COLUMN automod_ignored_roles TEXT DEFAULT \'[]\'' },
        { column: 'log_channel', sql: 'ALTER TABLE guild_settings ADD COLUMN log_channel TEXT DEFAULT NULL' },
    ];

    const tableInfo = db.prepare('PRAGMA table_info(guild_settings)').all();
    const existingColumns = tableInfo.map(col => col.name);

    for (const migration of migrations) {
        if (!existingColumns.includes(migration.column)) {
            try {
                db.exec(migration.sql);
                logger.info(`Added column: ${migration.column}`);
            } catch (err) {
                // Column might already exist, ignore
            }
        }
    }

    // Create indexes for faster queries
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_ai_conversations_channel ON ai_conversations(guild_id, channel_id, user_id);
        CREATE INDEX IF NOT EXISTS idx_mod_logs_guild ON mod_logs(guild_id);
        CREATE INDEX IF NOT EXISTS idx_mod_logs_user ON mod_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_data_guild ON user_data(guild_id);
    `);

    logger.success('Database initialized successfully.');
}

// ==================== GUILD SETTINGS ====================

/**
 * Get guild settings (creates default if not exists)
 * @param {string} guildId - Discord guild ID
 * @returns {object} Guild settings
 */
function getGuildSettings(guildId) {
    let settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);

    if (!settings) {
        db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)').run(guildId);
        settings = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?').get(guildId);
    }

    return settings;
}

/**
 * Update guild settings
 * @param {string} guildId - Discord guild ID
 * @param {object} updates - Key-value pairs to update
 */
function updateGuildSettings(guildId, updates) {
    // Ensure guild exists
    getGuildSettings(guildId);

    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    // Convert booleans to integers for SQLite
    const values = keys.map(k => {
        const val = updates[k];
        if (typeof val === 'boolean') return val ? 1 : 0;
        return val;
    });

    db.prepare(`UPDATE guild_settings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ?`)
        .run(...values, guildId);
}

/**
 * Update a single guild setting
 * @param {string} guildId - Discord guild ID
 * @param {string} key - Setting key
 * @param {any} value - Setting value
 */
function updateGuildSetting(guildId, key, value) {
    updateGuildSettings(guildId, { [key]: value });
}

/**
 * Delete guild settings (when bot leaves)
 * @param {string} guildId - Discord guild ID
 */
function deleteGuildSettings(guildId) {
    db.prepare('DELETE FROM guild_settings WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM user_data WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM ai_conversations WHERE guild_id = ?').run(guildId);
    db.prepare('DELETE FROM mod_logs WHERE guild_id = ?').run(guildId);
}

// ==================== USER DATA ====================

/**
 * Get user data for a guild
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {object} User data
 */
function getUserData(guildId, userId) {
    let user = db.prepare('SELECT * FROM user_data WHERE guild_id = ? AND user_id = ?').get(guildId, userId);

    if (!user) {
        db.prepare('INSERT INTO user_data (guild_id, user_id) VALUES (?, ?)').run(guildId, userId);
        user = db.prepare('SELECT * FROM user_data WHERE guild_id = ? AND user_id = ?').get(guildId, userId);
    }

    return user;
}

/**
 * Update user data
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @param {object} updates - Key-value pairs to update
 */
function updateUserData(guildId, userId, updates) {
    getUserData(guildId, userId);

    const keys = Object.keys(updates);
    const setClause = keys.map(k => `${k} = ?`).join(', ');
    const values = keys.map(k => updates[k]);

    db.prepare(`UPDATE user_data SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE guild_id = ? AND user_id = ?`)
        .run(...values, guildId, userId);
}

// ==================== AI CONVERSATIONS ====================

/**
 * Add a message to AI conversation history
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {string} userId - Discord user ID
 * @param {string} role - 'user' or 'assistant'
 * @param {string} content - Message content
 */
function addConversationMessage(guildId, channelId, userId, role, content) {
    db.prepare(`
        INSERT INTO ai_conversations (guild_id, channel_id, user_id, role, content)
        VALUES (?, ?, ?, ?, ?)
    `).run(guildId, channelId, userId, role, content);

    // Keep only last 20 messages per user per channel to prevent bloat
    db.prepare(`
        DELETE FROM ai_conversations
        WHERE id NOT IN (
            SELECT id FROM ai_conversations
            WHERE guild_id = ? AND channel_id = ? AND user_id = ?
            ORDER BY created_at DESC
            LIMIT 20
        )
        AND guild_id = ? AND channel_id = ? AND user_id = ?
    `).run(guildId, channelId, userId, guildId, channelId, userId);
}

/**
 * Get recent conversation history for context
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {string} userId - Discord user ID
 * @param {number} limit - Max messages to retrieve
 * @returns {Array} Conversation messages
 */
function getConversationHistory(guildId, channelId, userId, limit = 10) {
    return db.prepare(`
        SELECT role, content FROM ai_conversations
        WHERE guild_id = ? AND channel_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(guildId, channelId, userId, limit).reverse();
}

/**
 * Clear conversation history for a user in a channel
 * @param {string} guildId - Discord guild ID
 * @param {string} channelId - Discord channel ID
 * @param {string} userId - Discord user ID
 */
function clearConversationHistory(guildId, channelId, userId) {
    db.prepare('DELETE FROM ai_conversations WHERE guild_id = ? AND channel_id = ? AND user_id = ?')
        .run(guildId, channelId, userId);
}

// ==================== MOD LOGS ====================

/**
 * Add a moderation log entry
 * @param {object} log - Log details
 */
function addModLog(log) {
    db.prepare(`
        INSERT INTO mod_logs (guild_id, user_id, moderator_id, action, reason, duration)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(log.guildId, log.userId, log.moderatorId, log.action, log.reason, log.duration);
}

/**
 * Get moderation logs for a user
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @param {number} limit - Max logs to retrieve
 * @returns {Array} Moderation logs
 */
function getModLogs(guildId, userId, limit = 10) {
    return db.prepare(`
        SELECT * FROM mod_logs
        WHERE guild_id = ? AND user_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(guildId, userId, limit);
}

/**
 * Get all moderation logs for a guild
 * @param {string} guildId - Discord guild ID
 * @param {number} limit - Max logs to retrieve
 * @returns {Array} Moderation logs
 */
function getGuildModLogs(guildId, limit = 50) {
    return db.prepare(`
        SELECT * FROM mod_logs
        WHERE guild_id = ?
        ORDER BY created_at DESC
        LIMIT ?
    `).all(guildId, limit);
}

// ==================== WARNINGS ====================

/**
 * Add a warning to a user
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @param {string} moderatorId - Moderator's user ID
 * @param {string} reason - Warning reason
 * @returns {number} Total warnings
 */
function addWarning(guildId, userId, moderatorId, reason) {
    const user = getUserData(guildId, userId);
    const newWarnings = user.warnings + 1;

    updateUserData(guildId, userId, { warnings: newWarnings });
    addModLog({
        guildId,
        userId,
        moderatorId,
        action: 'warn',
        reason,
        duration: null,
    });

    return newWarnings;
}

/**
 * Get user warnings count
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 * @returns {number} Warning count
 */
function getWarnings(guildId, userId) {
    const user = getUserData(guildId, userId);
    return user.warnings;
}

/**
 * Clear user warnings
 * @param {string} guildId - Discord guild ID
 * @param {string} userId - Discord user ID
 */
function clearWarnings(guildId, userId) {
    updateUserData(guildId, userId, { warnings: 0 });
}

module.exports = {
    db,
    initDatabase,
    // Guild settings
    getGuildSettings,
    updateGuildSettings,
    updateGuildSetting,
    deleteGuildSettings,
    // User data
    getUserData,
    updateUserData,
    // AI conversations
    addConversationMessage,
    getConversationHistory,
    clearConversationHistory,
    // Mod logs
    addModLog,
    getModLogs,
    getGuildModLogs,
    // Warnings
    addWarning,
    getWarnings,
    clearWarnings,
};
