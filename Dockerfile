FROM oven/bun:alpine AS build
WORKDIR /app

ARG VITE_MML_API_KEY
ENV VITE_MML_API_KEY=$VITE_MML_API_KEY

COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

FROM oven/bun:alpine
WORKDIR /app

RUN apk add --no-cache nginx gdal-tools

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/http.d/default.conf

COPY server/ ./server/
COPY package.json bun.lock* ./
RUN bun install --production

COPY docker-entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
CMD ["/entrypoint.sh"]
