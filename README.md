# Extractor ML Dispatcher — Frontend

SPA React + TypeScript (Vite) per configurare, validare e simulare i flussi del dispatcher.

## Autenticazione

```text
Browser  --(Lucy session)-->  BFF  --(upstream auth adapter)-->  Dispatcher API
```

1. Il **browser** invia solo header Lucy verso il BFF:
   - `X-Endpoint-API-UserInfo: <token-sessione-lucy>`
   - `X-Endpoint-API-OTP: <otp-se-previsto>` (opzionale)
2. Il **BFF** (`server/bff.mjs`):
   - valida la sessione Lucy su `EXTRACTOR_ML_API_URL/auth/me`
   - applica i ruoli `viewer` / `editor` / `operator`
   - autentica verso l’upstream secondo `DISPATCHER_AUTH_MODE`
3. Il browser **non** genera, conserva o invia Google ID token / API key / URL Cloud Run hardcoded.

### `DISPATCHER_AUTH_MODE`

| Mode | Uso |
| --- | --- |
| `google_id_token` (default) | Cloud Run IAM (ADC / metadata / `GOOGLE_ID_TOKEN`) |
| `bearer` | Token server-only `DISPATCHER_BEARER_TOKEN` |
| `none` | Nessun header `Authorization` (rete già isolata) |

## Avvio locale

```bash
cp .env.example .env
# Compila DISPATCHER_API_URL, EXTRACTOR_ML_API_URL, VITE_EXTRACTOR_ML_API_URL, DISPATCHER_AUDIENCE
npm install

# terminale 1 — BFF
export DISPATCHER_AUTH_MODE=google_id_token
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
| `VITE_DISPATCHER_API_BASE` | Browser | Default `/api/dispatcher` |
| `VITE_EXTRACTOR_ML_API_URL` | Browser | **Obbligatoria** per login Lucy |
| `VITE_USE_DISPATCHER_MOCKS` | Browser | Mock espliciti |
| `DISPATCHER_API_URL` | BFF | **Obbligatoria** |
| `DISPATCHER_AUDIENCE` | BFF | Audience ID token (default = API URL) |
| `EXTRACTOR_ML_API_URL` | BFF | **Obbligatoria** salvo `BFF_SKIP_LUCY_AUTH` |
| `DISPATCHER_AUTH_MODE` | BFF | `google_id_token` \| `bearer` \| `none` |
| `DISPATCHER_BEARER_TOKEN` | BFF | Solo mode `bearer` |
| `GOOGLE_ID_TOKEN` | BFF | Fallback locale short-lived |
| `STATIC_DIR` | BFF | Default `dist` (SPA statica) |
| `PORT` / `BFF_PORT` | BFF | Default `8787` (container: `8080`) |

**Non esistono** variabili `VITE_*` per Google token o API key.

## Script

| Script | Descrizione |
| --- | --- |
| `npm run dev` | Vite SPA (proxy verso BFF) |
| `npm run dev:bff` | BFF + static (se `dist/` presente) |
| `npm run build` | Typecheck + build |
| `npm test` | Vitest |
| `npm run lint` | ESLint |

## Deploy (container portabile)

```bash
docker build \
  --build-arg VITE_EXTRACTOR_ML_API_URL=https://your-lucy-api \
  -t extractor-ml-dispatcher-frontend .

docker run --rm -p 8080:8080 \
  -e DISPATCHER_API_URL=https://your-dispatcher \
  -e DISPATCHER_AUDIENCE=https://your-dispatcher \
  -e EXTRACTOR_ML_API_URL=https://your-lucy-api \
  -e DISPATCHER_AUTH_MODE=google_id_token \
  extractor-ml-dispatcher-frontend
```

Il BFF serve `dist/` e fa da proxy `/api/dispatcher`. Su GCP può usare la service identity; altrove puoi passare a `bearer` / `none` senza toccare la SPA.
