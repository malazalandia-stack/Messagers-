const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");
const http = require("http"); // Ampiana ity mba hamitahana an'i Render

// --- FIX FOR RENDER PORT BINDING ---
// Ity no hamaha ilay "No open ports detected"
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('NEXUS BOT IS RUNNING');
}).listen(PORT, () => {
    console.log(`Server mihandrona amin'ny port ${PORT}`);
});

const warnStorage = new Map();
const blackList = new Set();

async function startNexusBot() {
    const { state, saveCreds } = await useMultiFileAuthState('session');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        version,
        browser: ["Ubuntu", "Chrome", "110.0.5563.147"], // Browser stable ho an'ny server
        syncFullHistory: false
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "261323911654"; 
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n**********************************`);
                console.log(`KODIA PAIRING NEXUS: ${code}`);
                console.log(`**********************************\n`);
            } catch (err) {
                console.error("Fahadisoana kodia:", err);
            }
        }, 15000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNexusBot();
        } else if (connection === 'open') {
            console.log("NEXUS Bot efa mifandray soa aman-tsara!");
        }
    });

    // --- LOGIC WELCOME & ANTI-LINK (Ny teo aloha ihany) ---
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const welcomeMsg = "Miarahaba anao tonga soa ato amin'ny vondrona NEXUS tompoko! ✨\n\n" +
                "Midira eto mijery tutorial vidéo feno tanteraka makasika an'i NEXUS tompoko.\n\n" +
                "https://drive.google.com/file/d/126zJCOzbBbV16O9irm15eoOs9PuOSmr9/view?usp=drivesdk\n\n" +
                "Ity kosa Raha hanao inscription.\n\n" +
                "https://nexusmada.vercel.app?ref=be-ge116\n\n" +
                "ID : be-ge116";
            await sock.sendMessage(anu.id, { text: welcomeMsg });
        }
    });

    sock.ev.on('messages.upsert', async (chat) => {
        const msg = chat.messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const remoteJid = msg.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;
        const participant = msg.key.participant || remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const containsLink = /(https?:\/\/[^\s]+)/g.test(text);
        const isAllowed = text.includes("vercel.app") || text.includes("drive.google.com");

        if (containsLink && !isAllowed) {
            await sock.sendMessage(remoteJid, { delete: msg.key });
            if (!warnStorage.has(participant)) {
                warnStorage.set(participant, 1);
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ @${participant.split('@')[0]}, fampitandremana voalohany! Rohy Vercel sy Drive ihany no azo alefa.`,
                    mentions: [participant]
                });
            } else {
                await sock.sendMessage(remoteJid, { text: "🚫 Kick + Blacklist!", mentions: [participant] });
                blackList.add(participant); 
                await sock.groupParticipantsUpdate(remoteJid, [participant], "remove");
            }
        }
    });
}

startNexusBot();
