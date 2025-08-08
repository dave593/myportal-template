#!/bin/bash

echo "🗄️ Creando tablas en Cloud SQL"
echo "=============================="

# Obtener credenciales de Secret Manager
DB_HOST=$(gcloud secrets versions access latest --secret="mysql-db-host" | tr -d '\n')
DB_USER=$(gcloud secrets versions access latest --secret="mysql-db-user" | tr -d '\n')
DB_PASSWORD=$(gcloud secrets versions access latest --secret="mysql-db-password" | tr -d '\n')
DB_NAME=$(gcloud secrets versions access latest --secret="mysql-db-name" | tr -d '\n')

echo "📋 Configuración de la base de datos:"
echo "Host: $DB_HOST"
echo "Usuario: $DB_USER"
echo "Base de datos: $DB_NAME"
echo ""

# Crear archivo SQL temporal
cat > temp_create_tables.sql << 'EOF'
-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    client_id VARCHAR(20) UNIQUE NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    service_type VARCHAR(100) NOT NULL,
    urgency_level VARCHAR(50) DEFAULT 'Medium',
    client_full_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone_number VARCHAR(20),
    customer_type ENUM('Residential', 'Commercial', 'Industrial') DEFAULT 'Residential',
    project_address TEXT NOT NULL,
    technical_description TEXT,
    budget_range VARCHAR(50),
    expected_timeline VARCHAR(50),
    preferred_contact_method ENUM('Phone', 'Email', 'Text') DEFAULT 'Phone',
    additional_notes TEXT,
    special_requirements TEXT,
    status ENUM('New Lead', 'Contacted', 'Quoted', 'Pending Inspection', 'In Progress', 'Completed', 'Cancelled') DEFAULT 'New Lead',
    form_emailer_status ENUM('Pending', 'Sent', 'Failed') DEFAULT 'Pending',
    invoice_status ENUM('Pending', 'Sent', 'Paid') DEFAULT 'Pending',
    estimate_status ENUM('Pending', 'Sent', 'Accepted', 'Rejected') DEFAULT 'Pending',
    channel ENUM('Website', 'Phone', 'Referral', 'Walk-in') DEFAULT 'Website',
    responsable VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_client_id (client_id),
    INDEX idx_status (status),
    INDEX idx_company (company_name),
    INDEX idx_created_at (created_at),
    INDEX idx_email (email)
);

-- Tabla de configuración del sistema
CREATE TABLE IF NOT EXISTS system_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(100) UNIQUE NOT NULL,
    config_value TEXT,
    config_type ENUM('string', 'json', 'boolean', 'number') DEFAULT 'string',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_config_key (config_key)
);

-- Tabla de log de auditoría
CREATE TABLE IF NOT EXISTS audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    action VARCHAR(50) NOT NULL,
    table_name VARCHAR(50) NOT NULL,
    record_id INT,
    old_values JSON,
    new_values JSON,
    user_email VARCHAR(255),
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_action (action),
    INDEX idx_table_name (table_name),
    INDEX idx_record_id (record_id),
    INDEX idx_created_at (created_at)
);

-- Tabla de reportes
CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    report_id VARCHAR(50) UNIQUE NOT NULL,
    client_id VARCHAR(20) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    inspection_date DATE,
    findings TEXT,
    recommendations TEXT,
    photos JSON,
    inspector VARCHAR(100),
    next_inspection_date DATE,
    status ENUM('Draft', 'Completed', 'Sent', 'Archived') DEFAULT 'Draft',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_report_id (report_id),
    INDEX idx_client_id (client_id),
    INDEX idx_inspection_date (inspection_date),
    INDEX idx_status (status)
);

-- Insertar configuración inicial del sistema
INSERT IGNORE INTO system_config (config_key, config_value, config_type, description) VALUES
('email_notifications_enabled', 'true', 'boolean', 'Enable/disable email notifications'),
('zoho_integration_enabled', 'true', 'boolean', 'Enable/disable Zoho integration'),
('google_drive_enabled', 'true', 'boolean', 'Enable/disable Google Drive integration'),
('default_company', 'Boston Fire Escapes', 'string', 'Default company name'),
('session_timeout', '1440', 'number', 'Session timeout in minutes'),
('max_login_attempts', '5', 'number', 'Maximum login attempts before lockout');

-- Mostrar las tablas creadas
SHOW TABLES;
SELECT 'Database setup completed successfully!' as status;
EOF

echo "📝 Ejecutando script SQL..."

# Ejecutar el script usando mysql client
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
mysql -h "$DB_HOST" -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < temp_create_tables.sql

if [ $? -eq 0 ]; then
    echo "✅ Tablas creadas exitosamente"
else
    echo "❌ Error al crear las tablas"
    rm -f temp_create_tables.sql
    exit 1
fi

# Limpiar archivo temporal
rm -f temp_create_tables.sql

echo ""
echo "🗄️ Configuración de Base de Datos Completada"
echo "============================================="
echo "✅ Host: $DB_HOST"
echo "✅ Usuario: $DB_USER"
echo "✅ Base de datos: $DB_NAME"
echo "✅ Tablas creadas: clients, system_config, audit_log, reports"
echo ""
echo "🧪 Para probar la conexión:"
echo "curl https://fire-escape-reports-l4cl4bb27q-uc.a.run.app/api/test-database" 