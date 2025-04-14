const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  downloadMediaMessage
} = require('baileys');

const fs = require('fs');
const pino = require('pino');
const { writeFile } = require('fs/promises');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const QRCode = require('qrcode');  // Importando a biblioteca qrcode

async function connectBot() {
  // Ajuste do caminho da pasta de autenticação para ser absoluto
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth'));
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,  // Garante que o QR Code será exibido no terminal
    auth: state,              // Usa o estado da autenticação gerado
    browser: ['Chrome (Bot)', 'Safari', '1.0.0'],  // Ajuda a gerar um QR Code mais claro
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectBot();
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP');
    }
  });

  sock.ev.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);

    // Gera o QR Code em formato de imagem (PNG) e salva no diretório atual
    await QRCode.toFile('qr-code.png', qr);  // Gera a imagem PNG
    console.log('QR Code salvo como "qr-code.png".');
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || !msg.key) return;

    const jid = msg.key.remoteJid;
    const tipoMsg = Object.keys(msg.message)[0];
    const isGroup = jid.endsWith('@g.us');
    const texto = msg.message?.conversation ||
                  msg.message?.extendedTextMessage?.text ||
                  msg.message?.imageMessage?.caption ||
                  msg.message?.videoMessage?.caption || '';

    console.log(`📥 Mensagem de ${jid}: ${texto}`);

    if (texto.toLowerCase().includes('!figurinha')) {
      if (
        tipoMsg === 'imageMessage' ||
        tipoMsg === 'videoMessage'
      ) {
        try {
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino() });
          const tempInput = path.join(__dirname, 'temp_input');
          const tempOutput = path.join(__dirname, 'temp_output.webp');

          await writeFile(tempInput, buffer);

          await new Promise((resolve, reject) => {
            ffmpeg(tempInput)
              .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=24',
                '-loop', '0',
                '-ss', '0',
                '-t', '10',
                '-preset', 'default',
                '-an',
                '-vsync', '0'
              ])
              .toFormat('webp')
              .save(tempOutput)
              .on('end', resolve)
              .on('error', reject);
          });

          const stickerBuffer = fs.readFileSync(tempOutput);

          await sock.sendMessage(jid, {
            sticker: stickerBuffer
          }, { quoted: msg });

          fs.unlinkSync(tempInput);
          fs.unlinkSync(tempOutput);
          console.log('✅ Sticker enviado!');
        } catch (err) {
          console.error('❌ Erro ao criar figurinha:', err);
          await sock.sendMessage(jid, { text: '❌ Erro ao criar figurinha' }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(jid, { text: '❗ Envie uma imagem ou vídeo com a legenda !figurinha' }, { quoted: msg });
      }
    }
  });
}

connectBot();
