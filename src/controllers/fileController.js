// fileController.js

const { google } = require('googleapis');
const { readFilesFromDrive, markFileAsProcessed } = require('../services/googleDriveService');
const oauth2Client = require('../config/auth');
const drive = google.drive({ version: 'v3', auth: oauth2Client });

async function processFiles(req) {
    try {
        // Configurez oauth2Client avec les jetons de la session
        if (req.session && req.session.googleTokens) {
            oauth2Client.setCredentials(req.session.googleTokens);
        } else {
            throw new Error('Les jetons OAuth2 ne sont pas disponibles dans la session.');
        }

        const filesMetadata = await readFilesFromDrive();
        for (const fileMetadata of filesMetadata) {
            // Traiter chaque fichier ici...
            await markFileAsProcessed(fileMetadata.id);
        }


    } catch (error) {
        console.error('Erreur lors du traitement des fichiers:', error);
    }
}

module.exports = {
    processFiles
};
