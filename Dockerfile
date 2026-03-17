FROM oven/bun:1.2-alpine

WORKDIR /app

# Install dependencies in a separate layer for better caching
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile

COPY . .

# Create non-root user and writable directories
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p /app/data/artifacts \
    && chown -R app:app /app

USER app

ENV API_PORT=8080
ENV MCP_PORT=3000
ENV DATA_SOURCE=file
ENV FILE_DB_DIR=/app/data
ENV UPLOADS_DIR=/app/data/artifacts
ENV DB_PATH=/app/data/db.sqlite

EXPOSE 8080
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["bun", "start"]
