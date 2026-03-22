const dotenv = require('dotenv');
dotenv.config();

module.exports = {
    PORT: process.env.PORT || 3000,
    
    // Owner Details
    OWNER_NUMBER: "923076411098",
    OWNER_IMAGE: "https://files.catbox.moe/ny73ui.jpg",
    REPO_LINK: "https://github.com/rehmanabdul78600786-ctrl",
    CHANNEL_JID: "120363422481806597@newsletter",
    
    // Bot Settings
    BOT_NAME: "BOSS MD",
    BOT_PREFIX: ".",
    
    // Session Settings
    SESSION_DIR: "./sessions",
    SESSION_EXPIRY: 3600000, // 1 hour in ms
    
    // API Settings
    API_KEY: process.env.API_KEY || "BOSS-MD-V2-2026",
    
    // Auto Messages
    USER_MESSAGE: `╔═══════════════════════════╗
║  🎉 *WELCOME TO BOSS MD*  🎉  ║
╠═══════════════════════════╣
║  ✅ *Your session is ready!*
║  
║  📱 *Bot:* BOSS MD
║  ⚡ *Status:* Connected
║  
║  📝 *Commands:* 
║  • .menu - See all commands
║  • .ping - Check bot speed
║  • .owner - Contact owner
║  • .alive - Bot status
║  
║  🔧 *Pair Command:* 
║  • .sg - Save your session
║  
║  ✨ *Enjoy using BOSS MD!*
║  🌟 *Type .menu to start*
║  
╚═══════════════════════════╝`,
    
    OWNER_MESSAGE: `╔═══════════════════════════╗
║  👑 *BOSS MD SESSION*  👑  ║
╠═══════════════════════════╣
║  ✅ *Session Generated!*
║  
║  📱 *User:* {number}
║  🆔 *Session ID:* {sessionId}
║  
║  🔧 *Command:* {command}
║  📁 *Repo:* {repo}
║  
║  🚀 *Start:* {startCommand}
║  
║  🎯 *Status:* SUCCESS
║  ⏰ *Time:* {time}
║  
╚═══════════════════════════╝`
};
