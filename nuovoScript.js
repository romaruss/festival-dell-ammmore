document.addEventListener('DOMContentLoaded', () => {
  const INITIAL_TOP_PANE_HEIGHT_PERCENT = 80;
  const TEAM_PHOTO_SHORT_SIDE_PX = 170;
  const STEP_PHOTO_SHORT_SIDE_PX = 150;
  const CAROUSEL_SPEED_PX_PER_SEC = 50;

  const resizableContainer = document.getElementById('resizableContainer');
  const topPane = document.getElementById('topPane');
  const bottomPane = document.getElementById('bottomPane');
  const dragger = document.getElementById('dragger');
  const teamPhotosGrid = document.getElementById('team-photos-grid');
  const stepPhotosCarouselInner = document.getElementById('step-photos-carousel');
  const stepPhotosCarouselContainer = stepPhotosCarouselInner.parentElement;

  // Imposto le altezze iniziali
  topPane.style.height = INITIAL_TOP_PANE_HEIGHT_PERCENT + '%';
  bottomPane.style.height = (100 - INITIAL_TOP_PANE_HEIGHT_PERCENT) + '%';

  // Variabile per il trascinamento
  let isDragging = false;

  dragger.addEventListener('mousedown', () => {
    isDragging = true;
    document.body.style.cursor = 'ns-resize';
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const containerRect = resizableContainer.getBoundingClientRect();
    let newHeightPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
    newHeightPercent = Math.max(10, Math.min(90, newHeightPercent));

    topPane.style.height = newHeightPercent + '%';
    bottomPane.style.height = (100 - newHeightPercent) + '%';
  });

  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
  });

  // Funzione per ottenere l'URL immagine da Google Drive
  function getImageUrl(fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600-h400`;
  }

  // Funzione semplice per ridimensionare le immagini in base al lato corto
  function resizeImage(img, container, shortSide) {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (w < h) {  // verticale
      img.style.height = shortSide + 'px';
      img.style.width = 'auto';
      container.style.height = shortSide + 'px';
      container.style.width = (w * shortSide / h) + 'px';
    } else {  // orizzontale o quadrato
      img.style.width = shortSide + 'px';
      img.style.height = 'auto';
      container.style.width = shortSide + 'px';
      container.style.height = (h * shortSide / w) + 'px';
    }
  }

  // Caricamento dati e creazione immagini
  async function loadData() {
    try {
      const response = await fetch('/api/sheet-data');
      const data = await response.json();

      if (data.error) {
        alert('Errore caricamento dati: ' + data.error);
        return;
      }

      // Pulisco contenitori
      teamPhotosGrid.innerHTML = '';
      stepPhotosCarouselInner.innerHTML = '';

      // Carico foto squadra
      for (const row of data) {
        const photoId = row.FotoSquadra;
        const teamName = row.NomeSquadra;
        const eliminated = row.InGioco && row.InGioco.toLowerCase() === 'eliminato';

        if (!photoId) continue;

        const div = document.createElement('div');
        div.classList.add('photo-item', 'team-photo');
        if (eliminated) div.classList.add('grayscale');

        const img = document.createElement('img');
        img.src = getImageUrl(photoId);
        img.alt = teamName;

        img.onload = () => resizeImage(img, div, TEAM_PHOTO_SHORT_SIDE_PX);

        div.appendChild(img);

        const nameOverlay = document.createElement('div');
        nameOverlay.classList.add('team-name');
        nameOverlay.textContent = teamName;
        div.appendChild(nameOverlay);

        if (eliminated) {
          const invalidOverlay = document.createElement('div');
          invalidOverlay.classList.add('invalid-overlay');
          invalidOverlay.textContent = 'X';
          div.appendChild(invalidOverlay);
        }

        teamPhotosGrid.appendChild(div);
      }

      // Carico foto step valide
      const stepElements = [];
      for (const row of data) {
        for (let i = 2; i <= 4; i++) {
          const stepId = row[`step${i}`];
          const stepValid = row[`step${i}_valid`] && row[`step${i}_valid`].toLowerCase() === 'invalid';

          if (!stepId || stepValid) continue;

          const div = document.createElement('div');
          div.classList.add('photo-item', 'step-photo');

          const img = document.createElement('img');
          img.src = getImageUrl(stepId);
          img.alt = `Step ${i} Foto`;

          img.onload = () => resizeImage(img, div, STEP_PHOTO_SHORT_SIDE_PX);

          div.appendChild(img);
          stepPhotosCarouselInner.appendChild(div);
          stepElements.push(div);
        }
      }

      // Duplichiamo le immagini per effetto carosello infinito
      stepElements.forEach(el => {
        stepPhotosCarouselInner.appendChild(el.cloneNode(true));
      });

      // Calcolo durata animazione in base alla larghezza e velocità
      const carouselWidth = stepPhotosCarouselInner.scrollWidth / 2;
      const durationSec = carouselWidth / CAROUSEL_SPEED_PX_PER_SEC;
      stepPhotosCarouselInner.style.setProperty('--scroll-duration', `${durationSec}s`);

      // Pausa animazione al passaggio mouse
      stepPhotosCarouselContainer.addEventListener('mouseenter', () => {
        stepPhotosCarouselInner.classList.add('paused');
      });
      stepPhotosCarouselContainer.addEventListener('mouseleave', () => {
        stepPhotosCarouselInner.classList.remove('paused');
      });

    } catch (err) {
      alert('Errore caricamento dati dal server. Controlla console.');
      console.error(err);
    }
  }

  loadData();
});
