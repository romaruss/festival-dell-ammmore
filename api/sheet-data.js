require('dotenv').config(); // Necessario se hai variabili d'ambiente globali
const axios = require('axios');

const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

module.exports = async (req, res) => {
    try {
        const range = 'Foglio1!A:V'; // Specifica il range delle colonne che ti interessano
        const response = await axios.get(
            `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`
        );

        const rows = response.data.values;
        if (!rows || rows.length === 0) {
            return res.status(200).json([]); // Ritorna un array vuoto con status 200 (OK)
        }

        const headers = rows[0]; // La prima riga è ancora usata per le intestazioni delle altre colonne
        
        // Definisci un nome specifico per la prima colonna (Colonna A)
        // Puoi usare 'ColonnaA' o 'InGioco' a seconda di come vuoi che il frontend la acceda
        const firstColumnCustomName = 'InGioco'; // O 'InGioco' se preferisci

        const data = rows.slice(1).map(row => {
            let rowObject = {};
            headers.forEach((header, index) => {
                // Se l'indice è 0 (la prima colonna), usa il nome personalizzato
                if (index === 0) {
                    rowObject[firstColumnCustomName] = row[index] || '';
                } else {
                    // Per le altre colonne, usa l'intestazione originale o un nome generico se non definita
                    rowObject[header] = row[index] || '';
                }
            });
            return rowObject;
        });

        res.status(200).json(data); // Ritorna i dati con status 200 (OK)
    } catch (error) {
        console.error('Errore durante il recupero dei dati del foglio:', error.message);
        res.status(500).json({ error: 'Impossibile recuperare i dati del foglio.' });
    }
};
