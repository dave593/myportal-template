#!/bin/sh

# Create service account key file from environment variable
echo "🔑 Creating service account key file..."
echo "$GOOGLE_SERVICE_ACCOUNT_KEY" > /app/google-service-account-key.json

# Start Cloud SQL Auth Proxy in background
echo "🚀 Starting Cloud SQL Auth Proxy..."
/usr/local/bin/cloud-sql-proxy --instances=boston-fire-escapes:us-central1:irias-portal-db=tcp:3306 --credentials-file=/app/google-service-account-key.json &
PROXY_PID=$!

# Wait for proxy to be ready
echo "⏳ Waiting for Cloud SQL Auth Proxy to be ready..."
sleep 10

# Start the application
echo "🚀 Starting application..."
exec node server.js 