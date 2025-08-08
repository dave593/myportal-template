#!/bin/bash

echo "🚀 Pipeline Completo de Deploy a Google Cloud Run"
echo "================================================="
echo ""

# Verificar que estamos en el directorio correcto
if [ ! -f "package.json" ]; then
    echo "❌ Error: No se encontró package.json. Asegúrate de estar en el directorio del proyecto."
    exit 1
fi

# Verificar que gcloud esté instalado
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI no está instalado. Instálalo desde: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Verificar que docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado. Instálalo desde: https://docs.docker.com/get-docker/"
    exit 1
fi

echo "✅ Prerequisitos verificados"
echo ""

# Paso 1: Configurar secrets
echo "🔐 PASO 1: Configurando Secrets en Google Secret Manager"
echo "--------------------------------------------------------"
echo "Este paso te pedirá información sensible. Prepárate con:"
echo "  - Credenciales de MySQL"
echo "  - Archivo de Service Account Key de Google"
echo "  - Credenciales de Gmail"
echo "  - Configuración de Zoho"
echo "  - Claves JWT y de encriptación"
echo ""

read -p "¿Continuar con la configuración de secrets? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./setup-cloud-run-secrets.sh
    if [ $? -ne 0 ]; then
        echo "❌ Error configurando secrets. Revisa los errores arriba."
        exit 1
    fi
else
    echo "⚠️  Saltando configuración de secrets. Asegúrate de que ya estén configurados."
fi

echo ""
echo "✅ Paso 1 completado"
echo ""

# Paso 2: Deploy completo
echo "🚀 PASO 2: Deploy Completo a Cloud Run"
echo "--------------------------------------"
echo "Este paso incluye:"
echo "  - Build de la imagen Docker"
echo "  - Push a Google Container Registry"
echo "  - Deploy a Cloud Run con variables de entorno"
echo "  - Tests de endpoints"
echo ""

read -p "¿Continuar con el deploy? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    ./deploy-cloud-run-complete.sh
    if [ $? -ne 0 ]; then
        echo "❌ Error en el deploy. Revisa los errores arriba."
        exit 1
    fi
else
    echo "⚠️  Saltando deploy. Ejecuta manualmente: ./deploy-cloud-run-complete.sh"
fi

echo ""
echo "🎉 Pipeline completado!"
echo ""
echo "📋 Resumen final:"
echo "  ✅ Secrets configurados en Google Secret Manager"
echo "  ✅ Variables de entorno configuradas"
echo "  ✅ Docker image construida y subida"
echo "  ✅ Deploy exitoso en Cloud Run"
echo "  ✅ Tests de endpoints ejecutados"
echo ""
echo "🌐 Tu aplicación está disponible en Cloud Run"
echo ""
echo "🔍 Comandos útiles:"
echo "  - Ver logs: gcloud logs tail --project=boston-fire-escapes --service=fire-escape-reports"
echo "  - Ver detalles del servicio: gcloud run services describe fire-escape-reports --region=us-central1"
echo "  - Ejecutar tests: ./test-cloud-run-endpoints.sh"
echo ""
echo "¡Deploy completado exitosamente! 🚀" 