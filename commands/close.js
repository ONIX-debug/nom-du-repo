const { COLORS } = require('../config');
const { sendV2, container, textDisplay, sendError } = require('../utils/api');
const { closeTicketChannel } = require('../handlers/interactionHandler');
const { getTicketByChannel } = require('../utils/dataManager');
const { hasAdminRole } = require('../utils/permissions');

module.exports = {
    name: 'close',
    description: 'Close the current ticket (staff only)',
    usage: '+close',

    async execute(client, message, args) {
        // Staff only
        if (!hasAdminRole(message.member)) {
            return sendError(client, message.channel.id, 'Only staff members can close tickets.');
        }

        const ticket = getTicketByChannel(message.channel.id);

        if (!ticket) {
            return sendV2(client, message.channel.id, [
                container(COLORS.ERROR, [
                    textDisplay('❌ **Error**\n> This command can only be used inside a ticket channel.'),
                ]),
            ]);
        }

        await closeTicketChannel(client, message.channel, message.author);
    },
};
