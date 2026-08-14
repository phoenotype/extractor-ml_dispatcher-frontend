FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG VITE_DISPATCHER_API_BASE=/api/dispatcher
ARG VITE_USE_DISPATCHER_MOCKS=false
ARG VITE_DEFAULT_ROLE=editor
ARG VITE_EXTRACTOR_ML_API_URL
ARG VITE_ENVIRONMENT_LABEL=Cloud Run
ENV VITE_DISPATCHER_API_BASE=$VITE_DISPATCHER_API_BASE \
    VITE_USE_DISPATCHER_MOCKS=$VITE_USE_DISPATCHER_MOCKS \
    VITE_DEFAULT_ROLE=$VITE_DEFAULT_ROLE \
    VITE_EXTRACTOR_ML_API_URL=$VITE_EXTRACTOR_ML_API_URL \
    VITE_ENVIRONMENT_LABEL=$VITE_ENVIRONMENT_LABEL
RUN test -n "$VITE_EXTRACTOR_ML_API_URL" || (echo "VITE_EXTRACTOR_ML_API_URL build-arg is required" && exit 1)
RUN npm run build

FROM node:22-alpine AS runtime

ENV NODE_ENV=production \
    PORT=8080 \
    STATIC_DIR=/app/dist \
    DISPATCHER_AUTH_MODE=google_id_token
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
COPY server ./server
USER node
EXPOSE 8080
CMD ["node", "server/bff.mjs"]
