FROM node:lts-alpine as builder
WORKDIR /search
ENV NODE_ENV production
ARG COMMIT_ID
ENV COMMIT_ID=${COMMIT_ID}
COPY package*.json ./
RUN npm install
COPY . .
RUN npm ci
RUN npm i -g typescript
RUN npm run build:ts
COPY ./src/suggestions/icons /search/dist/suggestions/icons
FROM node:lts-alpine
WORKDIR /search
COPY --from=builder /search/dist /search/dist
COPY --from=builder /search/package.json /search/package.json
COPY --from=builder /search/src/GeoLite2-City.mmdb /search/src/GeoLite2-City.mmdb
RUN npm install --omit=dev
EXPOSE 8080
CMD ["npm", "run", "production"]
