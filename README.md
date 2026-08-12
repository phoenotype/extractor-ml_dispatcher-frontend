# Extractor ML Dispatcher — Frontend

SPA React + TypeScript (Vite) per configurare, validare e simulare i flussi del dispatcher.

Editor visuale a nodi (React Flow), catalogo dinamico da `GET /catalog`, CRUD flussi, validazione, simulazione e esecuzione protetta. Stile allineato a Lucy / LC Data Extractor.

## Stack

- React 19 + TypeScript
- Vite
- React Flow (`@xyflow/react`)
- TanStack Query
- React Router
- Zod
- BFF Node (`server/bff.mjs`) per Cloud Run privato

## Struttura

```
src/
  components/       # UI e layout Lucy
  features/flows/   # lista, canvas, catalogo, conflitti
  features/simulation/
  services/api/     # client tipizzato + mock opt-in
  types/
  hooks/
  pages/
server/
  bff.mjs           # proxy autenticato verso il dispatcher
```

## Prerequisiti

- Node.js **>= 22**

## Configurazione

```bash
cp .env.example .env
```

| Variabile | Dove | Descrizione |
| --- | --- | --- |
| `VITE_DISPATCHER_API_BASE` | Client | Prefisso browser (default `/api/dispatcher`) |
| `VITE_DISPATCHER_API_URL` | Vite proxy | Target diretto se non usi il BFF |
| `VITE_USE_DISPATCHER_MOCKS` | Client | `true` = mock espliciti (nessun fallback silenzioso) |
| `VITE_DEFAULT_ROLE` | Client | `viewer` \| `editor` \| `operator` |
| `DISPATCHER_API_URL` | BFF / proxy | URL Cloud Run del dispatcher |
| `DISPATCHER_AUTH_HEADER` | **Solo BFF** | `Authorization` server-side (mai nel bundle) |
| `BFF_PORT` | BFF | Default `8787` |

## Avvio

```bash
npm install
npm run dev
```

Aprire `http://localhost:5173`. Vite fa proxy di `/api/dispatcher/*` verso `DISPATCHER_API_URL` / `VITE_DISPATCHER_API_URL`.

### BFF (Cloud Run privato)

```bash
# terminale 1
npm run dev

# terminale 2
DISPATCHER_API_URL=https://extractor-ml-dispatcher-727480764999.europe-west1.run.app \
DISPATCHER_AUTH_HEADER="Bearer $(gcloud auth print-identity-token)" \
npm run dev:bff
```

Poi punta il proxy Vite al BFF oppure imposta `VITE_DISPATCHER_API_BASE=http://localhost:8787/api/dispatcher`.

Il BFF:

- reverse proxy di `/api/dispatcher/*`
- inietta `DISPATCHER_AUTH_HEADER` solo lato server
- CORS verso Vite
- health su `/healthz`
- non logga token

### Mock

```bash
VITE_USE_DISPATCHER_MOCKS=true npm run dev
```

Badge evidente in UI. Nessun fallback automatico se il backend non risponde.

## Funzionalità

- Elenco flussi: ricerca, filtri stato/tipo, CRUD, duplica, export JSON, legacy sola lettura
- Editor React Flow: catalogo dinamico, proprietà da schema, undo/redo, JSON sync
- Validazione (locale preliminare + backend), evidenziazione errori
- Simulazione con trace visuale e mutazioni pianificate (`databaseWrites === 0` → “Nessuna scrittura sul database”)
- Esecuzione reale solo per `operator`, dopo salvataggio + validazione + simulazione recente + conferma digitando il nome flusso
- Conflitto `409`: ricarica / confronta / annulla (no overwrite automatico)
- Ruoli UX: `viewer`, `editor`, `operator` (autorizza sempre il backend)
- Tema chiaro/scuro

## Script

| Script | Descrizione |
| --- | --- |
| `npm run dev` | Vite SPA |
| `npm run dev:bff` | BFF Node |
| `npm run build` | Typecheck + build |
| `npm run preview` | Anteprima build |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Deploy

1. Build statica: `npm run build` → `dist/`
2. Esporre la SPA dietro CDN / hosting statico
3. Mettere il BFF (o gateway) davanti al Cloud Run privato
4. Il browser chiama solo `/api/dispatcher/*` same-origin
5. Il BFF inietta identity token / IAP verso Cloud Run
6. Nessuna API key o token permanente nel bundle `VITE_*`

## Contratto API

- `GET /catalog`
- `GET /flows?activeOnly=false` → `{ items: [...] }`
- `GET|POST /flows`, `PUT|DELETE /flows/{flowName}`
- `POST /flows/validate`, `POST /flows/{flowName}/validate`
- `POST /flows/{flowName}/simulations`
- `POST /flows/{flowName}/runs`

Aggiornamenti con `expectedUpdatedAt`. Formato `visual_v1` o `legacy`.

## Sicurezza

- Nessun SQL / JavaScript configurabile nell’UI
- Nessuna credenziale nei JSON di flusso
- Nessun token nei log del BFF
- Autenticazione Cloud Run solo sul BFF
