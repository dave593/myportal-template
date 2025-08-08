#!/bin/bash

echo "🔍 Test de endpoints en Cloud Run"
echo "=================================="

# Obtener la URL del servicio de Cloud Run
SERVICE_URL="https://fire-escape-reports-l4cl4bb27q-uc.a.run.app"

echo "1. Probando endpoint /api/health..."
curl -s "$SERVICE_URL/api/health" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/health"

echo ""
echo "2. Probando endpoint /api/test-google-sheets..."
curl -s "$SERVICE_URL/api/test-google-sheets" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/test-google-sheets"

echo ""
echo "3. Probando endpoint /api/test-drive..."
curl -s -X POST "$SERVICE_URL/api/test-drive" | jq '.' 2>/dev/null || curl -s -X POST "$SERVICE_URL/api/test-drive"

echo ""
echo "4. Probando endpoint /api/system-status..."
curl -s "$SERVICE_URL/api/system-status" | jq '.' 2>/dev/null || curl -s "$SERVICE_URL/api/system-status"

echo ""
echo "✅ Test completado"
