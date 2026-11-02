# Colletta Alimentare 2026

Sito per l’iscrizione interna dei volontari. Next.js e React, database SQLite sul server. Include il secondo passaggio per maggiorenni e minorenni e la gestione amministrativa delle iscrizioni.

## Avvio locale

Richiede Node.js 22.13 o successivo (consigliato 22.22).

```sh
cd colletta-2026
npm ci
npm run dev
```

Apri http://127.0.0.1:3000. Le iscrizioni sono salvate in `data/colletta.sqlite`, escluso da Git. Il server crea il database al primo salvataggio. Il database non è accessibile tramite il sito.

## Build e verifica

```sh
npm run typecheck
npm run build
npm start
```

`npm start` usa la porta `PORT`, oppure 3000. Il comando avvia esclusivamente il server: non pubblica il progetto.

## Render, quando richiesto

Nessuna pubblicazione automatica viene eseguita da questo progetto. `render.yaml` è una configurazione per un futuro Web Service Node; usa questa cartella come radice del repository. Se il repository contiene invece la cartella `colletta-2026`, imposta `Root Directory` su `colletta-2026` nel servizio e il percorso Blueprint su `colletta-2026/render.yaml`.

- Build: `npm ci && npm run build`
- Avvio: `npm start`
- Node: 22.22.0
- Variabile `DATABASE_PATH`: `/var/data/colletta.sqlite`
- Disco persistente: `/var/data`, 1 GB

La configurazione include un servizio Starter e un disco persistente, a pagamento. Il disco serve a conservare SQLite durante riavvii e nuovi deploy. Non usare il filesystem temporaneo di un servizio senza disco per le iscrizioni reali. Per più istanze occorre passare a un database condiviso.

Documentazione: https://render.com/docs/blueprint-spec e https://render.com/docs/disks.

## Dati e turni

Nome, cognome e telefono obbligatori; email facoltativa. Dodici fasce orarie da 08–09 fino a 19–20, per Despar di Corso Alba e Penny di Corso Venezia. Sono ammesse più ore anche in supermercati diversi, senza sovrapposizioni. La validazione è eseguita sia nel modulo sia nel server.

## Riferimento grafico

Palette verde `#395E14`, arancione `#F68B1F` e font Poppins / Work Sans ripresi da https://www.bancoalimentare.it/colletta-alimentare. Logo originale da https://www.bancoalimentare.it/themes/custom/ba/logo.svg. I font sono serviti localmente da `public/fonts`, con licenze OFL incluse. Il modulo è per l’organizzazione interna.

## Secondo passaggio e autorizzazioni

Nel modulo si indica se il volontario sarà minorenne il giorno della Colletta. Dopo il salvataggio:

- Il minorenne riceve un codice personale alfanumerico di 3 caratteri e il promemoria di farne uno screenshot. Può scaricare il modulo originale e caricare un PDF firmato con entrambe le pagine oppure due foto (una per pagina, JPG/PNG/WebP; massimo 10 MB per file).
- Il maggiorenne vede il link al portale Banco Alimentare e una guida con gli screenshot e il vademecum della cartella `SPIEGAZIONE`. L’invio sul portale esterno rimane personale: il sito interno non può verificarlo automaticamente.

Il pulsante **Carica autorizzazione** è presente in tutte le pagine. Porta a `/accesso`, dove il minore inserisce il codice e ritrova lo stato del proprio documento. Può sostituire un file già caricato.

I PDF e le foto vengono conservati in `autorizzazioni/` accanto al database, quindi sullo stesso disco persistente su Render. I documenti caricati non sono pubblici e vengono scaricati solo tramite una sessione autorizzata. Non sono conservati nella cartella `public`.

Le iscrizioni precedenti vengono mantenute e migrate automaticamente al primo accesso al database; in assenza della nuova indicazione risultano maggiorenni e sono correggibili dall’admin.

## Pannello amministratore

Da `/accesso`, il codice `ColSC26` apre `/admin`. Il confronto avviene sul server; il codice non è incluso nel JavaScript del browser. È possibile sovrascriverlo tramite la variabile d’ambiente `ADMIN_CODE`.

Il pannello consente di:

- Cercare e filtrare le iscrizioni (compresi minori e autorizzazioni mancanti).
- Modificare contatti, maggiore/minore età e fasce, senza sovrapposizioni.
- Recuperare il codice personale dei minori e scaricare i loro PDF o entrambe le foto per la verifica.
- Eliminare un’iscrizione con conferma, liberando i posti e rimuovendo l’eventuale PDF e le sessioni collegate.
- Impostare le capienze per i 24 turni. Campo vuoto: nessun limite; 0: turno chiuso. Non si può scendere sotto gli iscritti già presenti. Il salvataggio delle capienze è atomico.

I posti residui sono visibili nel modulo e aggiornati ogni 15 secondi. Le disponibilità sono ricontrollate nella transazione di salvataggio per impedire sovraprenotazioni. Le sessioni durano 8 ore e sono gestite con cookie HttpOnly; dopo 10 codici errati dalla stessa origine di rete l’accesso viene temporaneamente sospeso per 15 minuti. I codici dei minori eliminati non vengono riassegnati.

Se il volontario ha scelto turni in entrambi i supermercati, la guida indica di selezionarne uno solo sul portale ufficiale.

## Test di integrazione

Il test `scripts/test-integration.mjs` deve essere eseguito soltanto contro un server locale di prova con database separato:

```sh
# Terminale 1, dopo npm run build
DATABASE_PATH=/tmp/colletta-test/database.sqlite PORT=3001 HOST=127.0.0.1 npm start

# Terminale 2
TEST_BASE_URL=http://127.0.0.1:3001 node scripts/test-integration.mjs
```

Il test crea e rimuove dati fittizi e verifica accessi, capienze concorrenti, validazione, upload, modifica, eliminazione e limite tentativi. Usa una nuova cartella temporanea per ogni esecuzione.

## Copertura turni

La prima schermata del pannello admin mostra una tabella con i supermercati sulle colonne e gli orari sulle righe. Ogni cella indica iscritti/posti massimi: verde se pieno, arancione se non ci sono iscritti, bianco negli altri casi. Il simbolo ∞ indica capienza senza limite; i turni chiusi mostrano 0/0 e la dicitura “Chiuso”. I dati si aggiornano ogni 15 secondi senza sovrascrivere le capienze in modifica.

Dopo l’accesso il minore vede il saluto “Ciao [nome]!”. Per caricare l’autorizzazione sceglie “Un PDF” oppure “Due foto”, con un campo separato per ciascuna pagina. Il nuovo caricamento sostituisce l’intero invio precedente; i PDF già presenti restano disponibili.
