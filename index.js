const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

const warnStorage = new Map();
const blackList = new Set();

async function startNexusBot() {
    // 1. Ampiasao ny folder 'session' fa aza 'auth_info' mba hadio kokoa amin'ny GitHub
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
        // FIKA: Ampiasao ity Browser ity mba hitovy amin'ny finday mampiasa Chrome
        browser: ["Ubuntu", "Chrome", "110.0.5563.147"],
        syncFullHistory: false,
        linkPreviewHighQuality: true
    });

    // --- PAIRING CODE LOGIC (Natao 15 segondra mba ho stable) ---
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
                console.error("Fahadisoana: Mety efa nisy code nivoaka. Avereno ny deploy.", err);
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

    // --- WELCOME MESSAGE ---
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

    // --- ANTI-LINK & AUTO-KICK ---
    sock.ev.on('messages.upsert', async (chat) => {
        const msg = chat.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        if (!isGroup) return;

        const participant = msg.key.participant || remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const containsLink = /(https?:\/\/[^\s]+)/g.test(text);
        const isAllowedDomain = text.includes("vercel.app") || text.includes("drive.google.com");

        if (containsLink && !isAllowedDomain) {
            await sock.sendMessage(remoteJid, { delete: msg.key });

            if (!warnStorage.has(participant)) {
                warnStorage.set(participant, 1);
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ @${participant.split('@')[0]}, fampitandremana voalohany! Rohy Vercel sy Drive ihany no azo alefa ato.`,
                    mentions: [participant]
                });
            } else {
                await sock.sendMessage(remoteJid, { text: `🚫 Veloma @${participant.split('@')[0]}!`, mentions: [participant] });
                blackList.add(participant); 
                await sock.groupParticipantsUpdate(remoteJid, [participant], "remove");
            }
        }
    });
}

startNexusBot();
