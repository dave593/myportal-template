#!/bin/bash

# Script de limpieza para el sistema
echo "🧹 Limpiando archivos temporales y logs..."

# Eliminar archivos de log
find . -name "*.log" -type f -delete
find . -name "*.tmp" -type f -delete
find . -name "*.bak" -type f -delete

# Limpiar carpeta uploads (mantener estructura)
find ./uploads -name "*" -type f -delete 2>/dev/null || true

# Limpiar carpeta logs (mantener estructura)
find ./logs -name "*" -type f -delete 2>/dev/null || true

# Eliminar archivos de configuración específicos del cliente actual
rm -f client-config.json
rm -f .env
rm -f deploy-*.sh
rm -f README-*.md

# Limpiar node_modules si existe (se reinstalará)
if [ -d "node_modules" ]; then
    echo "🗑️ Eliminando node_modules..."
    rm -rf node_modules
fi

# Limpiar archivos de package-lock si existe
rm -f package-lock.json

echo "✅ Limpieza completada"
echo "📋 Archivos eliminados:"
echo "   - Archivos de log temporales"
echo "   - Archivos de configuración específicos"
echo "   - node_modules (se reinstalará con npm install)"
echo ""
echo "🔧 Para reinstalar dependencias:"
echo "   npm install" 