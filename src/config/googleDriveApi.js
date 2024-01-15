// googleDriveApi.js
const { google } = require('googleapis');
const { getOAuthTokens } = require('../services/redisService');

// Création et configuration de oauth2Client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

// Définition de setAuthCredentials
async function setAuthCredentials() {
    try {
        const tokens = await getOAuthTokens();
        if (tokens) {
            oauth2Client.setCredentials(tokens);
        }
    } catch (error) {
        console.error('Erreur lors de la définition des credentials OAuth2:', error);
    }
}

// Génération de l'URL d'authentification
function getAuthUrl() {
    return oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['https://www.googleapis.com/auth/drive']
    });
}

// Fonction pour obtenir et définir le token d'accès à partir du code
async function getAndSetAccessToken(code) {
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);
        return tokens;
    } catch (error) {
        console.error('Erreur lors de l\'obtention et de la définition du token d\'accès:', error);
        throw error;
    }
}

setAuthCredentials();

module.exports = {
    getAuthUrl,
    getAndSetAccessToken,
    setAuthCredentials,
    oauth2Client
};
