FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package*.json ./
RUN npm ci --legacy-peer-deps

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 環境変数を直接設定
ENV NEXT_PUBLIC_SUPABASE_URL=https://wnlfvfykzxvmwxlczxfz.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndubGZ2Znlrenh2bXd4bGN6eGZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ0MTEzMzgsImV4cCI6MjA3OTk4NzMzOH0.gF86EF2P4WaMFlBiD0rKIj_0fcLKz2YDG2cxJdoU6Iw

RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
USER nextjs
EXPOSE 8080
ENV PORT 8080
ENV HOSTNAME "0.0.0.0"
CMD ["node", "server.js"]
