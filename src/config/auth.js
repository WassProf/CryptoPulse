const { google } = require('googleapis');
const express = require('express');
const router = express.Router();

const { oauth2Client } = require('../config/googleDriveApi');
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

const { client: redisClient } = require('../services/redisService');

const { saveOAuthTokens, getOAuthTokens } = require('../services/redisService');

function getAuthUrl() {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES,
        prompt: 'consent', // Ensure that we always get a refresh token
    });
    return authUrl;
}

async function getAccessToken(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        console.log('Tokens received:', tokens);
        oauth2Client.setCredentials(tokens);
        // Store tokens in Redis
        const userKey = `user:user-id:tokens`; // Replace 'user-id' with the actual user ID
        await redisClient.set(userKey, JSON.stringify(tokens));
        console.log('Tokens stored in Redis');
        return tokens;
    } catch (error) {
        console.error('Error getting tokens:', error);
        throw error;
    }
}

async function getUserInfo(accessToken) {
    const oauth2 = google.oauth2({
        auth: oauth2Client,
        version: 'v2'
    });

    oauth2Client.setCredentials({
        access_token: accessToken
    });

    try {
        const userInfoResponse = await oauth2.userinfo.get();
        return userInfoResponse.data; // Renvoie les données de l'utilisateur
    } catch (error) {
        console.error('Erreur lors de la récupération des informations de l\'utilisateur :', error);
        throw error; // Propagez l'erreur pour la gérer plus loin
    }
}

// Lors de la réception des jetons initiaux
oauth2Client.setCredentials({
    scope: "https://www.googleapis.com/auth/drive",
    token_type: "Bearer",
    expiry_date: Date.now() + 3600 * 1000 // Date d'expiration du jeton d'accès
});



oauth2Client.on('tokens', (tokens) => {
    if (tokens.refresh_token) {
        console.log('Nouveau refresh token reçu :', tokens.refresh_token);
        // Remplacez 'user-id' par l'ID utilisateur réel
        redisClient.set(`user:user-id:refreshToken`, tokens.refresh_token, (err) => {
            if (err) {
                console.error('Erreur lors de l\'enregistrement du nouveau refresh token :', err);
            } else {
                console.log('Nouveau refresh token enregistré avec succès');
            }
        });
    }
    if (tokens.access_token) {
        console.log('Nouveau access token reçu :', tokens.access_token);
        // Ici, vous pourriez vouloir également stocker le access token dans Redis
        redisClient.set(`user:user-id:accessToken`, tokens.access_token, (err) => {
            if (err) {
                console.error('Erreur lors de l\'enregistrement du nouveau access token :', err);
            } else {
                console.log('Nouveau access token enregistré avec succès');
            }
        });
    }
});

// Route pour démarrer le processus d'authentification
router.get('/auth/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive']
    });
    res.redirect(authUrl);
});

// // Lors de la réception du callback de Google avec le code
// router.get('/auth/google/callback', async (req, res) => {
//     const { code } = req.query;
//     try {
//         const { tokens } = await oauth2Client.getToken(code);
//         oauth2Client.setCredentials(tokens);
//         await saveOAuthTokens(tokens); // Stockez les tokens dans Redis
//         res.redirect('/some-redirect-url'); // Redirigez vers l'URL souhaitée après l'authentification
//     } catch (error) {
//         console.error('Error retrieving access token', error);
//         res.status(500).send('Authentication failed');
//     }
// });

router.get('/auth/google/callback', async (req, res) => {
    const { code } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Récupérer les informations de l'utilisateur
        const userInfo = await getUserInfo(tokens.access_token);
        const userId = userInfo.id;

        // Stocker l'ID de l'utilisateur dans la session
        req.session.userId = userId;

        // Stocker les tokens dans Redis avec l'ID de l'utilisateur
        await saveOAuthTokens(userId, tokens);

        res.redirect('/some-success-page');
    } catch (error) {
        console.error('Error retrieving access token', error);
        res.status(500).send('Authentication failed');
    }
});

module.exports = {
    getAuthUrl,
    getAccessToken,
    getUserInfo,
    router,
    oauth2Client,
};

