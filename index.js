const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

// Fitahirizana vonjimaika ny warning sy ny blacklist
const warnStorage = new Map();
const blackList = new Set();

async function startNexusBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        printQRInTerminal: false,
        version,
        // Browser Windows/Chrome mba hisorohana ny "Impossible de connecter"
        browser: ["Windows", "Chrome", "110.0.5481.178"],
        syncFullHistory: false,
        markOnlineOnConnect: true
    });

    // --- LOGIC PAIRING CODE ---
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
                console.error("Fahadisoana fangatahana code:", err);
            }
        }, 8000); // 8 segondra mba hahazoana antoka
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNexusBot();
        } else if (connection === 'open') {
            console.log("NEXUS Bot efa mandeha soa aman-tsara!");
        }
    });

    // 1. MIARAHABA OLONA VAOVAO (Welcome Message)
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const welcomeMsg = "Miarahaba anao tonga soa ato amin'ny vondrona NEXUS tompoko! ✨\n\n" +
                "Midira eto mijery tutorial vidéo feno tanteraka makasika an'i NEXUS tompoko.\n\n" +
                "https://drive.google.com/file/d/126zJCOzbBbV16O9irm15eoOs9PuOSmr9/view?usp=drivesdk\n\n" +
                "Ity kosa Raha hanao inscription.\n\n" +
                "https://nexusmada.vercel.app?ref=be-ge116\n\n" +
                "ID : be-ge116Midira eto mijery tutorial vidéo feno tanteraka makasika an'i NEXUS tompoko.\n\n" +
                "https://drive.google.com/file/d/126zJCOzbBbV16O9irm15eoOs9PuOSmr9/view?usp=drivesdk\n\n" +
                "Ity kosa Raha hanao inscription.\n\n" +
                "https://nexusmada.vercel.app?ref=be-ge116\n\n" +
                "ID : be-ge116";

            await sock.sendMessage(anu.id, { text: welcomeMsg });
        }
    });

    // 2. ANTI-LINK SY FILTRAGE (Advanced)
    sock.ev.on('messages.upsert', async (chat) => {
        const msg = chat.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        if (!isGroup) return;

        const participant = msg.key.participant || remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Sivana Domaine azo alefa
        const containsLink = /(https?:\/\/[^\s]+)/g.test(text);
        const isAllowedDomain = text.includes("vercel.app") || text.includes("drive.google.com");

        if (containsLink && !isAllowedDomain) {
            // A. Fafana avy hatrany ilay message
            await sock.sendMessage(remoteJid, { delete: msg.key });

            // B. Fitantanana Warning sy Kick
            if (!warnStorage.has(participant)) {
                warnStorage.set(participant, 1);
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ @${participant.split('@')[0]}, fampitandremana voalohany avy amin'ny IA! Voarara ny mandefa rohy ato ankoatry ny Vercel sy Drive. Hesorina ianao raha mamerina izany.`,
                    mentions: [participant]
                });
            } else {
                // Kick sy Blacklist mandrakizay
                await sock.sendMessage(remoteJid, { text: `🚫 Efa nampitandremana ianao @${participant.split('@')[0]}. Veloma!`, mentions: [participant] });
                
                blackList.add(participant); 
                await sock.groupParticipantsUpdate(remoteJid, [participant], "remove");
                warnStorage.delete(participant);
            }
        }
    });

    // 3. BLACKLIST ENFORCEMENT (Sakana tsy hiditra intsony)
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            for (let user of anu.participants) {
                if (blackList.has(user)) {
                    await sock.groupParticipantsUpdate(anu.id, [user], "remove");
                }
            }
        }
    });
}

startNexusBot();
