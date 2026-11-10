<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Conservazione dati e rilasci

- Conservare tutte le iscrizioni, i codici, le capienze e i documenti. Backup completo e verificato prima delle modifiche ai dati. Test solo su database temporanei.
- Non fare push su main né usare deploy hook senza verificare il protocollo di rilascio e la conservazione dei dati online.
- Per i rilasci dopo l’installazione iniziale protetta usare `node scripts/release.mjs`, con codice già committato e working tree pulito. Il comando congela le scritture, scarica un backup aggiornato, pubblica lo snapshot cifrato e riapre solo dopo il confronto positivo.
- La versione pubblica precedente non dispone ancora del blocco scritture. Non applicare a questo sito eccezioni di bootstrap autorizzate per altri progetti; non inferire il permesso di perdere dati dal comando “fai tu”.
- Per la prima installazione della Colletta l’utente ha successivamente confermato esplicitamente: “nessuno adesso scrive, modifica o carica, procedi pure”. È autorizzato il bootstrap 0.1.1 da un backup online fresco e verificato in questa finestra senza attività. Non estendere questa autorizzazione a rilasci futuri né alla perdita di dati. Configurare prima la chiave privata sul servizio senza avviare deploy; se la finestra termina, fermarsi e aggiornare il backup prima di pubblicare.
- Non committare backup in chiaro, documenti, database o chiavi. Sono ammessi solo `.deployment/restore.enc` cifrato e il manifest tecnico. Non riutilizzare snapshot vecchi per nuovi rilasci.
- Render Free non offre conservazione continua: un riavvio imprevisto può perdere le modifiche successive all’ultimo snapshot. Non promettere il contrario e non attivare servizi a pagamento senza autorizzazione.
