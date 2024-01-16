// app.js

// Importations nécessaires
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const redis = require('redis');
const { google } = require('googleapis');
const cors = require('cors');
const authRoutes = require('./config/auth');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const cryptoRoutes = require('./api/v1/cryptoRoutes');
const fileController = require('./controllers/fileController');
const { oauth2Client, getAuthUrl, findOrCreateFolder, writeFilesToDrive, findOrCreateFile, setAuthCredentials, } = require('./config/googleDriveApi');
const { getOAuthTokens } = require('./services/redisService');
const { saveLastFileId, getLastFileId } = require('./services/redisService.js');
//////////////////////////

// Initialiser le client Redis
const redisClient = redis.createClient({
    url: process.env.REDIS_URL // Assurez-vous que cette variable d'environnement est définie
});

redisClient.on('error', (err) => console.error('Redis Client Error', err));

//////////////////////////

// Configuration du serveur Express
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
        await setAuthCredentials();
        const folderId = await findOrCreateFolder();
        const configFileId = await findOrCreateFile(folderId, 'config.json');

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


// Gestionnaire de route pour le callback OAuth2
app.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    if (code) {
        try {
            // Échangez le code contre un token
            const { data } = await axios.post('https://oauth2.googleapis.com/token', {
                code,
                client_id: process.env.GOOGLE_CLIENT_ID,
                client_secret: process.env.GOOGLE_CLIENT_SECRET,
                redirect_uri: process.env.GOOGLE_REDIRECT_URI,
                grant_type: 'authorization_code'
            });

            const { access_token, refresh_token } = data;

            // Stockez le refresh_token dans Redis
            const userId = 'votre_user_id'; // Remplacez ceci par l'ID d'utilisateur approprié
            await redisClient.set(`user:${userId}:tokens`, JSON.stringify({
                access_token, refresh_token
            }));


            // Configurez oauth2Client avec les tokens reçus
            oauth2Client.setCredentials({
                access_token,
                refresh_token
            });

            // Logique après avoir reçu les tokens, par exemple rediriger l'utilisateur vers une page de profil
            res.redirect('/profile');
        } catch (error) {
            console.error('Erreur lors de l\'échange du code d\'autorisation pour un token:', error.response || error.message);
            res.status(500).send('Erreur interne du serveur');
        }
    } else {
        res.status(400).send('Code d\'autorisation manquant');
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



async function startServer() {
    try {
        await redisClient.connect();
        console.log('Connected to Redis');

        // Ici, assurez-vous que les credentials OAuth2 sont configurés
        await setAuthCredentials();

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
        });
    } catch (error) {
        console.error('Redis Client Error', error);
    }
}

startServer(); // Ceci démarre la fonction et donc l'application
