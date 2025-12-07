# Use node:18-bullseye and create non-root user for security
FROM node:18-bullseye

# Create non-root user for security
RUN groupadd -r wealtharena && useradd -r -g wealtharena wealtharena

WORKDIR /app
RUN chown wealtharena:wealtharena /app

# Environment variables - should be overridden in production
# Default to development for local builds, but production deployments should set NODE_ENV=production
ENV NODE_ENV=development \
    CI=false

# Security note: In production, set NODE_ENV=production to disable debug features
# Example: docker run -e NODE_ENV=production ...

# Install expo-cli with --ignore-scripts for security
RUN npm install -g expo-cli@6.x --ignore-scripts

COPY package*.json ./
# Install dependencies with --ignore-scripts to prevent execution of arbitrary scripts
RUN npm install --ignore-scripts

COPY --chown=wealtharena:wealtharena . .

# Switch to non-root user
USER wealtharena

EXPOSE 19000 19001 19002 5001

CMD ["npx", "expo", "start", "--tunnel", "--host", "0.0.0.0"]


