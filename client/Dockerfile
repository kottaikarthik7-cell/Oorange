# Two-stage build: compile the Vite bundle, then serve the static output with nginx.
# nginx proxies /api and /socket.io to the server container so we don't need
# CORS in production.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
# Pass-through of build-time env is supported if you want to bake the API URL
# in, but the default (blank VITE_API_URL) just uses the reverse proxy below.
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
