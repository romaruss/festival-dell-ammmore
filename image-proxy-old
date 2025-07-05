const axios = require('axios');

// Funzione handler per Vercel Serverless Function
module.exports = async (req, res) => {
  const { id } = req.query; // Recupera l'ID del file dalla query string (es. /api/image-proxy?id=XYZ)

  if (!id) {
    return res.status(400).send('Missing file ID');
  }

  try {
    const googleDriveUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w1000-h800`; // Puoi usare dimensioni più grandi per il proxy

    // Effettua la richiesta per scaricare l'immagine da Google Drive
    const response = await axios.get(googleDriveUrl, {
      responseType: 'arraybuffer' // Importante per gestire i dati dell'immagine
    });

    // Imposta l'header Content-Type basandosi su quello ricevuto da Google Drive
    // Se non lo riceviamo, proviamo a indovinare un default (es. image/jpeg)
    const contentType = response.headers['content-type'] || 'image/jpeg'; 
    res.setHeader('Content-Type', contentType);
    res.status(200).send(response.data); // Invia i dati dell'immagine al browser
  } catch (error) {
    console.error('Error fetching image from Google Drive:', error.message);
    // Per debug, potresti inviare un'immagine segnaposto o un messaggio di errore
    res.status(500).send('Error loading image');
  }
};
