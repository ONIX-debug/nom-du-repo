const fs = require('fs');
const path = require('path');
const { PREFIX } = require('../config');
const { hasAdminRole, sendNoPermission } = require('../utils/permissions');

const commands = new Map();

/**
 * Load all commands from the commands directory
 */
function loadCommands() {
    const commandsDir = path.join(__dirname, '..', 'commands');
    const files = fs.readdirSync(commandsDir).filter(f => f.endsWith('.js'));

    for (const file of files) {
        const cmd = require(path.join(commandsDir, file));
        commands.set(cmd.name, cmd);
        console.log(`[Commands] Loaded: +${cmd.name}`);
    }

    console.log(`[Commands] Total loaded: ${commands.size}`);
}

/**
 * Handle incoming messages for prefix commands
 */
async function handleMessage(client, message) {
    // Ignore bots
    if (message.author.bot) return;

    const prefix = PREFIX;

    // Check if message starts with prefix
    if (!message.content.startsWith(prefix)) return false;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    const command = commands.get(commandName);
    if (!command) return false;

    // Check permissions (admin role required for all commands)
    if (message.guild && message.member) {
        if (!hasAdminRole(message.member)) {
            await sendNoPermission(client, message.channel.id);
            return true;
        }
    }

    try {
        await command.execute(client, message, args);
    } catch (e) {
        console.error(`[Commands] Error executing +${commandName}:`, e);
    }

    return true;
}

module.exports = { loadCommands, handleMessage };
