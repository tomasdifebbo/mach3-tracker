FROM node:20-alpine

WORKDIR /app

# Install dependencies for server
COPY server/package*.json ./
RUN npm install --omit=dev

# Copy server application and built static files
COPY server/ ./

EXPOSE 8000

ENV PORT=8000
ENV NODE_ENV=production

CMD ["node", "server.js"]
