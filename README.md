# PORTFOLIO STAGE

Il sito resta statico: `index.html` e le pagine progetto funzionano anche senza
un server applicativo. Copertine e gallerie puntano agli stessi file originali
dentro la cartella `images` di ogni progetto. Non vengono create copie delle immagini.

## Aggiornare le immagini

1. Aggiungi, rimuovi o rinomina le immagini nella cartella `images` del progetto.
2. Da questa cartella esegui `python scripts/sync_projects.py`, oppure in VS Code
   scegli **Terminale → Esegui attività → Portfolio: aggiorna immagini**.
3. Ricarica la pagina del sito.

Per aggiornare automaticamente durante il lavoro, esegui
`python scripts/sync_projects.py --watch`, oppure l'attività
**Portfolio: aggiorna immagini automaticamente**. Lasciala attiva mentre lavori;
per fermarla usa Ctrl+C o termina l'attività in VS Code.

L'ordine è quello naturale dei nomi: `01.png`, `02.png`, … `10.png`, oppure
`Tavola disegno 1@2x.png`, `Tavola disegno 2@2x.png`, … `Tavola disegno 48@2x.png`.
La prima immagine è sempre la copertina. Ogni immagine della galleria apre
l'originale in una nuova scheda. Sono supportati PNG, JPG, JPEG, WebP, AVIF, GIF e SVG.

Il browser di un sito statico non può elencare autonomamente le cartelle locali:
lo script aggiorna l'HTML prima della visualizzazione o della pubblicazione.
Su un hosting statico carica anche gli HTML aggiornati e le immagini aggiunte.
`python scripts/sync_projects.py --check` verifica se gli HTML sono aggiornati
senza modificarli.

## Progetti presenti

| Progetto | Pagina reale | Immagini | Copertina |
| --- | --- | --- | --- |
| MAGMA | `1-project-magma/magma.html` | 14 | `1-project-magma/images/01.png` |
| ÜBERALL | `2-project-uberall/uberall.html` | 48 | `2-project-uberall/images/Tavola disegno 1@2x.png` |
| HORA | `3-project-hora/hora.html` | 11 | `3-project-hora/images/tavola1 - copertina.png` |
| IL MIO VOLTO | `4-project-il-mio-volto/il-mio-volto.html` | 4 | `4-project-il-mio-volto/images/01volto.png` |
| CUCINA MEDITERRANEA | `5-project-cucina-mediterranea/cucina-mediterranea.html` | 5 | `5-project-cucina-mediterranea/images/01cucina.jpeg` |
| TOUCHDESIGN | `6-project-touchdesign/touchdesign.html` | 1 copertina, 2 video | `6-project-touchdesign/images/01copertina.png` |

La homepage mostra i sei progetti effettivamente presenti, numerati da
01 a 06. Le vecchie card senza cartella progetto sono state rimosse.

TOUCHDESIGN usa la prima immagine esclusivamente nella card della Home.
Lo stesso `scripts/sync_projects.py` ordina i video MP4/WebM della sua cartella
`images` e genera la galleria interna senza immagini. I nomi reali dei file
sono `01copertina.png`, `02touch.mp4` e `03touch.mp4`, senza spazi.
`js/project-videos.js` aggiunge il pulsante Play; i controlli HTML nativi
restano disponibili anche senza JavaScript. Nessun autoplay e `preload="none"`.
Per questi MP4 di grandi dimensioni il server deve supportare le richieste
HTTP Range per riproduzione e ricerca efficienti. Gli originali non vengono
convertiti o duplicati.

La sezione About comprende formazione, competenze, interessi professionali
e lingue. Nei contatti, email personale ed email studente hanno collegamenti
`mailto:` distinti; il recapito con etichetta `CELL.` utilizza `tel:`.

Il vecchio file `assets/images/magma.png` era inutilizzato e identico a
`1-project-magma/images/13.png`: è stato eliminato. Non servono più cartelle
`assets` vuote; tutte le immagini sono nelle rispettive cartelle progetto.

## Aggiungere un progetto

Lo script cerca le cartelle nella radice del sito contenenti `images` e una sola
pagina `.html`. Usa i nomi effettivamente trovati, senza costruire percorsi presunti.

- Crea la cartella progetto e la sua sottocartella `images`, con le immagini.
- Aggiungi una pagina HTML vuota nella cartella progetto. Per collegarla a una
  card esistente, il nome del file senza `.html` deve coincidere con il suo
  attributo `data-project` in `index.html`.
- Esegui lo script: crea la galleria nella pagina vuota, collega copertina e
  titolo e aggiorna la card. Se la card non esiste, ne aggiunge una con le stesse
  classi e la stessa struttura delle altre. Puoi modificarne titolo e descrizione
  direttamente in `index.html`; lo script li mantiene.

Per una pagina già personalizzata, inserisci una sola coppia di marcatori
`<!-- project-images:start -->` e `<!-- project-images:end -->` nel contenitore
della galleria. Lo script modifica soltanto ciò che si trova fra i marcatori.
Non sostituisce automaticamente una pagina personalizzata priva di marcatori.

Gli stili delle gallerie in `css/project.css` riprendono i valori della pagina
MAGMA originale; le regole dei video sono isolate. `js/script.js` mantiene
navigazione e animazioni delle card.

## Hero WebGL

`js/liquid-scene.js` genera stanza, porta, superficie opaca del liquido,
riflessi del soffitto, filamenti e gocce direttamente con Three.js.
Le proporzioni seguono il brief scritto; la camera resta fissa e la sequenza
si assesta a 12,5 secondi, poi continua con increspature lente.
Uscendo completamente dal viewport il rendering si ferma e il tempo torna
a zero. Rientrando, anche dopo navigazione, la sequenza riparte dal bianco.
I cerchi sono contorni CSS fissi, visibili dal primo istante.
Con `prefers-reduced-motion: reduce` viene mostrato lo stato finale statico.
Non sono utilizzati video, frame o immagini prerenderizzate nella hero.
Per i moduli Three.js aprire il sito tramite un server locale, ad esempio
Live Server di VS Code, o un hosting HTTP/HTTPS. Three.js usa l'importmap
esistente; General Sans continua a essere caricato da Fontshare.
