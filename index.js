const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    delay,
    jidDecode
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const { Boom } = require("@hapi/boom");

// Tehirizina eto vonjimaika ireo nanao fahadisoana (Anti-Link Tracker)
const warnStorage = new Map();
const blackList = new Set();

async function startNexusBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // Pairing code no ampiasaina
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.04"]
    });

    // --- PAIRING CODE LOGIC ---
    if (!sock.authState.creds.registered) {
        const phoneNumber = "261323911654"; 
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n--- PAIRING CODE NEXUS ---`);
            console.log(`Kodia ampiasaina: ${code}`);
            console.log(`--------------------------\n`);
        }, 3000);
    }

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) startNexusBot();
        } else if (connection === 'open') {
            console.log('NEXUS Bot efa mandeha soa aman-tsara!');
        }
    });

    sock.ev.on('creds.update', saveCreds);

    // 1. MIARAHABA OLONA VAOVAO (Welcome Message)
    sock.ev.on('group-participants.update', async (anu) => {
        if (anu.action === 'add') {
            const welcomeMsg = `Miarahaba anao tonga soa ato amin'ny vondrona NEXUS tompoko! ✨\n\n` +
                `Midira eto mijery tutorial vidéo feno tanteraka makasika an'i NEXUS tompoko:\n` +
                `https://drive.google.com/file/d/126zJCOzbBbV16O9irm15eoOs9PuOSmr9/view?usp=drivesdk\n\n` +
                `Ity kosa raha hanao inscription:\n` +
                `https://nexusmada.vercel.app?ref=be-ge116\n` +
                `ID : be-ge116`;

            await sock.sendMessage(anu.id, { text: welcomeMsg });
        }
    });

    // 2. ANTI-LINK SY FILTRAGE (Advanced)
    sock.ev.on('messages.upsert', async (chat) => {
        const msg = chat.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const remoteJid = msg.key.remoteJid;
        const participant = msg.key.participant || remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        // Hijery raha misy rohy (Link detection)
        const containsLink = /(https?:\/\/[^\s]+)/g.test(text);
        const isAllowedDomain = text.includes("vercel.app") || text.includes("drive.google.com");

        if (containsLink && !isAllowedDomain) {
            // A. Check raha efa ao anaty Blacklist (raha tafiditra tamin'ny fomba hafa)
            if (blackList.has(participant)) {
                await sock.groupParticipantsUpdate(remoteJid, [participant], "remove");
                return;
            }

            // B. Hamafa ny message avy hatrany
            await sock.sendMessage(remoteJid, { delete: msg.key });

            // C. Tantana ny fampitandremana (Warning System)
            if (!warnStorage.has(participant)) {
                warnStorage.set(participant, 1);
                await sock.sendMessage(remoteJid, { 
                    text: `⚠️ Fampitandremana voalohany @${participant.split('@')[0]}!\nVoarara ny mandefa rohy hafa ankoatry ny Vercel sy Google Drive. Hesorina ianao raha mamerina izany.`,
                    mentions: [participant]
                });
            } else {
                // D. Action faharoa: Kick sy Blacklist
                await sock.sendMessage(remoteJid, { text: `🚫 Efa nampitandremana ianao @${participant.split('@')[0]}. Veloma!`, mentions: [participant] });
                
                blackList.add(participant); // Ampidirina anaty lisitra voasakana
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
                    await sock.sendMessage(anu.id, { text: `Fampahafantarana: Ny mpikambana ${user.split('@')[0]} dia ao anaty lisitra mainty ary nesorina ho azy.`, mentions: [user] });
                    await sock.groupParticipantsUpdate(anu.id, [user], "remove");
                }
            }
        }
    });
}

startNexusBot();
