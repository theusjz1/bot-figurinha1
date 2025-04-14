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
  console.log('Iniciando o bot...');

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

  // Log para verificar o estado da conexão
  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    console.log('Conexão Atualizada:', update);  // Log da atualização da conexão
    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) connectBot();
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP');
    }
  });

  // Verifique se o evento QR está sendo chamado corretamente
  sock.ev.on('qr', async (qr) => {
    console.log('QR RECEIVED', qr);  // Verifica se o QR Code está sendo gerado
    if (qr) {
      try {
        // Gerando o QR Code e salvando como PNG no caminho desejado
        const qrPath = path.join('C:', 'Users', 'theusjz', 'Documents', 'whatsapp-bot-stickers', 'qr-code.png');
        await QRCode.toFile(qrPath, qr);  // Gera o arquivo PNG
        console.log(`QR Code salvo como "qr-code.png" em: ${qrPath}`);
      } catch (error) {
        console.error('Erro ao gerar o QR Code:', error);
      }
    } else {
      console.log('QR Code não recebido.');
    }
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
