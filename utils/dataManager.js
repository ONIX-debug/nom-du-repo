const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json');
const TICKETS_PATH = path.join(__dirname, '..', 'data', 'tickets.json');

// Default data
const DEFAULT_CONFIG = {
    adminRoleIds: ['1495688693154058300'],
    logChannelId: '',
    
    // Button-specific permission roles
    claimRoleIds: [],
    closeRoleIds: [],
    acceptRoleIds: [],
    
    ticketCounter: 0,
    panels: {},
};

const DEFAULT_TICKETS = {};

function ensureDataDir() {
    const dir = path.join(__dirname, '..', 'data');
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function loadJSON(filePath, defaults) {
    ensureDataDir();
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return JSON.parse(raw);
        }
    } catch (e) {
        console.error(`[DataManager] Error loading ${filePath}:`, e.message);
    }
    saveJSON(filePath, defaults);
    return { ...defaults };
}

function saveJSON(filePath, data) {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Config
function getConfig() {
    return loadJSON(CONFIG_PATH, DEFAULT_CONFIG);
}

function saveConfig(config) {
    saveJSON(CONFIG_PATH, config);
}

function updateConfig(key, value) {
    const config = getConfig();
    config[key] = value;
    saveConfig(config);
    return config;
}

// Tickets
function getTickets() {
    return loadJSON(TICKETS_PATH, DEFAULT_TICKETS);
}

function saveTickets(tickets) {
    saveJSON(TICKETS_PATH, tickets);
}

function getNextTicketId() {
    const config = getConfig();
    config.ticketCounter = (config.ticketCounter || 0) + 1;
    saveConfig(config);
    return String(config.ticketCounter).padStart(5, '0');
}

function createTicket(ticketId, data) {
    const tickets = getTickets();
    tickets[ticketId] = {
        ...data,
        status: 'open',
        claimedBy: null,
        createdAt: new Date().toISOString(),
    };
    saveTickets(tickets);
    return tickets[ticketId];
}

function updateTicket(ticketId, updates) {
    const tickets = getTickets();
    if (tickets[ticketId]) {
        tickets[ticketId] = { ...tickets[ticketId], ...updates };
        saveTickets(tickets);
    }
    return tickets[ticketId];
}

function getTicketByChannel(channelId) {
    const tickets = getTickets();
    for (const [id, ticket] of Object.entries(tickets)) {
        if (ticket.channelId === channelId) {
            return { id, ...ticket };
        }
    }
    return null;
}

function deleteTicket(ticketId) {
    const tickets = getTickets();
    delete tickets[ticketId];
    saveTickets(tickets);
}

module.exports = {
    getConfig,
    saveConfig,
    updateConfig,
    getTickets,
    saveTickets,
    getNextTicketId,
    createTicket,
    updateTicket,
    getTicketByChannel,
    deleteTicket,
};
