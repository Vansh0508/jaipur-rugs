# Exact copy of the Dockerfile that lives on the VPS at /docker/atlas/Dockerfile — kept
# here too so a local build produces a byte-for-byte-equivalent image. If you change one,
# change both (see deploy-atlas.bat's header comment and deploy/atlas/README.md).
#
# Builds just apps/atlas out of the jaipur-rugs pnpm/turbo monorepo.
# Multi-stage: install full workspace deps (needed for workspace:* packages), build atlas,
# then run it. Node 20 chosen here regardless of the host's own Node version — this
# container is fully self-contained and doesn't touch the host's Node/pm2 setup at all.
FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.12.0 --activate
WORKDIR /repo

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/atlas/package.json apps/atlas/package.json
COPY apps/admin/feedback-app/package.json apps/admin/feedback-app/package.json
COPY apps/admin/internal-portal/package.json apps/admin/internal-portal/package.json
COPY apps/hub/package.json apps/hub/package.json
COPY packages/auth/package.json packages/auth/package.json
COPY packages/charts/package.json packages/charts/package.json
COPY packages/config/package.json packages/config/package.json
COPY packages/db-management-client/package.json packages/db-management-client/package.json
COPY packages/supabase-client/package.json packages/supabase-client/package.json
COPY packages/ui-kit/package.json packages/ui-kit/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
COPY --from=deps /repo/node_modules ./node_modules
# Build-time public env vars (NEXT_PUBLIC_*) get baked into the JS bundle here.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ROOT_DOMAIN
ARG NEXT_PUBLIC_HUB_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_ROOT_DOMAIN=$NEXT_PUBLIC_ROOT_DOMAIN
ENV NEXT_PUBLIC_HUB_URL=$NEXT_PUBLIC_HUB_URL
# No turbo/filter chain needed: packages are transpiled from TS source directly by
# Next.js (see apps/atlas/next.config.js's transpilePackages comment) — they have no
# build step of their own.
WORKDIR /repo/apps/atlas
RUN pnpm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo ./
EXPOSE 3000
# next start defaults to port 3000 already (matches EXPOSE above), so no extra args needed.
CMD ["pnpm", "--filter", "@jaipur-rugs/atlas", "run", "start"]
