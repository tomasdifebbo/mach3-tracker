FROM node:20-bullseye-slim

# Install python and build tools needed for better-sqlite3 native compilation
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
