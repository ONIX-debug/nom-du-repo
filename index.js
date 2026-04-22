require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { loadCommands, handleMessage } = require('./handlers/commandHandler');
const { handleInteraction } = require('./handlers/interactionHandler');
const { handleDMMessage, hasSession } = require('./handlers/dmCollector');

// Create client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
    ],
    partials: [
        Partials.Channel,
        Partials.Message,
        Partials.User,
    ],
});

// ───── Ready ─────
client.once('ready', () => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  🎫 Korzen Support Bot — Online`);
    console.log(`  📡 Logged in as ${client.user.tag}`);
    console.log(`  🏠 Guilds: ${client.guilds.cache.size}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    client.user.setActivity('Korzen Support', { type: 3 }); // Watching
});

// ───── Load commands ─────
loadCommands();

// ───── Message handler ─────
client.on('messageCreate', async (message) => {
    // Handle DM messages (for ticket questionnaire)
    if (!message.guild && !message.author.bot) {
        if (hasSession(message.author.id)) {
            await handleDMMessage(client, message);
            return;
        }
    }

    // Handle prefix commands in guilds
    if (message.guild) {
        await handleMessage(client, message);
    }
});

// ───── Interaction handler ─────
client.on('interactionCreate', async (interaction) => {
    await handleInteraction(client, interaction);
});

// ───── Error handling ─────
client.on('error', (error) => {
    console.error('[Client] Error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('[Process] Unhandled rejection:', error);
});

// ───── Login ─────
const token = process.env.TOKEN;
if (!token) {
    console.error('❌ No TOKEN found in .env file!');
    process.exit(1);
}

client.login(token);
