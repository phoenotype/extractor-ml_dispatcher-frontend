# Extractor ML Dispatcher — Frontend

Editor visuale React e TypeScript per configurare, validare e simulare i flussi del dispatcher.

## Configurazione

Creare `.env.local` a partire da `.env.example` e impostare `NEXT_PUBLIC_DISPATCHER_API_URL`.
Il frontend carica tipi di nodo, configurazioni, operatori, campi documento, stati e uscite da
`GET /catalog`. Con `NEXT_PUBLIC_ENABLE_MOCK_FALLBACK=true` usa un catalogo demo soltanto quando
il backend non è raggiungibile, mostrando chiaramente la modalità di sviluppo nell'interfaccia.

## Comandi

- `npm run dev` avvia l'ambiente locale.
- `npm run build` verifica e produce la build di distribuzione.
