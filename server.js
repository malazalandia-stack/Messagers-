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

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log('WEBHOOK VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    }
});

// 2. Fandraisana hafatra avy amin'ny mpampiasa
app.post('/webhook', (req, res) => {
    let body = req.body;

    if (body.object === 'page') {
        body.entry.forEach(function(entry) {
            let webhook_event = entry.messaging[0];
            console.log(webhook_event);
            
            // Eto no apetraka ny code mampifandray ilay webhook_event amin'ny qaDatabase
            // ary mandefa ny valiny miverina any amin'ny Messenger API.
        });
        res.status(200).send('EVENT_RECEIVED');
    } else {
        res.sendStatus(404);
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
