FROM node:24-slim AS build
WORKDIR /app
# git: mushpoint-design is a git dependency.
RUN apt-get update && apt-get install -y --no-install-recommends git ca-certificates \
    && rm -rf /var/lib/apt/lists/*
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build
# Send the same policy SvelteKit put in the <meta> tag (with this build's script
# hash) as a header too, plus frame-ancestors, which <meta> cannot carry.
RUN CSP=$(grep -o 'http-equiv="content-security-policy" content="[^"]*"' build/index.html \
      | sed 's/.*content="//; s/"$//') \
    && test -n "$CSP" \
    && echo "add_header Content-Security-Policy \"$CSP; frame-ancestors 'none'\" always;" > /app/csp.conf

# Unprivileged variant: runs as a non-root user and listens on 8080.
FROM nginxinc/nginx-unprivileged:1.30-alpine
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/csp.conf /etc/nginx/snippets/csp.conf
COPY --from=build /app/build /usr/share/nginx/html
# config.json is per environment: mount it at /usr/share/nginx/html/config.json
# (a ConfigMap in Kubernetes). The image ships without one.
RUN rm -f /usr/share/nginx/html/config.json
EXPOSE 8080
