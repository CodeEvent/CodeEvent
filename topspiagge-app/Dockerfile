# Builds the Expo web export and serves it as a plain static SPA -- this is the web/PWA half of
# Top Spiagge. It does not build iOS/Android binaries; those still go through EAS/App Store/Play
# Store regardless of where this container runs.
#
# EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are read at BUILD time (Metro inlines
# them into the bundle), so they must be passed as --build-arg, not just container env vars at
# run time. Leave them unset to ship the fully-local/AsyncStorage fallback build.

FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .

ARG EXPO_PUBLIC_SUPABASE_URL
ARG EXPO_PUBLIC_SUPABASE_ANON_KEY
ENV EXPO_PUBLIC_SUPABASE_URL=${EXPO_PUBLIC_SUPABASE_URL}
ENV EXPO_PUBLIC_SUPABASE_ANON_KEY=${EXPO_PUBLIC_SUPABASE_ANON_KEY}
RUN npm run build:web

FROM node:20-slim AS run
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve-web.mjs ./scripts/serve-web.mjs
ENV PORT=8080
EXPOSE 8080
CMD ["node", "scripts/serve-web.mjs"]
