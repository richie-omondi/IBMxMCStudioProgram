FROM node:18-slim

# Install postgresql-client for pg_isready in entrypoint
RUN apt-get update && apt-get install -y --no-install-recommends postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifest and install dependencies first (layer caching)
COPY fintech/package.json ./fintech/package.json
RUN cd fintech && npm install --omit=dev

# Copy application source
COPY fintech/ ./fintech/
COPY shared/ ./shared/

# Make entrypoint executable
RUN chmod +x /app/fintech/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/fintech/entrypoint.sh"]
