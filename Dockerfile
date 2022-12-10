FROM node:lts as runner
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
EXPOSE 8080
CMD ["npm", "run", "production"]