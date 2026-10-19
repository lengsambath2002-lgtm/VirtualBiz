# VirtualBiz web (Next.js standalone). Build from frontend/:
#   docker build --build-arg API_URL=http://api:8180 -t vbiz-web frontend
# API_URL (where /api/* is proxied) and NEXT_PUBLIC_* values are fixed at build time.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
ARG API_URL=http://api:8180
ARG NEXT_PUBLIC_APP_ENV=prod
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV \
    NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID NEXT_TELEMETRY_DISABLED=1 \
    NEXT_OUTPUT=standalone
COPY --from=deps /app/node_modules node_modules
COPY . .
RUN pnpm build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN adduser -S -u 10001 web
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static .next/static
COPY --from=build /app/public public
USER web
EXPOSE 3000
CMD ["node", "server.js"]
