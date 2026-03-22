// Global variables
let currentMethod = 'code';
let currentSessionId = null;
let socket = null;

// Initialize socket connection
function initSocket() {
    socket = io();
    
    socket.on('qr_code', (data) => {
        if (data.sessionId === currentSessionId) {
            const qrContainer = document.getElementById('qrContainer');
            const qrCodeDiv = document.getElementById('qrCode');
            qrContainer.style.display = 'block';
            new QRCode(qrCodeDiv, {
                text: data.qr,
                width: 200,
                height: 200
            });
        }
    });
}

// Check server status
async function checkServerStatus() {
    try {
        const response = await fetch('/api/status');
        const data = await response.json();
        
        const statusDot = document.querySelector('.status-dot');
        const serverStatus = document.getElementById('serverStatus');
        const serverBadge = document.getElementById('serverBadge');
        const sessionsBadge = document.getElementById('sessionsBadge');
        
        if (data.success && data.status === 'online') {
            statusDot.className = 'status-dot online';
            serverStatus.textContent = 'Server Online';
            if (serverBadge) serverBadge.className = 'status-badge online';
            if (sessionsBadge) sessionsBadge.textContent = `${data.activeSessions || 0} Active`;
        } else {
            statusDot.className = 'status-dot offline';
            serverStatus.textContent = 'Server Offline';
            if (serverBadge) serverBadge.className = 'status-badge offline';
        }
        
        document.getElementById('activeSessions').textContent = data.activeSessions || 0;
    } catch (error) {
        console.error('Status check failed:', error);
        document.getElementById('serverStatus').textContent = 'Connection Failed';
    }
}

// Generate session
async function generateSession() {
    const phoneInput = document.getElementById('phoneNumber');
    let phone = phoneInput.value.trim();
    
    if (!phone) {
        showNotification('Please enter phone number', 'error');
        return;
    }
    
    // Clean phone number
    phone = phone.replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) {
        phone = phone.substring(1);
    }
    if (phone.length < 10 || phone.length > 13) {
        showNotification('Invalid phone number! Must be 10-13 digits', 'error');
        return;
    }
    
    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('result').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    document.getElementById('generateBtn').disabled = true;
    
    try {
        const response = await fetch('/api/pair', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: phone,
                method: currentMethod
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentSessionId = data.data.sessionId;
            
            // Display session info
            document.getElementById('sessionId').textContent = data.data.sessionId;
            
            if (data.data.method === 'code') {
                const code = data.data.pairingCode;
                const formattedCode = code.length === 8 ? 
                    code.substring(0, 4) + '-' + code.substring(4) : 
                    code;
                document.getElementById('pairingCode').textContent = formattedCode;
                document.getElementById('qrContainer').style.display = 'none';
            } else {
                document.getElementById('pairingCode').textContent = 'Scan QR Code';
                document.getElementById('qrContainer').style.display = 'block';
            }
            
            document.getElementById('command').textContent = `.sg ${data.data.sessionId}`;
            document.getElementById('result').style.display = 'block';
            
            showNotification('Session generated successfully! Check WhatsApp', 'success');
            
            // Clear input
            phoneInput.value = '';
            
            // Start checking session status
            checkSessionStatus(currentSessionId);
        } else {
            showNotification(data.error || 'Failed to generate session', 'error');
            document.getElementById('errorMsg').textContent = data.error || 'Failed to generate session';
            document.getElementById('error').style.display = 'block';
        }
    } catch (error) {
        console.error('Generation error:', error);
        showNotification('Network error. Please try again.', 'error');
        document.getElementById('errorMsg').textContent = 'Network error. Please try again.';
        document.getElementById('error').style.display = 'block';
    } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('generateBtn').disabled = false;
    }
}

// Check session status
async function checkSessionStatus(sessionId) {
    const interval = setInterval(async () => {
        try {
            const response = await fetch(`/api/status/${sessionId}`);
            const data = await response.json();
            
            if (!data.success || data.status === 'expired' || data.status === 'disconnected') {
                clearInterval(interval);
            }
        } catch (error) {
            clearInterval(interval);
        }
    }, 5000);
}

// Copy functions
function copySessionId() {
    const sessionId = document.getElementById('sessionId').textContent;
    copyToClipboard(sessionId, 'Session ID');
}

function copyPairingCode() {
    let code = document.getElementById('pairingCode').textContent;
    code = code.replace('-', '');
    copyToClipboard(code, 'Pairing code');
}

function copyCommand() {
    const command = document.getElementById('command').textContent;
    copyToClipboard(command, 'Command');
}

function copyToClipboard(text, name) {
    navigator.clipboard.writeText(text).then(() => {
        showNotification(`${name} copied to clipboard!`, 'success');
    }).catch(() => {
        showNotification('Failed to copy', 'error');
    });
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Navigation
function scrollToPair() {
    document.getElementById('pair').scrollIntoView({ behavior: 'smooth' });
}

// Method selection
document.querySelectorAll('.method-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentMethod = btn.dataset.method;
    });
});

// Premium button - Connect to channel
document.getElementById('premiumBtn')?.addEventListener('click', () => {
    window.open('https://wa.me/923076411098?text=I%20want%20to%20get%20premium%20BOSS%20MD', '_blank');
});

// Subscribe button
document.getElementById('subscribeBtn')?.addEventListener('click', () => {
    window.open('https://wa.me/923076411098?text=Subscribe%20me%20to%20BOSS%20MD%20channel', '_blank');
});

// Mobile menu toggle
document.getElementById('menuToggle')?.addEventListener('click', () => {
    document.getElementById('navLinks').classList.toggle('active');
});

// Close mobile menu on link click
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
        document.getElementById('navLinks').classList.remove('active');
    });
});

// Active link on scroll
window.addEventListener('scroll', () => {
    const sections = document.querySelectorAll('section');
    const scrollPos = window.scrollY + 200;
    
    sections.forEach(section => {
        const top = section.offsetTop;
        const height = section.offsetHeight;
        const id = section.getAttribute('id');
        
        if (scrollPos >= top && scrollPos < top + height) {
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
                if (link.getAttribute('href') === `#${id}`) {
                    link.classList.add('active');
                }
            });
        }
    });
});

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    initSocket();
    checkServerStatus();
    setInterval(checkServerStatus, 30000); // Check every 30 seconds
    
    // Measure response time
    const startTime = Date.now();
    fetch('/api/status').then(() => {
        const responseTime = Date.now() - startTime;
        document.getElementById('responseTime').textContent = responseTime;
    });
});
