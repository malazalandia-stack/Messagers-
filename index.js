const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

const warnStorage = new Map();
const blackList = new Set();

async function startNexusBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false,
        auth: state,
        version,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    if (!sock.authState.creds.registered) {
        const phoneNumber = "261323911654"; 
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log(`\n==================================`);
                console.log(`KODIA PAIRING NEXUS: ${code}`);
                console.log(`==================================\n`);
            } catch (error) {
                console.error("Fahadisoana pairing code:", error);
            }
        }, 6000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNexusBot();
        } else if (connection === 'open') {
            // ANDALANA 51: Namboarina mba tsy hisy syntax error
            console.log("NEXUS Bot efa mandeha soa aman-tsara!");
        }
    });

    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const welcomeMsg = "Miarahaba anao tonga soa ato amin'ny vondrona NEXUS tompoko! ✨\n\n" +
                "Midira eto mijery tutorial vidéo feno tanteraka makasika an'i NEXUS tompoko:\n" +
                "https://drive.google.com/file/d/126zJCOzbBbV16O9irm15eoOs9PuOSmr9/view?usp=drivesdk\n\n" +
                "Ity kosa raha hanao inscription:\n" +
                "https://nexusmada.vercel.app?ref=be-ge116\n" +
                "ID : be-ge116";

            await sock.sendMessage(anu.id, { text: welcomeMsg });
        }
    });

    sock.ev.on('messages.upsert', async (chat) => {
        const msg = chat.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        if (!isGroup) return;

        const participant = msg.key.participant || remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        const containsLink = /(https?:\/\/[^\s]+)/g.test(text);
        const isAllowed = text.includes("vercel.app") || text.includes("drive.google.com");

        if (containsLink && !isAllowed) {
            await sock.sendMessage(remoteJid, { delete: msg.key });

            if (!warnStorage.has(participant)) {
                warnStorage.set(participant, 1);
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ @${participant.split('@')[0]}, voarara ny mandefa rohy ato. Fampitandremana voalohany.`,
                    mentions: [participant]
                });
            } else {
                await sock.sendMessage(remoteJid, { text: `🚫 Efa nampitandremana ianao. Veloma!`, mentions: [participant] });
                blackList.add(participant);
                await sock.groupParticipantsUpdate(remoteJid, [participant], "remove");
            }
        }
    });

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
