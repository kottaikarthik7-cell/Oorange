FROM node:20-alpine

# better-sqlite3 needs build tools for its native binding
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY . .

# Persist SQLite file and uploads in a mounted volume
RUN mkdir -p /app/data/uploads
VOLUME ["/app/data"]

ENV PORT=4000
EXPOSE 4000

CMD ["node", "src/index.js"]
