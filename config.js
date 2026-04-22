module.exports = {
    ADMIN_ROLE_ID: '1495688693154058300',

    // Bot prefix
    PREFIX: process.env.PREFIX || '+',

    // Colors (decimal values)
    COLORS: {
        PRIMARY: 0xFF1493,    // Deep Pink - default embed color
        SUCCESS: 0x2ECC71,    // Green - accept/success
        ERROR: 0xE74C3C,      // Red - error/close
        WARNING: 0xF39C12,    // Orange - warning
        INFO: 0x3498DB,       // Blue - info
        DARK: 0x2C2F33,       // Dark gray
    },

    // Panel templates
    PANEL_TEMPLATES: {
        conf1: {
            title: 'Korzen Support',
            description: [
                'Before opening a ticket, please check the **FAQ** to see if your question is already answered.',
                '',
                'A staff member will assist you as soon as possible. Please provide all necessary details related to your request to speed up the process.',
            ].join('\n'),
            categories: [
                {
                    id: 'general_support',
                    label: 'Support',
                    description: 'General support and questions',
                    emoji: '💬',
                    headerTitle: 'Support Request',
                    headerWarning: '**Please describe your issue in detail** so a staff member can assist you quickly.',
                },
                {
                    id: 'hwid_reset',
                    label: 'Reset HWID',
                    description: 'Request HWID reset',
                    emoji: '🔄',
                    headerTitle: 'Reset HWID Request',
                    headerWarning: '**Be sure this is the Discord account linked to your Korzen user**. If not and you submit the ticket, it will be closed automatically.',
                },
                {
                    id: 'discord_change',
                    label: 'Discord Change',
                    description: 'Update discord account',
                    emoji: '🔗',
                    headerTitle: 'Discord Change Request',
                    headerWarning: '**Make sure you have access to both your old and new Discord accounts** before proceeding.',
                },
                {
                    id: 'blacklist_appeal',
                    label: 'Blacklist Appeal',
                    description: 'Request blacklist review or appeal',
                    emoji: '⚖️',
                    headerTitle: 'Blacklist Appeal',
                    headerWarning: '**Provide honest and complete information**. False claims will result in permanent denial.',
                },
            ],
            sections: [
                { title: '**HWID Reset**', desc: '> Request a hardware ID reset if you\'ve changed your PC or hardware.' },
                { title: '**Discord Change**', desc: '> Update your linked Discord account for access recovery or verification.' },
                { title: '**Blacklist Appeal**', desc: '> Request a review of your blacklist status or appeal a blacklist decision.' },
            ],
        },
    },

    // Questions per category
    QUESTIONS: {
        general_support: [
            { key: 'user', question: 'User :', type: 'text' },
            { key: 'subject', question: 'Subject of your request :', type: 'text' },
            { key: 'description', question: 'Describe your issue in detail :', type: 'text' },
            { key: 'screenshot', question: 'Screenshot of the issue (send an image or type "skip") :', type: 'image_optional' },
        ],
        hwid_reset: [
            { key: 'product', question: 'Which software/product are you using? (e.g., KorzenGen) :', type: 'text' },
            { key: 'license_key', question: 'License Key (KORZEN-XXXX-XXXX) :', type: 'text' },
            { key: 'payment_proof', question: 'Payment proof (invoice of payment) :', type: 'image' },
            { key: 'reason', question: 'Reason for reset :', type: 'text' },
            { key: 'cpu_screenshot', question: 'Screen of ur CPU (processeur) From Task Manager :', type: 'image' },
            {
                key: 'install_date',
                question: 'Open PowerShell and enter the command below and send a screenshot :',
                type: 'image',
                copyCommand: '(Get-CimInstance -ClassName Win32_OperatingSystem).InstallDate',
            },
            { key: 'pc_changed', question: 'Did you change your PC? (yes/no)', type: 'text' },
        ],
        discord_change: [
            { key: 'user', question: 'User :', type: 'text' },
            { key: 'current_discord', question: 'Current Discord account (username#tag or ID) :', type: 'text' },
            { key: 'new_discord', question: 'New Discord account (username#tag or ID) :', type: 'text' },
            { key: 'reason', question: 'Reason for Discord change :', type: 'text' },
            { key: 'payment_proof', question: 'Payment proof (invoice of payment) :', type: 'image' },
        ],
        blacklist_appeal: [
            { key: 'user', question: 'User :', type: 'text' },
            { key: 'ban_reason', question: 'Why were you blacklisted? :', type: 'text' },
            { key: 'appeal', question: 'Why should your blacklist be removed? :', type: 'text' },
            { key: 'additional_info', question: 'Any additional information or proof (send image or type your answer) :', type: 'text_or_image' },
        ],
    },

    // API Configuration
    API: {
        BASE_URL: 'http://localhost/api/v1',
        SECRET: 'EVOGEN_f9396f7873f7163c71a4e0991d814052',
    },
};
