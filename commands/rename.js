const { COLORS } = require('../config');
const { sendV2, container, textDisplay, sendError, sendSuccess } = require('../utils/api');
const { getTicketByChannel, updateTicket } = require('../utils/dataManager');

module.exports = {
    name: 'rename',
    description: 'Rename the current ticket channel',
    usage: '+rename <new-name>',

    async execute(client, message, args) {
        const ticket = getTicketByChannel(message.channel.id);

        if (!ticket) {
            return sendError(client, message.channel.id, 'This command can only be used inside a ticket channel.');
        }

        if (!args.length) {
            return sendError(client, message.channel.id, 'Please provide a new name. Usage: `+rename <new-name>`');
        }

        const newName = args.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');

        if (!newName) {
            return sendError(client, message.channel.id, 'Invalid channel name. Use only letters, numbers, and hyphens.');
        }

        try {
            await message.channel.setName(newName);
            await sendSuccess(client, message.channel.id, `Channel renamed to **#${newName}**`);
        } catch (e) {
            console.error('[Rename] Error:', e.message);
            await sendError(client, message.channel.id, 'Failed to rename the channel. Check bot permissions.');
        }
    },
};
