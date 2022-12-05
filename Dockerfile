FROM node:lts as runner
WORKDIR /search
ENV NODE_ENV production
ARG COMMIT_ID
ENV COMMIT_ID=${COMMIT_ID}
COPY package*.json ./
RUN npm install
COPY . .
RUN npm ci --only=production
EXPOSE 8080
CMD ["npm", "run", "production"]