FROM node:lts-alpine AS builder
WORKDIR /search
ARG COMMIT_ID
ENV COMMIT_ID=${COMMIT_ID}
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
RUN cp -R src/suggestions/icons dist/suggestions/icons && cp -R src/chromium/icons dist/chromium/icons

FROM node:lts-alpine
WORKDIR /search
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY --from=builder /search/dist ./dist
COPY --from=builder /search/src/GeoLite2-City.mmdb ./src/GeoLite2-City.mmdb
EXPOSE 3006
CMD ["npm", "start"]
