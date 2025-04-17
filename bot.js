const express = require('express');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { default: makeWASocket, useSingleFileAuthState } = require('baileys');

const { state, saveState } = useSingleFileAuthState('./auth.json');

const app = express();
const PORT = process.env.PORT || 3000;

let qrCodeData = null;

// Página HTML com o QR
app.get('/qr', (req, res) => {
  if (!qrCodeData) {
    return res.send('<h2>QR Code ainda não gerado. Aguarde...</h2>');
  }

  res.send(`
    <html>
      <head>
        <title>QR do Bot</title>
      </head>
      <body style="text-align:center; font-family:sans-serif; margin-top:40px">
        <h2>Escaneie o QR Code abaixo</h2>
        <img src="data:image/png;base64,${qrCodeData}" />
        <p>Atualize esta página se o QR expirar.</p>
      </body>
    </html>
  `);
});

// Inicializa o bot e gera o QR
async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr } = update;
    if (qr) {
      const qrBuffer = await qrcode.toBuffer(qr);
      qrCodeData = qrBuffer.toString('base64');
      console.log('✅ QR disponível em /qr');
    }

    if (connection === 'open') {
      console.log('✅ Bot conectado com sucesso!');
    }
  });

  sock.ev.on('creds.update', saveState);
}

startBot();

app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}/qr`);
});
