// src/services/googleDriveService.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

const { google } = require('googleapis');

const { saveLastFileId, getLastFileId } = require('./redisService');
const fileController = require('../controllers/fileController');
const axios = require('axios');

const FOLDER_NAME = 'GDriveDB-CryptoPulse'; // Remplacez par l'ID de votre dossier Google Drive

// Configurez ici l'authentification OAuth2 avec les détails de votre application
const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
);

oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
});

// Accès à l'API Google Drive
const drive = google.drive({ version: 'v3', auth: oauth2Client });



async function findOrCreateFolder() {
    try {
        // Rechercher le dossier par son nom
        let response = await drive.files.list({
            q: `mimeType='application/vnd.google-apps.folder' and name='${FOLDER_NAME}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        const folders = response.data.files;
        if (folders.length > 0) {
            // Si le dossier existe déjà, retourner son ID
            return folders[0].id;
        } else {
            // Sinon, créer un nouveau dossier
            response = await drive.files.create({
                resource: {
                    name: FOLDER_NAME,
                    mimeType: 'application/vnd.google-apps.folder'
                },
                fields: 'id'
            });
            return response.data.id;
        }
    } catch (error) {
        console.error("Erreur lors de la recherche ou de la création du dossier:", error);
        throw error;
    }
}


async function findOrCreateFile(folderId, fileName, defaultContent = {}) {
    try {
        // Rechercher le fichier par son nom dans le dossier
        let response = await drive.files.list({
            q: `name='${fileName}' and parents in '${folderId}' and trashed=false`,
            fields: 'files(id, name)',
            spaces: 'drive',
        });

        const files = response.data.files;
        if (files.length > 0) {
            // Si le fichier existe déjà, retourner son ID
            return files[0].id;
        } else {
            // Sinon, créer un nouveau fichier avec du contenu par défaut
            response = await drive.files.create({
                resource: {
                    name: fileName,
                    mimeType: 'application/json',
                    parents: [folderId]
                },
                media: {
                    mimeType: 'application/json',
                    body: JSON.stringify(defaultContent)
                },
                fields: 'id'
            });
            return response.data.id;
        }
    } catch (error) {
        console.error("Erreur lors de la recherche ou de la création du fichier:", error);
        throw error;
    }
}


async function writeFilesToDrive(data, fileName) {
    try {
        const folderId = await findOrCreateFolder();

        const fileMetadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/json',
            appProperties: {
                lastModified: new Date().toISOString()
            }
        };

        const media = {
            mimeType: 'application/json',
            body: JSON.stringify(data)
        };

        // Recherche du fichier existant
        const existingFile = await drive.files.list({
            q: `name = '${fileName}' and mimeType = 'application/json' and '${folderId}' in parents`,
            spaces: 'drive',
            fields: 'files(id)'
        });

        let file;
        if (existingFile.data.files.length === 0) {
            // Créer un nouveau fichier
            file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
        } else {
            // Mettre à jour le fichier existant
            file = await drive.files.update({
                fileId: existingFile.data.files[0].id,
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
        }

        return file.data.id;
    } catch (error) {
        console.error("Erreur lors de l'écriture des fichiers sur Google Drive:", error);
        throw error;
    }
}

async function readFilesFromDrive() {
    try {
        const query = `appProperties has { key='processed' and value='false' } or not appProperties has { key='processed' }`;

        const response = await drive.files.list({
            q: query,
            fields: 'files(id, name)',
            spaces: 'drive'
        });

        let fileContents = [];
        for (const file of response.data.files) {
            const fileResponse = await drive.files.get({
                fileId: file.id,
                alt: 'media'
            });
            fileContents.push(fileResponse.data);
        }

        return fileContents;
    } catch (error) {
        console.error("Erreur lors de la lecture des fichiers depuis Google Drive:", error);
        throw error;
    }
}

async function markFileAsProcessed(fileId) {
    try {
        await drive.files.update({
            fileId: fileId,
            resource: {
                appProperties: {
                    processed: 'true'
                }
            }
        });
    } catch (error) {
        console.error("Erreur lors de la mise à jour du fichier:", error);
        throw error;
    }
}

async function writeFilesToDrive(data, fileName) {
    try {
        const folderId = await findOrCreateFolder();
        let fileMetadata = {
            name: fileName,
            parents: [folderId],
            mimeType: 'application/json'
        };

        let media = {
            mimeType: 'application/json',
            body: JSON.stringify(data)
        };

        // Rechercher si le fichier existe déjà
        let existingFileResponse = await drive.files.list({
            q: `name='${fileName}' and parents in '${folderId}' and trashed=false`,
            spaces: 'drive',
            fields: 'files(id)'
        });

        let file;
        if (existingFileResponse.data.files.length === 0) {
            // Créer un nouveau fichier si nécessaire
            file = await drive.files.create({
                resource: fileMetadata,
                media: media,
                fields: 'id'
            });
        } else {
            // Mettre à jour le fichier existant
            let fileId = existingFileResponse.data.files[0].id;
            file = await drive.files.update({
                fileId: fileId,
                resource: fileMetadata,
                media: media
            });
        }

        return file.data.id;
    } catch (error) {
        console.error("Erreur lors de l'écriture sur Google Drive:", error);
        throw error;
    }
}

async function readFile(fileId) {
    try {
        const response = await drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        return response.data; // Retourne le contenu du fichier
    } catch (error) {
        console.error("Erreur lors de la lecture du fichier:", error.message);
        throw error;
    }
}

module.exports = {
    readFilesFromDrive,
    writeFilesToDrive,
    markFileAsProcessed,
    findOrCreateFolder, // Ajoutez cette ligne pour exporter la fonction
    readFile
};