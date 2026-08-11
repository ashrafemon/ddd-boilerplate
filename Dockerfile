# ---- Build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# postinstall would run `prisma generate` before the schema exists in the
# image, so skip scripts here and generate explicitly after copying sources.
RUN npm ci --ignore-scripts

COPY . .
RUN npx prisma generate
RUN npm run build

# ---- Runtime stage ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
# prisma is a devDependency and the client is copied from the build stage,
# so skip the postinstall script here too.
RUN npm ci --omit=dev --ignore-scripts

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/node_modules/tsconfig-paths ./node_modules/tsconfig-paths

EXPOSE 4000

CMD ["node", "-r", "tsconfig-paths/register", "dist/main.js"]