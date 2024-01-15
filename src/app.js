// app.js

// Importation des modules nécessaires
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const authRoutes = require('./config/auth');

const session = require('express-session');
const RedisStore = require('connect-redis').default;


//const RedisStore = require("connect-redis").default(session);
//
const redis = require('redis');
let redisClient;
// Configuration de Redis pour utiliser l'add-on Heroku Redis
if (process.env.REDIS_URL) {
    // Utilisez l'URL de Redis fournie par Heroku en production
    redisClient = redis.createClient({
        url: process.env.REDIS_URL,
        legacyMode: true
    });
} else {
    // Configuration de Redis pour le développement local
    redisClient = redis.createClient({
        legacyMode: true
    });
}
// Connectez le client Redis et gérez les erreurs de connexion
redisClient.connect()
    .then(() => console.log('Connected to Redis'))
    .catch(console.error);

redisClient.on('error', (err) => console.error('Redis Client Error', err));



const cryptoRoutes = require('./api/v1/cryptoRoutes');
const fileController = require('./controllers/fileController');
// Importez oauth2Client depuis googleDriveApi.js
const { oauth2Client, getAuthUrl, findOrCreateFolder, writeFilesToDrive, findOrCreateFile } = require('./services/googleDriveService');


const axios = require('axios');

//////////////////////////
//////////////////////////

// const { getAuthUrl, findOrCreateFolder, writeFilesToDrive, findOrCreateFile } = require('./services/googleDriveService');
const { saveLastFileId, getLastFileId } = require('./services/redisService.js');
const app = express();
// Configuration des middlewares
app.use(cors());
app.use(express.json());
app.use(session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: 'auto', // ou true si vous êtes derrière un proxy et utilisez SSL
        maxAge: 3600000 // Durée de vie du cookie en millisecondes
    }
}));
//app.use(authRoutes); // Intégrer les routes d'authentification
app.use(authRoutes.router);
app.use('/api/v1', cryptoRoutes);
const { getAccessToken } = require('./config/auth');


//
const userId = 'user-id-obtenu-depuis-la-session-ou-autre';
//

const referenceCurrencies = ['BTC', 'ETH', 'BUSD', 'USDT']; // ... autres devises



// Configuration initiale pour Google Drive
async function setupGoogleDrive() {
    try {
        const folderId = await findOrCreateFolder();
        const configFileId = await findOrCreateFile(folderId, 'config.json');
        // Stockez ces ID pour une utilisation ultérieure dans l'application
        // ...
    } catch (error) {
        console.error("Erreur lors de la configuration initiale de Google Drive:", error);
    }
}

// Appel de la fonction de configuration au démarrage de l'application
setupGoogleDrive()
    .then(() => console.log('Configuration de Google Drive terminée.'))
    .catch(err => console.error('Échec de la configuration de Google Drive:', err));


// Définition des routes
app.use('/api/v1', cryptoRoutes);

// Route d'authentification Google
app.get('/auth/google', (req, res) => {
    res.redirect(getAuthUrl());
});


// Fonction pour séparer la paire de crypto-monnaies
function splitPair(pair) {
    for (let currency of referenceCurrencies) {
        if (pair.endsWith(currency)) {
            const crypto = pair.replace(currency, '');
            return { crypto, currency };
        }
    }
    throw new Error(`Devise de référence inconnue dans la paire ${pair}`);
}

// Route pour traiter les fichiers
app.get('/some-route', (req, res) => {
    fileController.processFiles(req)
        .then(() => res.send('Traitement terminé'))
        .catch(error => res.status(500).send('Erreur: ' + error.message));
});

// Route pour récupérer les données de l'API et les stocker dans Google Drive
app.get('/api/fetch-crypto-data', (req, res) => {
    fetchAndStoreCryptoData()
        .then(() => res.send('Données récupérées et stockées avec succès'))
        .catch(error => res.status(500).send('Erreur lors de la récupération des données'));
});

// Définissez une route pour gérer le callback d'authentification
app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        // Échangez le code contre les tokens.
        const tokens = await getAccessToken(code);

        // Stockez les tokens dans la session de l'utilisateur.
        req.session.googleTokens = tokens;

        // Configurez le client OAuth2 avec les tokens reçus.
        oauth2Client.setCredentials(tokens);

        const userInfo = await getUserInfo(tokens.access_token); // Vous aurez besoin d'une fonction pour récupérer les informations de l'utilisateur
        const userId = userInfo.id; // Ou un autre identifiant unique de l'utilisateur
        req.session.userId = userId; // Stocker l'ID utilisateur dans la session
        //

        // Stockez les tokens dans Redis associés à l'identifiant de l'utilisateur
        redisClient.set(`user:${userId}:tokens`, JSON.stringify(tokens));


        res.send('Authentification réussie et tokens stockés.');

    } catch (error) {
        console.error('Erreur lors de l\'échange du code:', error);
        res.status(500).send('Erreur d\'authentification');
    }
});

// Ajoutez une route pour rafraîchir le token d'accès si nécessaire
app.get('/refresh-token', async (req, res) => {
    if (req.session.googleTokens && req.session.googleTokens.refresh_token) {
        oauth2Client.setCredentials({
            refresh_token: req.session.googleTokens.refresh_token
        });
        const newAccessToken = await oauth2Client.getAccessToken(); // Cette méthode rafraîchira le token si nécessaire
        res.send('Token d\'accès rafraîchi.');
    } else {
        res.status(401).send('Aucun token de rafraîchissement disponible.');
    }
});

// Fonction pour récupérer les données de l'API et les stocker dans Google Drive
async function fetchAndStoreCryptoData() {
    console.log('Début de la récupération des données de l\'API Binance');
    try {
        const response = await axios.get('https://api1.binance.com/api/v3/ticker/price');
        const data = response.data;

        console.log('Données récupérées avec succès. Nombre d\'éléments récupérés:', data.length);

        const filteredGroupedPairs = data.reduce((acc, item) => {
            const { crypto, currency } = splitPair(item.symbol);
            if (referenceCurrencies.includes(currency)) {
                if (!acc[currency]) acc[currency] = [];
                acc[currency].push({ ...item, crypto, currency });
            }
            return acc;
        }, {});

        // Enregistrement dans Google Drive
        await writeFilesToDrive(JSON.stringify(filteredGroupedPairs), 'cryptoData.json');
        console.log('Données stockées dans Google Drive');
    } catch (error) {
        console.error('Erreur lors de la récupération ou du stockage des données:', error);
    }
}

redisClient.get(`user:${userId}:tokens`, (err, tokenData) => {
    if (err) {
        // Gérer l'erreur
        console.error('Erreur lors de la récupération UserID', err);
    }
    if (tokenData) {
        const { refresh_token, access_token } = JSON.parse(tokenData);
        oauth2Client.setCredentials({ refresh_token, access_token });
        // Utilisez oauth2Client pour accéder à l'API Google Drive
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});

