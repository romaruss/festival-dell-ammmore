require('dotenv').config(); // Necessario se hai variabili d'ambiente globali
const axios = require('axios');

// Vercel inietta automaticamente le variabili d'ambiente del tuo progetto
// quindi potresti non aver bisogno di dotenv.config() se le configuri correttamente su Vercel.
const GOOGLE_SHEET_ID = process.env.GOOGLE_SHEET_ID;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Questo è il modo in cui Vercel si aspetta le funzioni serverless.
// Ogni file in `api/` diventa un endpoint.
// Il nome del file (`sheet-data.js`) diventa il percorso (`/api/sheet-data`).
module.exports = async (req, res) => {
  try {
    const range = 'Foglio1!A:J'; // Specifica il range delle colonne che ti interessano
    const response = await axios.get(
      `https://sheets.googleapis.com/v4/spreadsheets/${GOOGLE_SHEET_ID}/values/${range}?key=${GOOGLE_API_KEY}`
    );

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      return res.status(200).json([]); // Ritorna un array vuoto con status 200 (OK)
    }

    const headers = rows[0];
    const data = rows.slice(1).map(row => {
      let rowObject = {};
      headers.forEach((header, index) => {
        rowObject[header] = row[index] || '';
      });
      return rowObject;
    });

    res.status(200).json(data); // Ritorna i dati con status 200 (OK)
  } catch (error) {
    console.error('Errore durante il recupero dei dati del foglio:', error.message);
    res.status(500).json({ error: 'Impossibile recuperare i dati del foglio.' });
  }
};
