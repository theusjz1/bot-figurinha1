const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, delay } = require('@adiwajshing/baileys');
const express = require('express');
const qrcode = require('qrcode');

// Configurar o Express para servir o QR Code como HTML
const app = express();
const port = process.env.PORT || 3000;

// Defina o caminho para o arquivo de autenticação
const authPath = './auth';

// Use MultiFileAuthState para gerenciar autenticação
const { state, saveState } = useMultiFileAuthState(authPath);

// Função para gerar e exibir o QR Code como HTML
const generateQrCode = (qr) => {
    return qrcode.toDataURL(qr, { errorCorrectionLevel: 'H' })
        .then(url => {
            return `<html>
                        <body>
                            <h1>Escaneie o QR Code para logar no WhatsApp</h1>
                            <img src="${url}" alt="QR Code" />
                        </body>
                    </html>`;
        });
};

// Crie a conexão do WhatsApp
const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false, // Desabilitar a exibição do QR Code no terminal
});

// Salve o estado de autenticação após a inicialização
sock.ev.on('creds.update', saveState);

// Configurar o servidor Express para exibir o QR Code
app.get('/', async (req, res) => {
    try {
        // Gerar QR Code
        const qrCodeHtml = await generateQrCode(sock.generateQR());
        res.send(qrCodeHtml);
    } catch (error) {
        res.status(500).send('Erro ao gerar o QR Code');
    }
});

// Iniciar o servidor Express
app.listen(port, () => {
    console.log(`Servidor de QR Code rodando na porta ${port}`);
});

// Evento de quando o bot é autenticado com sucesso
sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === 'close') {
        const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== 401;
        console.log('Conexão perdida, tentando reconectar...', shouldReconnect);
        if (shouldReconnect) {
            // Reconectar após desconexão
            makeWASocket({
                auth: state
            });
        }
    } else if (connection === 'open') {
        console.log('Bot autenticado e conectado com sucesso!');
    }
});

// Função para processar mensagens
sock.ev.on('messages.upsert', async (m) => {
    console.log(m);

    // Exemplo de resposta a uma mensagem com "!figurinha"
    const message = m.messages[0];
    if (message.message?.imageMessage?.caption === "!figurinha") {
        const sticker = await sock.sendImageAsSticker(message.key.remoteJid, message.message.imageMessage.url);
        console.log('Figura enviada!', sticker);
    }
});

// Iniciar o bot
const startBot = async () => {
    console.log("Bot iniciado. Aguardando QR Code para autenticação...");
};

startBot();
