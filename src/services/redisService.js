// src/services/redisService.js

const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL); // REDIS_URL est l'URL de votre instance Redis

client.on('error', function (error) {
    console.error(error);
});

// Vérifie si le client Redis est connecté
function isClientConnected() {
    return client.isOpen;
}

async function saveLastFileId(fileId) {
    try {
        console.log(`Tentative d'enregistrement du dernier FileId: ${fileId} dans Redis`);
        await client.set('lastFileId', fileId);
        console.log(`Dernier FileId enregistré avec succès: ${fileId}`);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement du dernier FileId dans Redis:', error);
        throw error;
    }
}

async function getLastFileId() {
    try {
        console.log('Tentative de récupération du dernier FileId depuis Redis');
        const reply = await client.get('lastFileId');
        if (reply) {
            console.log(`Dernier FileId récupéré avec succès: ${reply}`);
            return reply;
        } else {
            console.log('Aucun dernier FileId trouvé dans Redis');
            return null;
        }
    } catch (error) {
        console.error('Erreur lors de la récupération du dernier FileId depuis Redis:', error);
        throw error;
    }
}

async function saveOAuthTokens(tokens, userId = null) {
    const key = userId ? `user:${userId}:tokens` : 'oauthTokens';

    try {
        if (!isClientConnected()) {
            await client.connect();
        }
        console.log('Enregistrement des jetons OAuth2 pour l\'utilisateur:', userId);
        await client.set(`user:${userId}:tokens`, JSON.stringify(tokens), 'EX', 3600);
        console.log('Jetons enregistrés avec succès pour l\'utilisateur:', userId);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des jetons pour l\'utilisateur:', userId, error);
        throw error;
    }
}


async function getOAuthTokens(userId) {
    try {
        if (!isClientConnected()) {
            await client.connect();
        }
        console.log('Récupération des jetons OAuth2 pour l\'utilisateur:', userId);
        const reply = await client.get(`user:${userId}:tokens`);
        if (reply) {
            console.log('Jetons trouvés pour l\'utilisateur:', userId);
            return JSON.parse(reply);
        } else {
            console.log('Aucun jeton trouvé pour l\'utilisateur:', userId);
            return null;
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des jetons pour l\'utilisateur:', userId, error);
        throw error;
    }
}


module.exports = {
    saveLastFileId,
    getLastFileId,
    saveOAuthTokens, // Exportez la nouvelle fonction
    getOAuthTokens,  // Exportez la nouvelle fonction
};
