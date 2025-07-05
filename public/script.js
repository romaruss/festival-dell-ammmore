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

    function getImageUrl(fileId) {
        if (!fileId) {
            console.warn('ID del file Google Drive mancante.');
            return ''; 
        }
        return `/api/image-proxy?id=${fileId}`; 
    }

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
        img.src = getImageUrl(fileId); 
        img.alt = alt;

        const currentShortSidePx = isStepPhoto ? STEP_PHOTO_SHORT_SIDE_PX : TEAM_PHOTO_SHORT_SIDE_PX;

        const imgLoadPromise = new Promise((resolve, reject) => {
            img.onload = () => {
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

    function setCarouselAnimationDuration() {
        // La logica per il carosello infinito ora dovrà essere riconsiderata
        // Potrebbe essere necessario modificare anche il CSS per l'animazione
        const carouselWidth = stepPhotosCarouselInner.scrollWidth; // Usa l'intera larghezza, non la metà
        const duration = carouselWidth / CAROUSEL_SPEED_PX_PER_SEC; 
        stepPhotosCarouselInner.style.setProperty('--scroll-duration', `${duration}s`);
    }

    async function loadSheetData() {
        try {
            const response = await fetch('/api/sheet-data');
            const data = await response.json();

            if (data.error) {
                console.error('Errore dal server:', data.error);
                alert('Errore nel caricamento dei dati: ' + data.error);
                return;
            }

            teamPhotosGrid.innerHTML = '';
            stepPhotosCarouselInner.innerHTML = '';

            // Popola il mosaico delle foto squadra (sezione sopra)
            data.forEach(row => {
                const fotoSquadraId = row.FotoSquadra;
                const nomeSquadra = row.NomeSquadra;

                const isInGiocoEliminato = row.InGioco && row.InGioco.toLowerCase();
                const isEliminated = isInGiocoEliminato === 'eliminato';

                const result = createImageElement(fotoSquadraId, nomeSquadra, isEliminated, nomeSquadra, false);
                if (result && result.element) {
                    teamPhotosGrid.appendChild(result.element);
                } else if (result === null) {
                    console.warn(`Impossibile creare elemento per foto squadra, ID mancante: ${fotoSquadraId || 'Non specificato'}`);
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
                        const result = createImageElement(stepPhotoId, `Step ${i} Foto`, false, null, true); 
                        if (result && result.element) {
                            stepPhotosCarouselInner.appendChild(result.element);    
                            stepImageLoadPromises.push(result.promise);    
                            originalStepPhotoElements.push(result.element);    
                        } else if (result === null) {
                            console.warn(`Impossibile creare elemento per Prova ${i} foto, ID mancante: ${stepPhotoId || 'Non specificato'}`);
                        }
                    }
                }
            });

            await Promise.allSettled(stepImageLoadPromises);    

            // --- INIZIO MODIFICA QUI: Rimuovi il blocco che clona le foto per il carosello infinito ---
            // originalStepPhotoElements.forEach(photoElement => {
            //     if (photoElement) {
            //         const clonedPhoto = photoElement.cloneNode(true);    
            //         stepPhotosCarouselInner.appendChild(clonedPhoto);
            //     }
            // });
            // --- FINE MODIFICA ---

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
