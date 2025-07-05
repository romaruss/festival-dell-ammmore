document.addEventListener('DOMContentLoaded', () => {
    // --- Variabili di configurazione ---
    const INITIAL_TOP_PANE_HEIGHT_PERCENT = 80;
    const TEAM_PHOTO_SHORT_SIDE_PX = 170;
    const STEP_PHOTO_SHORT_SIDE_PX = 150;
    const CAROUSEL_SPEED_PX_PER_SEC = 50;
    // ------------------------------------

    const resizableContainer = document.getElementById('resizableContainer');
    const topPane = document.getElementById('topPane');
    const bottomPane = document.getElementById('bottomPane');
    const dragger = document.getElementById('dragger');
    const teamPhotosGrid = document.getElementById('team-photos-grid');
    const stepPhotosCarouselInner = document.getElementById('step-photos-carousel');
    const stepPhotosCarouselContainer = stepPhotosCarouselInner.parentElement;

    // Imposta le altezze iniziali
    topPane.style.height = `${INITIAL_TOP_PANE_HEIGHT_PERCENT}%`;
    bottomPane.style.height = `${100 - INITIAL_TOP_PANE_HEIGHT_PERCENT}%`;

    let isDragging = false;

    dragger.addEventListener('mousedown', () => {
        isDragging = true;
        document.body.style.cursor = 'ns-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const containerRect = resizableContainer.getBoundingClientRect();
        let newHeightPercent = ((e.clientY - containerRect.top) / containerRect.height) * 100;
        newHeightPercent = Math.max(10, Math.min(90, newHeightPercent)); // Limita l'altezza

        topPane.style.height = `${newHeightPercent}%`;
        bottomPane.style.height = `${100 - newHeightPercent}%`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    });

    // Funzione per ottenere l'URL immagine da Google Drive
    function getImageUrl(fileId) {
        // Puoi aggiungere un fallback o un'immagine predefinita se fileId è nullo/vuoto
        if (!fileId) {
            console.warn('ID del file Google Drive mancante.');
            return ''; // O un URL di un'immagine segnaposto
        }
        return `https://drive.google.com/thumbnail?id=${fileId}&sz=w600-h400`;
    }

    // Funzione per ridimensionare l'elemento foto in base alle dimensioni naturali dell'immagine
    function resizeImage(imgElement, photoItemElement, shortSidePx) {
        const width = imgElement.naturalWidth;
        const height = imgElement.naturalHeight;

        if (width === 0 || height === 0) { // Evita divisione per zero o dimensioni non caricate
            console.warn('Immagine non caricata o con dimensioni zero:', imgElement.src);
            return;
        }

        if (width < height) { // Verticale
            imgElement.style.width = 'auto';
            imgElement.style.height = `${shortSidePx}px`;
            photoItemElement.style.width = `${(shortSidePx / height) * width}px`;
            photoItemElement.style.height = `${shortSidePx}px`;
        } else { // Orizzontale o Quadrata
            imgElement.style.width = `${shortSidePx}px`;
            imgElement.style.height = 'auto';
            photoItemElement.style.width = `${shortSidePx}px`;
            photoItemElement.style.height = `${(shortSidePx / width) * height}px`;
        }
    }

    // Funzione per creare un elemento immagine con overlay (rifattorizzata per riutilizzo)
    function createImageElement(fileId, altText, isEliminated, teamName = null, isStepPhoto = false) {
        const photoItem = document.createElement('div');
        photoItem.classList.add('photo-item');
        if (isEliminated) {
            photoItem.classList.add('grayscale');
        }
        if (teamName) {
            photoItem.classList.add('team-photo');
        }
        if (isStepPhoto) {
            photoItem.classList.add('step-photo');
        }

        const img = document.createElement('img');
        img.src = getImageUrl(fileId);
        img.alt = altText;
        img.onerror = () => {
            console.error('Errore caricamento immagine:', img.src);
            // Puoi aggiungere un'immagine di fallback qui
            img.src = 'placeholder-error.png'; // Assicurati di avere questa immagine
            img.classList.add('error-image');
        };

        const currentShortSidePx = isStepPhoto ? STEP_PHOTO_SHORT_SIDE_PX : TEAM_PHOTO_SHORT_SIDE_PX;

        const imgLoadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
                resizeImage(img, photoItem, currentShortSidePx);
                resolve(photoItem); // Risolvi la promise con l'elemento una volta caricato
            };
            img.onerror = (e) => {
                console.error(`Impossibile caricare l'immagine ${altText} dall'ID: ${fileId}`, e);
                // Non rigettare la promise, ma risolvila con l'elemento (anche se con errore)
                // Questo permette a Promise.allSettled di completare tutte le promise
                resolve(photoItem);
            };
        });

        photoItem.appendChild(img);

        if (teamName) {
            const nameOverlay = document.createElement('div');
            nameOverlay.classList.add('team-name');
            nameOverlay.textContent = teamName;
            photoItem.appendChild(nameOverlay);
        }

        if (isEliminated) {
            const invalidOverlay = document.createElement('div');
            invalidOverlay.classList.add('invalid-overlay');
            invalidOverlay.textContent = 'X';
            photoItem.appendChild(invalidOverlay);
        }
        
        return { element: photoItem, promise: imgLoadPromise };
    }

    // Funzione per calcolare e impostare la durata dell'animazione del carosello
    function setCarouselAnimationDuration() {
        // La larghezza effettiva di una singola "ripetizione" del carosello
        // Se duplichi, il carosello.scrollWidth è il doppio della larghezza utile.
        const carouselWidth = stepPhotosCarouselInner.scrollWidth / 2;
        const duration = carouselWidth / CAROUSEL_SPEED_PX_PER_SEC; // Durata in secondi
        stepPhotosCarouselInner.style.setProperty('--scroll-duration', `${duration}s`);
    }

    // Caricamento dati dal backend e popolamento UI
    async function loadData() {
        try {
            const response = await fetch('/api/sheet-data');
            const data = await response.json();

            if (data.error) {
                alert('Errore caricamento dati: ' + data.error);
                return;
            }

            // Pulisco contenitori prima di aggiungere nuovi elementi
            teamPhotosGrid.innerHTML = '';
            stepPhotosCarouselInner.innerHTML = '';

            // Popola il mosaico delle foto squadra (sezione superiore)
            for (const row of data) {
                const photoId = row.FotoSquadra;
                const teamName = row.NomeSquadra;
                const isEliminated = row.InGioco && row.InGioco.toLowerCase() === 'eliminato';

                if (!photoId) continue;

                const { element: teamPhotoElement } = createImageElement(photoId, teamName, isEliminated, teamName, false);
                if (teamPhotoElement) {
                    teamPhotosGrid.appendChild(teamPhotoElement);
                }
            }

            // Popola il carosello con le foto step valide
            const stepImageCreationResults = []; // Per tenere traccia degli elementi e delle loro promise
            for (const row of data) {
                for (let i = 2; i <= 4; i++) {
                    const stepId = row[`step${i}`];
                    const stepValid = row[`step${i}_valid`] && row[`step${i}_valid`].toLowerCase() === 'invalid';

                    if (!stepId || stepValid) continue;

                    const result = createImageElement(stepId, `Step ${i} Foto`, false, null, true);
                    if (result && result.element) {
                        stepPhotosCarouselInner.appendChild(result.element);
                        stepImageCreationResults.push(result);
                    }
                }
            }
            
            // Attendi che tutte le immagini del carosello siano caricate e ridimensionate
            // Prima di duplicarle per l'effetto infinito.
            await Promise.allSettled(stepImageCreationResults.map(res => res.promise));

            // Ora che le immagini originali sono caricate e dimensionate, le duplico
            // Per il carosello infinito. Clona solo gli elementi che sono stati effettivamente aggiunti.
            stepImageCreationResults.forEach(result => {
                if (result.element) {
                    const clonedPhoto = result.element.cloneNode(true);
                    stepPhotosCarouselInner.appendChild(clonedPhoto);
                }
            });

            setCarouselAnimationDuration();

            // Pausa animazione al passaggio mouse
            stepPhotosCarouselContainer.addEventListener('mouseenter', () => {
                stepPhotosCarouselInner.classList.add('paused');
            });
            stepPhotosCarouselContainer.addEventListener('mouseleave', () => {
                stepPhotosCarouselInner.classList.remove('paused');
            });

        } catch (err) {
            alert('Errore caricamento dati dal server. Controlla console.');
            console.error('Errore durante il caricamento o la manipolazione dei dati:', err);
        }
    }

    loadData();
});
