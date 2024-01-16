// googleDriveApi.js
const { google } = require('googleapis');
const { getOAuthTokens } = require('../services/redisService');

// Création et configuration de oauth2Client
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

async function setAuthCredentials() {
    try {
        console.log('Tentative de configuration des credentials OAuth2');
        const tokenData = await getOAuthTokens(); // Function to get tokens from Redis
        if (tokenData) {
            const { access_token, refresh_token } = JSON.parse(tokenData);
            oauth2Client.setCredentials({
                access_token: access_token,
                refresh_token: refresh_token
            });
            console.log('Credentials OAuth2 configurés avec succès');
        } else {
            throw new Error('No tokens found in Redis');
            console.log('Aucun jeton OAuth2 trouvé pour configurer les credentials');
        }
    } catch (error) {
        console.error('Error setting OAuth2 credentials:', error);
        throw error;
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
    oauth2Client,
};
