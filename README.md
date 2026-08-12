# Extractor ML Dispatcher — Frontend

SPA React + TypeScript (Vite) per configurare, validare e simulare i flussi del dispatcher.

## Autenticazione (obbligatoria)

Il Cloud Run dispatcher è **privato** e richiede:

```http
Authorization: Bearer <Google Cloud ID token>
```

con audience:

```text
https://extractor-ml-dispatcher-727480764999.europe-west1.run.app
```

### Flusso corretto

```text
Browser  --(Lucy session)-->  BFF  --(Google ID token)-->  Cloud Run dispatcher
```

1. Il **browser** invia solo header Lucy verso il BFF:
   - `X-Endpoint-API-UserInfo: <token-sessione-lucy>`
   - `X-Endpoint-API-OTP: <otp-se-previsto>` (opzionale)
2. Il **BFF** (`server/bff.mjs`):
   - valida la sessione Lucy su `EXTRACTOR_ML_API_URL/auth/me`
   - applica i ruoli `viewer` / `editor` / `operator`
   - genera un Google ID token (ADC, metadata server GCP, oppure `GOOGLE_ID_TOKEN` solo server)
   - chiama il dispatcher con `Authorization: Bearer <id-token>`
3. Il browser **non** genera, conserva o invia Google ID token / API key.

`X-API-Key` può esistere lato dispatcher come protezione opzionale, ma `DISPATCHER_API_KEYS` non è configurato e **non** va mai messo nel bundle Vite.

Se in produzione usi il backend **extractor-ml** come BFF, il browser continua a inviare gli stessi header Lucy; è quel backend a fare ID token + forward.

## Avvio locale

```bash
cp .env.example .env
npm install

# terminale 1 — BFF
export DISPATCHER_API_URL=https://extractor-ml-dispatcher-727480764999.europe-west1.run.app
export DISPATCHER_AUDIENCE="$DISPATCHER_API_URL"
export GOOGLE_ID_TOKEN="$(gcloud auth print-identity-token --audiences="$DISPATCHER_AUDIENCE")"
npm run dev:bff

# terminale 2 — SPA (proxy /api/dispatcher → BFF)
npm run dev
```

Mock senza backend:

```bash
VITE_USE_DISPATCHER_MOCKS=true npm run dev
```

## Variabili

| Variabile | Dove | Note |
| --- | --- | --- |
| `VITE_DISPATCHER_API_BASE` | Browser | Default `/api/dispatcher` (same-origin → BFF) |
| `VITE_EXTRACTOR_ML_API_URL` | Browser | Solo login Lucy `/auth/login` |
| `VITE_USE_DISPATCHER_MOCKS` | Browser | Mock espliciti |
| `DISPATCHER_API_URL` | BFF | Cloud Run dispatcher |
| `DISPATCHER_AUDIENCE` | BFF | Audience ID token (= URL dispatcher) |
| `EXTRACTOR_ML_API_URL` | BFF | Validazione sessione Lucy |
| `GOOGLE_ID_TOKEN` | **Solo BFF** | Fallback locale short-lived |
| `BFF_SKIP_LUCY_AUTH` | BFF | Solo sviluppo |

**Non esistono** variabili `VITE_*` per Google token o API key.

## Script

| Script | Descrizione |
| --- | --- |
| `npm run dev` | Vite SPA (proxy verso BFF) |
| `npm run dev:bff` | BFF Lucy + Google ID token |
| `npm run build` | Typecheck + build |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Deploy

1. Build SPA: `npm run build` → `dist/`
2. Esporre la SPA dietro hosting statico
3. Mettere il BFF (questo o extractor-ml core) davanti al Cloud Run privato
4. Il BFF usa la service identity per mintare ID token con audience del dispatcher
5. Nessuna credenziale cloud nel JavaScript del browser
