FROM node:22-alpine AS build
WORKDIR /app

ARG VITE_MML_API_KEY
ENV VITE_MML_API_KEY=$VITE_MML_API_KEY

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
