# ── Dockerfile Frontend (React + Nginx) ─────────────────────────────

# Etapa 1: Build de React
FROM node:18-alpine AS build

WORKDIR /app

# Copiar node_modules ya instalados
COPY node_modules ./node_modules

# Copiar código fuente
COPY . .

# Build de producción con API URL relativa para Docker
ENV REACT_APP_API_URL=/api
ENV CI=false
ENV NODE_OPTIONS=--max-old-space-size=4096

RUN npm run build

# Etapa 2: Servir con Nginx
FROM nginx:alpine

COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]