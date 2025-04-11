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

async function connectBot() {
  console.log('⏳ Iniciando conexão com o WhatsApp...');

  const { state, saveCreds } = await useMultiFileAuthState('./auth');
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    console.log('📡 Atualização da conexão:', connection);

    if (connection === 'close') {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Conexão encerrada. Reconectando?', shouldReconnect);
      if (shouldReconnect) connectBot();
    } else if (connection === 'open') {
      console.log('✅ BOT CONECTADO AO WHATSAPP');
    }
  });

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const jid = msg.key.remoteJid;
    const tipoMsg = Object.keys(msg.message)[0];
    const texto = msg.message?.conversation || msg.message?.extendedTextMessage?.text || '';
    console.log(`📥 Mensagem recebida de ${jid}:`, texto);

    if (texto?.toLowerCase().includes('!figurinha')) {
      if (
        tipoMsg === 'imageMessage' ||
        tipoMsg === 'videoMessage' ||
        tipoMsg === 'extendedTextMessage'
      ) {
        try {
          console.log('🧲 Baixando mídia...');
          const buffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino() });

          const tempInput = path.join(__dirname, 'temp_input');
          const tempOutput = path.join(__dirname, 'temp_output.webp');

          await writeFile(tempInput, buffer);

          console.log('🎥 Convertendo para sticker...');
          await new Promise((resolve, reject) => {
            ffmpeg(tempInput)
              .outputOptions([
                '-vcodec', 'libwebp',
                '-vf', 'scale=512:512:force_original_aspect_ratio=decrease,fps=15',
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
          console.log('✅ Sticker enviado com sucesso!');
        } catch (err) {
          console.error('❌ Erro ao converter figurinha:', err);
          await sock.sendMessage(jid, { text: '❌ Erro ao converter figurinha!' }, { quoted: msg });
        }
      } else {
        await sock.sendMessage(jid, { text: '❗ Envie uma imagem ou vídeo com a legenda !figurinha' }, { quoted: msg });
      }
    }
  });
}

connectBot();
console.log('🚀 bot.js foi executado!');
