document.addEventListener('DOMContentLoaded', () => {
    // --- Variabili di configurazione facili da modificare ---
    const INITIAL_TOP_PANE_HEIGHT_PERCENT = 80; // Altezza iniziale del pannello superiore in percentuale
    
    // NUOVE VARIABILI: Dimensioni separate per i lati corti
    const TEAM_PHOTO_SHORT_SIDE_PX = 170; // Dimensione del lato corto per le foto delle squadre
    const STEP_PHOTO_SHORT_SIDE_PX = 150; // Dimensione del lato corto per le foto degli step

    const CAROUSEL_SPEED_PX_PER_SEC = 50; // Velocità di scorrimento del carosello in pixel al secondo
    // --------------------------------------------------------

    const resizableContainer = document.getElementById('resizableContainer');
    const topPane = document.getElementById('topPane');
    const bottomPane = document.getElementById('bottomPane');
    const dragger = document.getElementById('dragger');
    const teamPhotosGrid = document.getElementById('team-photos-grid');
    const stepPhotosCarouselInner = document.getElementById('step-photos-carousel');    
    const stepPhotosCarouselContainer = stepPhotosCarouselInner.parentElement;

    // Imposta l'altezza iniziale del pannello superiore
    topPane.style.height = `${INITIAL_TOP_PANE_HEIGHT_PERCENT}%`;
    bottomPane.style.height = `${100 - INITIAL_TOP_PANE_HEIGHT_PERCENT}%`;

    let isDragging = false;

    dragger.addEventListener('mousedown', (e) => {
        isDragging = true;
        document.body.style.cursor = 'ns-resize';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const containerRect = resizableContainer.getBoundingClientRect();
        let newTopPaneHeight = (e.clientY - containerRect.top) / containerRect.height * 100;

        // Limita l'altezza per evitare che i pannelli scompaiano
        newTopPaneHeight = Math.max(10, Math.min(90, newTopPaneHeight));

        topPane.style.height = `${newTopPaneHeight}%`;
        bottomPane.style.height = `${100 - newTopPaneHeight}%`;
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        document.body.style.cursor = 'default';
    });

    // --- INIZIO MODIFICA QUI ---
    // Funzione per ottenere l'URL dell'immagine usando il proxy di Vercel
    function getImageUrl(fileId) {
        if (!fileId) {
            console.warn('ID del file Google Drive mancante.');
            return ''; 
        }
        // Usa il tuo nuovo endpoint API proxy su Vercel
        return `/api/image-proxy?id=${fileId}`; 
    }
    // --- FINE MODIFICA QUI ---


    // Funzione HELPER: Per dimensionare l'elemento foto in base alle dimensioni naturali dell'immagine
    // Ora accetta 'shortSidePx' come parametro
    function setPhotoItemDimensions(imgElement, photoItemElement, shortSidePx) {
        const width = imgElement.naturalWidth;
        const height = imgElement.naturalHeight;

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

    // Funzione per creare un elemento immagine con overlay
    function createImageElement(fileId, alt, isInvalid, teamName = null, isStepPhoto = false) {
        if (!fileId) {
            return null;
        }

        const photoItem = document.createElement('div');
        photoItem.classList.add('photo-item');
        if (isInvalid) {
            photoItem.classList.add('grayscale');
        }
        if (teamName) {
            photoItem.classList.add('team-photo');
        }
        if (isStepPhoto) {
            photoItem.classList.add('step-photo');
        }

        const img = document.createElement('img');
        // --- MODIFICA ANCHE QUI: Chiamata alla nuova funzione getImageUrl ---
        img.src = getImageUrl(fileId); 
        // --- FINE MODIFICA ---
        img.alt = alt;

        // Determina quale dimensione del lato corto usare
        const currentShortSidePx = isStepPhoto ? STEP_PHOTO_SHORT_SIDE_PX : TEAM_PHOTO_SHORT_SIDE_PX;

        const imgLoadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
                // Passa la dimensione specifica alla funzione di dimensionamento
                setPhotoItemDimensions(img, photoItem, currentShortSidePx);    
                resolve(photoItem);
            };
            img.onerror = () => {
                console.error('Impossibile caricare l\'immagine dall\'ID:', fileId);
                reject(new Error(`Immagine non caricata: ${fileId}`));    
            };
        });

        photoItem.appendChild(img);

        if (teamName) {
            const nameOverlay = document.createElement('div');
            nameOverlay.classList.add('team-name');
            nameOverlay.textContent = teamName;
            photoItem.appendChild(nameOverlay);
        }

        if (isInvalid) {
            const invalidOverlay = document.createElement('div');
            invalidOverlay.classList.add('invalid-overlay');
            invalidOverlay.textContent = 'X';
            photoItem.appendChild(invalidOverlay);
        }
        
        return { element: photoItem, promise: imgLoadPromise };
    }

    // Funzione per calcolare la durata dell'animazione in base alla larghezza del carosello e alla velocità desiderata
    function setCarouselAnimationDuration() {
        const carouselWidth = stepPhotosCarouselInner.scrollWidth / 2; // La larghezza di una singola "ripetizione" del carosello
        const duration = carouselWidth / CAROUSEL_SPEED_PX_PER_SEC; // Durata in secondi
        stepPhotosCarouselInner.style.setProperty('--scroll-duration', `${duration}s`);
    }

    // Carica i dati dal backend
    async function loadSheetData() {
        try {
            const response = await fetch('/api/sheet-data');
            const data = await response.json();

            if (data.error) {
                console.error('Errore dal server:', data.error);
                alert('Errore nel caricamento dei dati: ' + data.error);
                return;
            }

            // Pulisci i contenitori prima di aggiungere nuovi elementi (utile per hot reload)
            teamPhotosGrid.innerHTML = '';
            stepPhotosCarouselInner.innerHTML = '';

            // Popola il mosaico delle foto squadra (sezione sopra)
            data.forEach(row => {
                const fotoSquadraId = row.FotoSquadra;
                const nomeSquadra = row.NomeSquadra;

                const isInGiocoEliminato = row.InGioco && row.InGioco.toLowerCase();
                const isEliminated = isInGiocoEliminato === 'eliminato';

                // Passiamo TEAM_PHOTO_SHORT_SIDE_PX per le foto squadra
                const { element: teamPhotoElement } = createImageElement(fotoSquadraId, nomeSquadra, isEliminated, nomeSquadra, false); // isStepPhoto è false
                if (teamPhotoElement) {
                    teamPhotosGrid.appendChild(teamPhotoElement);
                }
            });

            const stepImageLoadPromises = [];
            const originalStepPhotoElements = [];    

            // Pre-popola il carosello con le foto step valide
            data.forEach(row => {
                for (let i = 1; i <= 5; i++) {
                    const stepColumn = `Prova${i}`;
                    const stepValidColumn = `Prova${i}_valid`;

                    const stepPhotoId = row[stepColumn];
                    const stepPhotoValid = row[stepValidColumn] && row[stepValidColumn].toLowerCase() === 'invalid';

                    if (!stepPhotoValid) {    
                        // Passiamo STEP_PHOTO_SHORT_SIDE_PX per le foto step
                        const result = createImageElement(stepPhotoId, `Step ${i} Foto`, false, null, true); // isStepPhoto è true
                        if (result && result.element) {
                            stepPhotosCarouselInner.appendChild(result.element);    
                            stepImageLoadPromises.push(result.promise);    
                            originalStepPhotoElements.push(result.element);    
                        }
                    }
                }
            });

            await Promise.allSettled(stepImageLoadPromises);    

            originalStepPhotoElements.forEach(photoElement => {
                if (photoElement) {
                    const clonedPhoto = photoElement.cloneNode(true);    
                    stepPhotosCarouselInner.appendChild(clonedPhoto);
                }
            });

            setCarouselAnimationDuration();    

            stepPhotosCarouselContainer.addEventListener('mouseenter', () => {
                stepPhotosCarouselInner.classList.add('paused');
            });
            stepPhotosCarouselContainer.addEventListener('mouseleave', () => {
                stepPhotosCarouselInner.classList.remove('paused');
            });

        } catch (error) {
            console.error('Errore generale durante il caricamento dei dati:', error);
            alert('Errore nel caricamento dei dati dal server. Controlla la console.');
        }
    }

    loadSheetData();
});
