const { Boom } = require('@hapi/boom');
const makeWASocket = require('@whiskeysockets/baileys').default;
const {
  useSingleFileAuthState,
  fetchLatestBaileysVersion,
  makeInMemoryStore,
  DisconnectReason,
} = require('@whiskeysockets/baileys');

const { state, saveState } = useSingleFileAuthState('./auth.json');
const pino = require('pino');
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) });
store.readFromFile('./baileys_store.json');

setInterval(() => {
  store.writeToFile('./baileys_store.json');
}, 10_000);

async function startSock() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' }),
  });

  store.bind(sock.ev);
  sock.ev.on('creds.update', saveState);

  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const body = msg.message?.conversation || msg.message?.extendedTextMessage?.text || "";
    const sender = msg.key.remoteJid;

    if (msg.message.imageMessage || msg.message.videoMessage) {
      if (body.toLowerCase().startsWith('!figurinha')) {
        const buffer = await sock.downloadMediaMessage(msg);
        await sock.sendMessage(sender, {
          sticker: buffer,
        }, { quoted: msg });
      }
    }
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startSock();
      }
    }
  });
}

startSock();
