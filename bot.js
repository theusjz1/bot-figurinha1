const { WAConnection, MessageType, Mimetype, ReconnectMode, GroupSettingChange } = require('@adiwajshing/baileys');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const path = require('path');

async function startBot() {
    const conn = new WAConnection();
    
    // Carregar e salvar o estado de autenticação
    const authFile = './auth.json';
    try {
        const auth = fs.existsSync(authFile) ? JSON.parse(fs.readFileSync(authFile, 'utf-8')) : {};
        conn.loadAuthInfo(auth);
    } catch (err) {
        console.error('Erro ao carregar ou salvar o estado de autenticação:', err);
    }

    // Gerar QR code
    conn.on('qr', (qr) => {
        qrcode.generate(qr, { small: true });
    });

    conn.on('open', () => {
        console.log('Bot autenticado com sucesso');
    });

    conn.on('chat-update', async (chatUpdate) => {
        if (!chatUpdate.hasNewMessage) return;
        
        const message = chatUpdate.messages.all()[0];
        const messageType = message.message.conversation ? 'conversation' : '';
        
        if (messageType === 'conversation') {
            const msg = message.message.conversation;
            
            // Comando para transformar imagem em figurinha
            if (msg.startsWith("!figurinha")) {
                const media = await conn.downloadMediaMessage(message);
                const mediaBuffer = Buffer.from(media);
                await conn.sendMessage(message.key.remoteJid, mediaBuffer, MessageType.sticker);
                console.log('Figura enviada!');
            }
        }
    });

    // Conectar ao WhatsApp
    await conn.connect();

    // Salvar estado de autenticação após conectar
    const saveAuth = () => {
        const authInfo = conn.base64EncodedAuthInfo();
        fs.writeFileSync(authFile, JSON.stringify(authInfo, null, '\t'));
    };

    // Salvar sempre que a conexão for bem-sucedida
    conn.on('close', saveAuth);
}

startBot();
