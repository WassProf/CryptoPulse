// src/services/redisService.js

const redis = require('redis');
const client = redis.createClient(process.env.REDIS_URL); // REDIS_URL est l'URL de votre instance Redis

client.on('error', function (error) {
    console.error(error);
});

async function saveLastFileId(fileId) {
    return new Promise((resolve, reject) => {
        client.set('lastFileId', fileId, (error, reply) => {
            if (error) reject(error);
            resolve(reply);
        });
    });
}

async function getLastFileId() {
    return new Promise((resolve, reject) => {
        client.get('lastFileId', (error, reply) => {
            if (error) reject(error);
            resolve(reply);
        });
    });
}

// Ajoutez ces nouvelles fonctions pour gérer les tokens OAuth2
async function saveOAuthTokens(tokens) {
    return new Promise((resolve, reject) => {
        client.set('oauthTokens', JSON.stringify(tokens), 'EX', 3600, (error, reply) => {  // Expire en 1 heure
            if (error) reject(error);
            resolve(reply);
        });
    });
}

async function getOAuthTokens() {
    return new Promise((resolve, reject) => {
        client.get('oauthTokens', (error, reply) => {
            if (error) reject(error);
            resolve(reply ? JSON.parse(reply) : null);
        });
    });
}

module.exports = {
    saveLastFileId,
    getLastFileId,
    saveOAuthTokens, // Exportez la nouvelle fonction
    getOAuthTokens  // Exportez la nouvelle fonction
};
