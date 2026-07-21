FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Hard reset any previous Next artifacts so TanStack/Nitro output is what gets served
RUN rm -rf .next dist .output .tanstack public/_next

ENV NITRO_PRESET=node-server
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

# Bind to Docker network interface
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

# Nitro/React-Start commonly respect these
ENV NITRO_HOST="0.0.0.0"
ENV NITRO_PORT=3000

# Copy ONLY TanStack/Nitro outputs (do not copy Next build artifacts)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000

# Use direct exec so the container doesn't restart due to shell wrapper issues
CMD ["node","/app/.output/server/index.mjs"]
