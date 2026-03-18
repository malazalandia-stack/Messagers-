require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files ho an'ny Admin Panel (HTML/CSS/JS)
app.use(express.static('public'));

// ---------------------------------------------------------
// DATABASE IN-MEMORY
// ---------------------------------------------------------
let qaDatabase = [
    { id: 1, question: "salama", reponse: "Miarahaba! Inona no azoko a-nanampiana anao?" },
    { id: 2, question: "vidiny", reponse: "Ny vidin'ny tolotra dia miankina amin'ny zavatra ilainao. Afaka manazava bebe kokoa ve ianao?" }
];

// ---------------------------------------------------------
// MESSENGER WEBHOOK (Verification & Réception)
// ---------------------------------------------------------
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "token_miafina_ho_an_ny_chatbot";

// 1. Verification Webhook avy amin'ny Facebook
app.get('/webhook', (req, res) => {
    let mode = req.query['hub.mode'];
    let token = req.query['hub.verify_token'];
    let challenge = req.query['hub.challenge'];

    console.log("--- Nisy requête GET tao amin'ny /webhook ---");
    console.log("Mode avy amin'ny FB:", mode);
    console.log("Token avy amin'ny FB:", token);
    console.log("Token fantatry ny Server-nao:", VERIFY_TOKEN);

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('=> FAHOMBIAZANA: WEBHOOK VERIFIED!');
            res.status(200).send(challenge);
        } else {
            console.log('=> TSY NETY: Tsy mitovy ny token nalefan\'ny FB sy ny an\'ny Server');
            res.sendStatus(403);
        }
    } else {
        console.log('=> TSY NETY: Tsy misy mode na token');
        res.status(400).send("Bad Request");
    }
});


// ---------------------------------------------------------
// API HO AN'NY ADMIN PANEL
// ---------------------------------------------------------

// Mahazo ny lisitra rehetra
app.get('/api/qa', (req, res) => {
    res.json(qaDatabase);
});

// (Ho avy: POST, PUT, DELETE ho an'ny fampidirana sy fanovana)

// ---------------------------------------------------------
// FANOMBOOANA NY SERVER
// ---------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server mandeha amin'ny port ${PORT}`);
});
