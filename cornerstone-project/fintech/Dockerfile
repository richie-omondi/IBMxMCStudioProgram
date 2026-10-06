FROM node:18-slim

# Install postgresql-client for pg_isready in entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install root-level dependencies first (pg, dotenv) so shared/ modules can resolve them
COPY package.json ./package.json
RUN npm install --omit=dev

# Install fintech-level dependencies (express, pg, dotenv)
COPY fintech/package.json ./fintech/package.json
RUN cd fintech && npm install --omit=dev

# Copy application source
COPY fintech/ ./fintech/
COPY shared/ ./shared/

# Make entrypoint executable
RUN chmod +x /app/fintech/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/fintech/entrypoint.sh"]
