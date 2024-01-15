// src/api/v1/cryptoRoutes.js

const express = require('express');
const router = express.Router();

// Route pour obtenir des données depuis Google Drive
router.get('/crypto-data', async (req, res) => {
    try {
        const data = await readFilesFromDrive();
        res.json(data);
    } catch (error) {
        res.status(500).send("Erreur lors de la lecture des données");
    }
});

// Route pour envoyer des données à Google Drive
router.post('/crypto-data', async (req, res) => {
    try {
        await writeFilesToDrive(req.body);
        res.status(200).send('Données enregistrées avec succès');
    } catch (error) {
        res.status(500).send("Erreur lors de l'enregistrement des données");
    }
});

module.exports = router;
