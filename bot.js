const { default: makeWASocket, useSingleFileAuthState, fetchLatestBaileysVersion, DisconnectReason, makeInMemoryStore, Browsers } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const fs = require("fs");
const path = require("path");
const qrcode = require("qrcode");

// Autenticação
const { state, saveState } = useSingleFileAuthState("./auth.json");

// Função para inicializar o bot
async function startSock() {
  const { version, isLatest } = await fetchLatestBaileysVersion();
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    browser: Browsers.ubuntu("Bot WhatsApp"),
  });

  // Salva a sessão quando houver mudanças
  sock.ev.on("creds.update", saveState);

  // Evento de recebimento de mensagens
  sock.ev.on("messages.upsert", async (msg) => {
    const m = msg.messages[0];
    if (!m.message || m.key.fromMe) return;

    const messageType = Object.keys(m.message)[0];
    const sender = m.key.remoteJid;

    // Comando "!figurinha" com imagem
    if (m.message?.imageMessage && m.message.imageMessage.caption?.toLowerCase() === "!figurinha") {
      const buffer = await sock.downloadMediaMessage(m);
      await sock.sendMessage(sender, {
        sticker: buffer,
      });
    }

    // Comando "!figurinha" com vídeo curto (máx. 10s)
    if (m.message?.videoMessage && m.message.videoMessage.caption?.toLowerCase() === "!figurinha") {
      const buffer = await sock.downloadMediaMessage(m);
      await sock.sendMessage(sender, {
        sticker: buffer,
      });
    }
  });

  // Reconexão em caso de desconexão
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === "close") {
      const shouldReconnect =
        lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("Conexão encerrada. Reconectando?", shouldReconnect);
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === "open") {
      console.log("Conectado com sucesso ✅");
    }
  });
}

startSock();
