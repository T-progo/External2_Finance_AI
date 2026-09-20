-- ============================================
-- EXTERNALIZA2 - DATABASE SCHEMA
-- ============================================
-- Clean, organized database schema
-- All functions preserved exactly as they are
-- ============================================

-- ============================================
-- 1. EXTENSIONS
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. CUSTOM TYPES (ENUMS)
-- ============================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'asesor', 'cliente');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_estado AS ENUM ('activo', 'inactivo');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_status AS ENUM ('pendiente', 'procesado_ia', 'validado', 'contabilizado', 'incidencia', 'rechazado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE document_type AS ENUM ('otro', 'emitida_pdf', 'recibida_pdf', 'emitida_excel', 'recibida_excel');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM ('nueva', 'en_revision', 'resuelta', 'cerrada');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE incident_origin AS ENUM ('ia', 'manual', 'asesor');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE riesgo_type AS ENUM ('bajo', 'medio', 'alto');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_cliente') THEN
        CREATE TYPE tipo_cliente AS ENUM ('personal', 'empresa');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tipo_documento_financiero') THEN
        CREATE TYPE tipo_documento_financiero AS ENUM (
            'pyg',
            'balance',
            'mayor',
            'extracto_bancario',
            'excel_personalizado',
            'nominas',
            'prestamos',
            'otro_financiero'
        );
    END IF;
END $$;

-- ============================================
-- 3. TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol user_role NOT NULL DEFAULT 'cliente',
    estado user_estado NOT NULL DEFAULT 'activo',
    telefono TEXT,
    ultimo_acceso TIMESTAMP WITH TIME ZONE,
    fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    notas_internas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    nif TEXT UNIQUE NOT NULL,
    razon_social TEXT NOT NULL,
    nombre_comercial TEXT,
    persona_contacto TEXT NOT NULL,
    telefono TEXT NOT NULL,
    email TEXT NOT NULL,
    direccion_fiscal TEXT NOT NULL,
    estado user_estado NOT NULL DEFAULT 'activo',
    fecha_alta TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modulo_subida_documentos BOOLEAN DEFAULT true,
    modulo_incidencias BOOLEAN DEFAULT true,
    modulo_asistente_e2 BOOLEAN DEFAULT false,
    modulo_panel_financiero BOOLEAN DEFAULT false,
    modulo_facturacion BOOLEAN DEFAULT false,
    tipo_cliente tipo_cliente DEFAULT 'empresa',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT clientes_user_id_unique UNIQUE (user_id)
);

CREATE TABLE IF NOT EXISTS asesor_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asesor_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    fecha_asignacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(asesor_id, cliente_id)
);

CREATE TABLE IF NOT EXISTS documentos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    tipo document_type NOT NULL,
    estado document_status NOT NULL DEFAULT 'pendiente',
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    procesado_ia BOOLEAN DEFAULT false,
    tamanio BIGINT,
    url_archivo TEXT NOT NULL,
    nro_asiento_erp TEXT,
    datos_ia JSONB,
    fecha_validacion TIMESTAMP WITH TIME ZONE,
    validado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    fecha_contabilizacion TIMESTAMP WITH TIME ZONE,
    incluido_en_libro UUID,
    bloqueado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incidencias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID REFERENCES documentos(id) ON DELETE CASCADE,
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    estado incident_status NOT NULL DEFAULT 'nueva',
    origen incident_origin NOT NULL,
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_ultima_respuesta TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes_incidencia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incidencia_id UUID REFERENCES incidencias(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    mensaje TEXT NOT NULL,
    archivos_adjuntos JSONB DEFAULT '[]'::jsonb,
    es_ia BOOLEAN DEFAULT false,
    rol VARCHAR(20) DEFAULT 'cliente',
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS datos_financieros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    ingresos DECIMAL(15,2) NOT NULL DEFAULT 0,
    gastos DECIMAL(15,2) NOT NULL DEFAULT 0,
    resultado DECIMAL(15,2) NOT NULL DEFAULT 0,
    margen DECIMAL(5,2),
    riesgo_ia riesgo_type,
    ultimo_cierre TIMESTAMP WITH TIME ZONE,
    modelo_financiero_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, periodo)
);

CREATE TABLE IF NOT EXISTS actividad_reciente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tipo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    usuario_nombre TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enlace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS documentos_financieros (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    tipo tipo_documento_financiero NOT NULL,
    periodo TEXT NOT NULL,
    ejercicio_fiscal TEXT,
    fecha_subida TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    url_archivo TEXT NOT NULL,
    tamanio BIGINT,
    procesado_ia BOOLEAN DEFAULT false,
    datos_extraidos JSONB,
    analisis_ia JSONB,
    notas TEXT,
    estado TEXT DEFAULT 'pendiente',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consultas_financieras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    documentos_referenciados UUID[],
    fuentes_oficiales TEXT[],
    calificacion_usuario INTEGER,
    fue_util BOOLEAN,
    requirio_escalacion BOOLEAN DEFAULT false,
    incidencia_creada UUID REFERENCES incidencias(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS erp_asientos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    documento_id UUID REFERENCES documentos(id) ON DELETE SET NULL,
    nro_asiento TEXT NOT NULL,
    fecha_asiento DATE NOT NULL,
    descripcion TEXT,
    fecha_importacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archivo_erp_origen TEXT,
    metodo_match TEXT,
    confianza_match DECIMAL(5,2),
    apuntes JSONB,
    total_debe DECIMAL(15,2),
    total_haber DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS libro_registro (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    ejercicio_fiscal TEXT NOT NULL,
    tipo_libro TEXT NOT NULL,
    fecha_generacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    generado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
    url_archivo_excel TEXT,
    total_facturas INTEGER,
    total_base_imponible DECIMAL(15,2),
    total_iva DECIMAL(15,2),
    total_importe DECIMAL(15,2),
    documentos_incluidos UUID[],
    estado TEXT DEFAULT 'generado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, periodo, tipo_libro)
);

CREATE TABLE IF NOT EXISTS verificaciones_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    documento_id UUID REFERENCES documentos(id) ON DELETE CASCADE,
    asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    fecha_procesamiento TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    modelo_ia TEXT,
    confianza_global DECIMAL(5,2),
    confianzas_campos JSONB,
    accion TEXT,
    fecha_accion TIMESTAMP WITH TIME ZONE,
    comentarios_asesor TEXT,
    campos_corregidos JSONB,
    usado_entrenamiento BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS metricas_ia (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    periodo TEXT NOT NULL,
    documentos_procesados INTEGER DEFAULT 0,
    documentos_validados INTEGER DEFAULT 0,
    documentos_rechazados INTEGER DEFAULT 0,
    precision_promedio DECIMAL(5,2),
    precision_por_tipo JSONB,
    alta_confianza INTEGER DEFAULT 0,
    media_confianza INTEGER DEFAULT 0,
    baja_confianza INTEGER DEFAULT 0,
    errores_totales INTEGER DEFAULT 0,
    errores_por_tipo JSONB,
    tiempo_procesamiento_promedio INTEGER,
    mejora_vs_periodo_anterior DECIMAL(5,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(fecha, periodo)
);

CREATE TABLE IF NOT EXISTS modelos_financieros_cliente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    periodo TEXT NOT NULL,
    ejercicio_fiscal TEXT NOT NULL,
    documentos_fuente UUID[],
    fecha_calculo TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ingresos_operacionales DECIMAL(15,2),
    gastos_operacionales DECIMAL(15,2),
    resultado_operacional DECIMAL(15,2),
    gastos_financieros DECIMAL(15,2),
    ingresos_extraordinarios DECIMAL(15,2),
    gastos_extraordinarios DECIMAL(15,2),
    resultado_antes_impuestos DECIMAL(15,2),
    impuestos DECIMAL(15,2),
    resultado_neto DECIMAL(15,2),
    activo_corriente DECIMAL(15,2),
    activo_no_corriente DECIMAL(15,2),
    total_activo DECIMAL(15,2),
    pasivo_corriente DECIMAL(15,2),
    pasivo_no_corriente DECIMAL(15,2),
    patrimonio_neto DECIMAL(15,2),
    total_pasivo_patrimonio DECIMAL(15,2),
    ratio_liquidez DECIMAL(10,4),
    ratio_solvencia DECIMAL(10,4),
    ratio_endeudamiento DECIMAL(10,4),
    margen_bruto DECIMAL(10,4),
    margen_operacional DECIMAL(10,4),
    margen_neto DECIMAL(10,4),
    roi DECIMAL(10,4),
    roe DECIMAL(10,4),
    flujo_efectivo_operaciones DECIMAL(15,2),
    flujo_efectivo_inversion DECIMAL(15,2),
    flujo_efectivo_financiacion DECIMAL(15,2),
    flujo_efectivo_neto DECIMAL(15,2),
    gastos_por_categoria JSONB,
    ingresos_por_linea JSONB,
    proveedores_principales JSONB,
    clientes_principales JSONB,
    alertas_financieras JSONB,
    recomendaciones_ia JSONB,
    comentario_ia TEXT,
    nivel_riesgo TEXT,
    factores_riesgo JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cliente_id, periodo)
);

CREATE TABLE IF NOT EXISTS auditoria_financiera (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    usuario_nombre TEXT NOT NULL,
    usuario_rol TEXT NOT NULL,
    accion TEXT NOT NULL,
    entidad_tipo TEXT NOT NULL,
    entidad_id UUID NOT NULL,
    descripcion TEXT NOT NULL,
    datos_anteriores JSONB,
    datos_nuevos JSONB,
    cliente_id UUID REFERENCES clientes(id) ON DELETE SET NULL,
    direccion_ip INET,
    user_agent TEXT,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS preferencias_notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    notif_documentos_nuevos BOOLEAN DEFAULT true,
    notif_documentos_procesados BOOLEAN DEFAULT true,
    notif_incidencias_nuevas BOOLEAN DEFAULT true,
    notif_incidencias_resueltas BOOLEAN DEFAULT true,
    notif_libro_registro_generado BOOLEAN DEFAULT true,
    notif_alertas_financieras BOOLEAN DEFAULT true,
    notif_resumen_diario BOOLEAN DEFAULT false,
    notif_resumen_semanal BOOLEAN DEFAULT true,
    notif_inapp_enabled BOOLEAN DEFAULT true,
    umbral_alerta_gastos DECIMAL(15,2),
    umbral_alerta_ingresos DECIMAL(15,2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(usuario_id)
);

CREATE TABLE IF NOT EXISTS historial_notificaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL,
    categoria TEXT NOT NULL,
    titulo TEXT NOT NULL,
    mensaje TEXT NOT NULL,
    enviado BOOLEAN DEFAULT false,
    fecha_envio TIMESTAMP WITH TIME ZONE,
    leido BOOLEAN DEFAULT false,
    fecha_lectura TIMESTAMP WITH TIME ZONE,
    enlace TEXT,
    datos_adicionales JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS conversaciones_asistente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL DEFAULT 'Nueva consulta',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    derivado_a_asesor BOOLEAN DEFAULT false,
    asesor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes_asistente (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID REFERENCES conversaciones_asistente(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('usuario', 'asistente')),
    contenido TEXT NOT NULL,
    metadatos JSONB,
    es_derivacion BOOLEAN DEFAULT false,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS base_conocimiento_e2 (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    categoria TEXT NOT NULL,
    subcategoria TEXT,
    pregunta TEXT NOT NULL,
    respuesta TEXT NOT NULL,
    palabras_clave TEXT[],
    fuente_oficial TEXT,
    vigencia_desde DATE,
    vigencia_hasta DATE,
    prioridad INTEGER DEFAULT 0,
    num_usos INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS calendario_fiscal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    modelo TEXT NOT NULL,
    descripcion TEXT NOT NULL,
    periodo TEXT NOT NULL,
    mes_vencimiento INTEGER,
    dia_vencimiento INTEGER,
    trimestre INTEGER,
    obligatorio_autonomos BOOLEAN DEFAULT false,
    obligatorio_sociedades BOOLEAN DEFAULT false,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recordatorios_fiscales (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cliente_id UUID REFERENCES clientes(id) ON DELETE CASCADE,
    calendario_fiscal_id UUID REFERENCES calendario_fiscal(id) ON DELETE CASCADE,
    fecha_vencimiento DATE NOT NULL,
    completado BOOLEAN DEFAULT false,
    fecha_completado TIMESTAMP WITH TIME ZONE,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    modo_oscuro BOOLEAN DEFAULT false,
    idioma TEXT DEFAULT 'es' CHECK (idioma IN ('es', 'ca', 'en')),
    tamano_pagina INTEGER DEFAULT 20 CHECK (tamano_pagina IN (10, 20, 50, 100)),
    vista_documentos_por_defecto TEXT DEFAULT 'tabla' CHECK (vista_documentos_por_defecto IN ('tabla', 'tarjetas')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS notification_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    documentos_subidos BOOLEAN DEFAULT true,
    documentos_contabilizados BOOLEAN DEFAULT true,
    incidencias_nuevas BOOLEAN DEFAULT true,
    incidencias_resueltas BOOLEAN DEFAULT true,
    informes_disponibles BOOLEAN DEFAULT true,
    recordatorios_ia BOOLEAN DEFAULT true,
    vencimientos_fiscales BOOLEAN DEFAULT true,
    actualizaciones_plataforma BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

CREATE TABLE IF NOT EXISTS conversaciones_asesor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    asesor_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    titulo TEXT NOT NULL DEFAULT 'Nueva conversación',
    fecha_creacion TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    fecha_ultima_actividad TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensajes_asesor (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversacion_id UUID NOT NULL REFERENCES conversaciones_asesor(id) ON DELETE CASCADE,
    rol TEXT NOT NULL CHECK (rol IN ('usuario', 'asistente')),
    contenido TEXT NOT NULL,
    metadatos JSONB,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rol user_role NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (user_id, rol)
);

-- ============================================
-- 4. INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_rol ON profiles(rol);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_clientes_user_id_unique ON clientes(user_id);
CREATE INDEX IF NOT EXISTS idx_asesor_cliente_asesor ON asesor_cliente(asesor_id);
CREATE INDEX IF NOT EXISTS idx_asesor_cliente_cliente ON asesor_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_cliente ON documentos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_asesor ON documentos(asesor_id);
CREATE INDEX IF NOT EXISTS idx_documentos_estado ON documentos(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_cliente ON incidencias(cliente_id);
CREATE INDEX IF NOT EXISTS idx_incidencias_estado ON incidencias(estado);
CREATE INDEX IF NOT EXISTS idx_incidencias_cliente_estado ON incidencias(cliente_id, estado);
CREATE INDEX IF NOT EXISTS idx_mensajes_incidencia ON mensajes_incidencia(incidencia_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_incidencia_fecha ON mensajes_incidencia(incidencia_id, fecha);
CREATE INDEX IF NOT EXISTS idx_datos_financieros_cliente ON datos_financieros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_actividad_fecha ON actividad_reciente(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_documentos_financieros_cliente ON documentos_financieros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_documentos_financieros_asesor ON documentos_financieros(asesor_id);
CREATE INDEX IF NOT EXISTS idx_documentos_financieros_periodo ON documentos_financieros(periodo);
CREATE INDEX IF NOT EXISTS idx_documentos_financieros_fecha ON documentos_financieros(fecha_subida DESC);
CREATE INDEX IF NOT EXISTS idx_docs_financieros_cliente ON documentos_financieros(cliente_id);
CREATE INDEX IF NOT EXISTS idx_docs_financieros_tipo ON documentos_financieros(tipo);
CREATE INDEX IF NOT EXISTS idx_docs_financieros_periodo ON documentos_financieros(periodo);
CREATE INDEX IF NOT EXISTS idx_consultas_financieras_cliente ON consultas_financieras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_consultas_financieras_fecha ON consultas_financieras(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_cliente ON erp_asientos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_documento ON erp_asientos(documento_id);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_nro ON erp_asientos(nro_asiento);
CREATE INDEX IF NOT EXISTS idx_erp_asientos_fecha ON erp_asientos(fecha_asiento);
CREATE INDEX IF NOT EXISTS idx_libro_registro_cliente ON libro_registro(cliente_id);
CREATE INDEX IF NOT EXISTS idx_libro_registro_periodo ON libro_registro(periodo);
CREATE INDEX IF NOT EXISTS idx_verificaciones_ia_documento ON verificaciones_ia(documento_id);
CREATE INDEX IF NOT EXISTS idx_verificaciones_ia_accion ON verificaciones_ia(accion);
CREATE INDEX IF NOT EXISTS idx_metricas_ia_fecha ON metricas_ia(fecha);
CREATE INDEX IF NOT EXISTS idx_metricas_ia_periodo ON metricas_ia(periodo);
CREATE INDEX IF NOT EXISTS idx_modelos_financieros_cliente ON modelos_financieros_cliente(cliente_id);
CREATE INDEX IF NOT EXISTS idx_modelos_financieros_periodo ON modelos_financieros_cliente(periodo);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria_financiera(usuario_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_accion ON auditoria_financiera(accion);
CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria_financiera(fecha);
CREATE INDEX IF NOT EXISTS idx_auditoria_cliente ON auditoria_financiera(cliente_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON historial_notificaciones(usuario_id);
CREATE INDEX IF NOT EXISTS idx_notificaciones_leido ON historial_notificaciones(leido);
CREATE INDEX IF NOT EXISTS idx_notificaciones_fecha ON historial_notificaciones(created_at);
CREATE INDEX IF NOT EXISTS idx_conversaciones_cliente ON conversaciones_asistente(cliente_id, fecha_ultima_actividad DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_conversacion ON mensajes_asistente(conversacion_id, fecha);
CREATE INDEX IF NOT EXISTS idx_base_conocimiento_categoria ON base_conocimiento_e2(categoria);
CREATE INDEX IF NOT EXISTS idx_base_conocimiento_keywords ON base_conocimiento_e2 USING GIN(palabras_clave);
CREATE INDEX IF NOT EXISTS idx_calendario_fiscal_periodo ON calendario_fiscal(periodo, mes_vencimiento);
CREATE INDEX IF NOT EXISTS idx_recordatorios_cliente_fecha ON recordatorios_fiscales(cliente_id, fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_settings_user_id ON notification_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_asesor_asesor_id ON conversaciones_asesor(asesor_id);
CREATE INDEX IF NOT EXISTS idx_conversaciones_asesor_fecha ON conversaciones_asesor(fecha_ultima_actividad DESC);
CREATE INDEX IF NOT EXISTS idx_mensajes_asesor_conversacion ON mensajes_asesor(conversacion_id);

-- ============================================
-- 5. FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
    user_nombre TEXT;
    user_rol user_role;
BEGIN
    user_nombre := COALESCE(NEW.raw_user_meta_data->>'nombre', 'Usuario');
    
    BEGIN
        user_rol := COALESCE((NEW.raw_user_meta_data->>'rol')::user_role, 'cliente'::user_role);
    EXCEPTION WHEN OTHERS THEN
        user_rol := 'cliente'::user_role;
    END;
    
    INSERT INTO public.profiles (id, nombre, email, rol, estado, fecha_alta)
    VALUES (
        NEW.id,
        user_nombre,
        NEW.email,
        user_rol,
        'activo',
        NOW()
    );
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_cliente()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.rol = 'cliente' THEN
        INSERT INTO public.clientes (
            user_id,
            nif,
            razon_social,
            nombre_comercial,
            persona_contacto,
            telefono,
            email,
            direccion_fiscal,
            estado,
            modulo_subida_documentos,
            modulo_incidencias,
            modulo_asistente_e2,
            modulo_panel_financiero,
            modulo_facturacion
        ) VALUES (
            NEW.id,
            'PENDING',
            NEW.nombre,
            NEW.nombre,
            NEW.nombre,
            COALESCE(NEW.telefono, 'PENDING'),
            NEW.email,
            'PENDING',
            'activo',
            true,
            true,
            false,
            false,
            false
        )
        ON CONFLICT (user_id) DO NOTHING;
    END IF;
    
    RETURN NEW;
EXCEPTION
    WHEN unique_violation THEN
        RETURN NEW;
    WHEN OTHERS THEN
        RAISE WARNING 'Error creating cliente for user %: %', NEW.id, SQLERRM;
        RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION get_user_role(user_id UUID)
RETURNS VARCHAR(20) AS $$
BEGIN
    RETURN (
        SELECT rol 
        FROM profiles 
        WHERE id = user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION generar_recordatorios_fiscales_cliente(p_cliente_id UUID)
RETURNS void AS $$
DECLARE
    v_anio INTEGER := EXTRACT(YEAR FROM CURRENT_DATE);
    v_calendario RECORD;
    v_fecha DATE;
BEGIN
    FOR v_calendario IN 
        SELECT * FROM calendario_fiscal 
        WHERE (obligatorio_autonomos = true OR obligatorio_sociedades = true)
    LOOP
        IF v_calendario.periodo = 'trimestral' AND v_calendario.trimestre IS NOT NULL THEN
            v_fecha := DATE(v_anio || '-' || 
                CASE v_calendario.trimestre
                    WHEN 1 THEN '04'
                    WHEN 2 THEN '07'
                    WHEN 3 THEN '10'
                    WHEN 4 THEN '01'
                END || '-' || v_calendario.dia_vencimiento);
            
            IF v_calendario.trimestre = 4 THEN
                v_fecha := DATE((v_anio + 1) || '-01-' || v_calendario.dia_vencimiento);
            END IF;
            
            INSERT INTO recordatorios_fiscales (cliente_id, calendario_fiscal_id, fecha_vencimiento)
            VALUES (p_cliente_id, v_calendario.id, v_fecha)
            ON CONFLICT DO NOTHING;
            
        ELSIF v_calendario.periodo = 'anual' AND v_calendario.mes_vencimiento IS NOT NULL THEN
            v_fecha := DATE(v_anio || '-' || 
                LPAD(v_calendario.mes_vencimiento::text, 2, '0') || '-' || 
                LPAD(v_calendario.dia_vencimiento::text, 2, '0'));
            
            INSERT INTO recordatorios_fiscales (cliente_id, calendario_fiscal_id, fecha_vencimiento)
            VALUES (p_cliente_id, v_calendario.id, v_fecha)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION create_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    INSERT INTO notification_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION crear_log_auditoria(
    p_usuario_id UUID,
    p_usuario_nombre TEXT,
    p_usuario_rol TEXT,
    p_accion TEXT,
    p_entidad_tipo TEXT,
    p_entidad_id UUID,
    p_descripcion TEXT,
    p_datos_anteriores JSONB DEFAULT NULL,
    p_datos_nuevos JSONB DEFAULT NULL,
    p_cliente_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO auditoria_financiera (
        usuario_id,
        usuario_nombre,
        usuario_rol,
        accion,
        entidad_tipo,
        entidad_id,
        descripcion,
        datos_anteriores,
        datos_nuevos,
        cliente_id
    ) VALUES (
        p_usuario_id,
        p_usuario_nombre,
        p_usuario_rol,
        p_accion,
        p_entidad_tipo,
        p_entidad_id,
        p_descripcion,
        p_datos_anteriores,
        p_datos_nuevos,
        p_cliente_id
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calcular_modelo_financiero(
    p_cliente_id UUID,
    p_periodo TEXT
)
RETURNS UUID AS $$
DECLARE
    v_modelo_id UUID;
    v_ingresos DECIMAL(15,2);
    v_gastos DECIMAL(15,2);
    v_resultado DECIMAL(15,2);
BEGIN
    SELECT ingresos, gastos, resultado
    INTO v_ingresos, v_gastos, v_resultado
    FROM datos_financieros
    WHERE cliente_id = p_cliente_id AND periodo = p_periodo
    LIMIT 1;
    
    INSERT INTO modelos_financieros_cliente (
        cliente_id,
        periodo,
        ejercicio_fiscal,
        ingresos_operacionales,
        gastos_operacionales,
        resultado_operacional,
        resultado_neto,
        margen_neto
    ) VALUES (
        p_cliente_id,
        p_periodo,
        EXTRACT(YEAR FROM NOW())::TEXT,
        COALESCE(v_ingresos, 0),
        COALESCE(v_gastos, 0),
        COALESCE(v_resultado, 0),
        COALESCE(v_resultado, 0),
        CASE WHEN COALESCE(v_ingresos, 0) > 0 
            THEN (COALESCE(v_resultado, 0) / COALESCE(v_ingresos, 1)) * 100 
            ELSE 0 
        END
    )
    ON CONFLICT (cliente_id, periodo) 
    DO UPDATE SET
        ingresos_operacionales = EXCLUDED.ingresos_operacionales,
        gastos_operacionales = EXCLUDED.gastos_operacionales,
        resultado_operacional = EXCLUDED.resultado_operacional,
        resultado_neto = EXCLUDED.resultado_neto,
        margen_neto = EXCLUDED.margen_neto,
        fecha_calculo = NOW()
    RETURNING id INTO v_modelo_id;
    
    RETURN v_modelo_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 6. TRIGGERS
-- ============================================

DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_clientes_updated_at ON clientes;
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_documentos_updated_at ON documentos;
CREATE TRIGGER update_documentos_updated_at BEFORE UPDATE ON documentos
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_incidencias_updated_at ON incidencias;
CREATE TRIGGER update_incidencias_updated_at BEFORE UPDATE ON incidencias
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_datos_financieros_updated_at ON datos_financieros;
CREATE TRIGGER update_datos_financieros_updated_at BEFORE UPDATE ON datos_financieros
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS on_profile_created_cliente ON profiles;
CREATE TRIGGER on_profile_created_cliente
    AFTER INSERT ON profiles
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_cliente();

DROP TRIGGER IF EXISTS update_documentos_financieros_updated_at ON documentos_financieros;
CREATE TRIGGER update_documentos_financieros_updated_at
    BEFORE UPDATE ON documentos_financieros
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_erp_asientos_updated_at ON erp_asientos;
CREATE TRIGGER update_erp_asientos_updated_at
    BEFORE UPDATE ON erp_asientos
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_libro_registro_updated_at ON libro_registro;
CREATE TRIGGER update_libro_registro_updated_at
    BEFORE UPDATE ON libro_registro
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_verificaciones_ia_updated_at ON verificaciones_ia;
CREATE TRIGGER update_verificaciones_ia_updated_at
    BEFORE UPDATE ON verificaciones_ia
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_modelos_financieros_updated_at ON modelos_financieros_cliente;
CREATE TRIGGER update_modelos_financieros_updated_at
    BEFORE UPDATE ON modelos_financieros_cliente
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON user_preferences;
CREATE TRIGGER update_user_preferences_updated_at 
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_notification_settings_updated_at ON notification_settings;
CREATE TRIGGER update_notification_settings_updated_at 
    BEFORE UPDATE ON notification_settings
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS on_profile_created_create_settings ON profiles;
CREATE TRIGGER on_profile_created_create_settings
    AFTER INSERT ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION create_user_settings();

-- ============================================
-- 7. ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE asesor_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_incidencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE datos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE actividad_reciente ENABLE ROW LEVEL SECURITY;
ALTER TABLE documentos_financieros ENABLE ROW LEVEL SECURITY;
ALTER TABLE consultas_financieras ENABLE ROW LEVEL SECURITY;
ALTER TABLE erp_asientos ENABLE ROW LEVEL SECURITY;
ALTER TABLE libro_registro ENABLE ROW LEVEL SECURITY;
ALTER TABLE verificaciones_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE metricas_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE modelos_financieros_cliente ENABLE ROW LEVEL SECURITY;
ALTER TABLE auditoria_financiera ENABLE ROW LEVEL SECURITY;
ALTER TABLE preferencias_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE historial_notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones_asistente ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_asistente ENABLE ROW LEVEL SECURITY;
ALTER TABLE base_conocimiento_e2 ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendario_fiscal ENABLE ROW LEVEL SECURITY;
ALTER TABLE recordatorios_fiscales ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversaciones_asesor ENABLE ROW LEVEL SECURITY;
ALTER TABLE mensajes_asesor ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. RLS POLICIES
-- ============================================

-- Clientes policies
DROP POLICY IF EXISTS "Clientes can view their own data" ON clientes;
CREATE POLICY "Clientes can view their own data" ON clientes
    FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Admins can manage all clients" ON clientes;
CREATE POLICY "Admins can manage all clients" ON clientes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Asesores can view their assigned clients" ON clientes;
CREATE POLICY "Asesores can view their assigned clients" ON clientes
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente 
            WHERE cliente_id = clientes.id AND asesor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clientes can update their own contact data" ON clientes;
CREATE POLICY "Clientes can update their own contact data" ON clientes
    FOR UPDATE
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Asesores can insert clients" ON clientes;
CREATE POLICY "Asesores can insert clients" ON clientes
    FOR INSERT 
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND rol = 'asesor'
        )
    );

DROP POLICY IF EXISTS "Asesores can update assigned clients" ON clientes;
CREATE POLICY "Asesores can update assigned clients" ON clientes
    FOR UPDATE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND rol = 'asesor'
        ) AND (
            EXISTS (
                SELECT 1 FROM asesor_cliente 
                WHERE asesor_id = auth.uid() AND cliente_id = clientes.id
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND rol = 'asesor'
        )
    );

DROP POLICY IF EXISTS "Asesores can delete assigned clients" ON clientes;
CREATE POLICY "Asesores can delete assigned clients" ON clientes
    FOR DELETE 
    USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE id = auth.uid() AND rol = 'asesor'
        ) AND (
            EXISTS (
                SELECT 1 FROM asesor_cliente 
                WHERE asesor_id = auth.uid() AND cliente_id = clientes.id
            )
        )
    );

-- Documentos policies
DROP POLICY IF EXISTS "Users can view their related documents" ON documentos;
CREATE POLICY "Users can view their related documents" ON documentos
    FOR SELECT USING (
        auth.uid() = asesor_id OR
        EXISTS (
            SELECT 1 FROM clientes WHERE id = documentos.cliente_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Clients can create documents" ON documentos;
CREATE POLICY "Clients can create documents" ON documentos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM clientes WHERE id = documentos.cliente_id AND user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Asesores and Admins can update documents" ON documentos;
CREATE POLICY "Asesores and Admins can update documents" ON documentos
    FOR UPDATE USING (
        auth.uid() = asesor_id OR
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol IN ('admin', 'asesor')
        )
    );

-- Incidencias policies
DROP POLICY IF EXISTS "Users can view their related incidents" ON incidencias;
CREATE POLICY "Users can view their related incidents" ON incidencias
    FOR SELECT USING (
        auth.uid() = asesor_id OR
        EXISTS (
            SELECT 1 FROM clientes WHERE id = incidencias.cliente_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Authenticated users can create incidencias" ON incidencias;
CREATE POLICY "Authenticated users can create incidencias" ON incidencias
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can update their own incidencias" ON incidencias;
CREATE POLICY "Users can update their own incidencias" ON incidencias
    FOR UPDATE USING (
        auth.role() = 'authenticated' AND (
            cliente_id IN (
                SELECT id FROM clientes WHERE user_id = auth.uid()
            ) OR
            asesor_id IN (
                SELECT id FROM profiles WHERE id = auth.uid() AND rol = 'asesor'
            ) OR
            EXISTS (
                SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
            )
        )
    );

-- Mensajes incidencia policies
DROP POLICY IF EXISTS "Users can view messages from their incidents" ON mensajes_incidencia;
CREATE POLICY "Users can view messages from their incidents" ON mensajes_incidencia
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM incidencias 
            WHERE id = mensajes_incidencia.incidencia_id 
            AND (
                asesor_id = auth.uid() OR
                EXISTS (SELECT 1 FROM clientes WHERE id = incidencias.cliente_id AND user_id = auth.uid())
            )
        )
    );

DROP POLICY IF EXISTS "Users can create mensajes for their incidencias" ON mensajes_incidencia;
CREATE POLICY "Users can create mensajes for their incidencias" ON mensajes_incidencia
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated' AND
        incidencia_id IN (
            SELECT id FROM incidencias WHERE 
            cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR
            asesor_id IN (SELECT id FROM profiles WHERE id = auth.uid() AND rol = 'asesor') OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
        )
    );

DROP POLICY IF EXISTS "Users can view mensajes for their incidencias" ON mensajes_incidencia;
CREATE POLICY "Users can view mensajes for their incidencias" ON mensajes_incidencia
    FOR SELECT USING (
        auth.role() = 'authenticated' AND
        incidencia_id IN (
            SELECT id FROM incidencias WHERE 
            cliente_id IN (SELECT id FROM clientes WHERE user_id = auth.uid()) OR
            asesor_id IN (SELECT id FROM profiles WHERE id = auth.uid() AND rol = 'asesor') OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
        )
    );

-- Datos financieros policies
DROP POLICY IF EXISTS "Users can view their financial data" ON datos_financieros;
CREATE POLICY "Users can view their financial data" ON datos_financieros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes WHERE id = datos_financieros.cliente_id AND user_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM asesor_cliente WHERE cliente_id = datos_financieros.cliente_id AND asesor_id = auth.uid()
        ) OR
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
        )
    );

-- Actividad reciente policies
DROP POLICY IF EXISTS "All authenticated users can view activity" ON actividad_reciente;
CREATE POLICY "All authenticated users can view activity" ON actividad_reciente
    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Documentos financieros policies
DROP POLICY IF EXISTS "Admin full access to documentos_financieros" ON documentos_financieros;
CREATE POLICY "Admin full access to documentos_financieros" ON documentos_financieros
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Asesor access to assigned clients financieros" ON documentos_financieros;
CREATE POLICY "Asesor access to assigned clients financieros" ON documentos_financieros
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente ac
            JOIN profiles p ON p.id = auth.uid()
            WHERE ac.asesor_id = p.id 
            AND ac.cliente_id = documentos_financieros.cliente_id
            AND p.rol = 'asesor'
        )
    );

DROP POLICY IF EXISTS "Cliente access to own documentos_financieros" ON documentos_financieros;
CREATE POLICY "Cliente access to own documentos_financieros" ON documentos_financieros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes c
            JOIN profiles p ON p.id = auth.uid()
            WHERE c.id = documentos_financieros.cliente_id 
            AND c.user_id = p.id
            AND p.rol = 'cliente'
        )
    );

DROP POLICY IF EXISTS "Admins can view all financial documents" ON documentos_financieros;
CREATE POLICY "Admins can view all financial documents" ON documentos_financieros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Advisors can view their clients' financial documents" ON documentos_financieros;
CREATE POLICY "Advisors can view their clients' financial documents" ON documentos_financieros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente
            WHERE asesor_cliente.asesor_id = auth.uid()
            AND asesor_cliente.cliente_id = documentos_financieros.cliente_id
        )
    );

DROP POLICY IF EXISTS "Clients can view their own financial documents" ON documentos_financieros;
CREATE POLICY "Clients can view their own financial documents" ON documentos_financieros
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes
            WHERE clientes.id = documentos_financieros.cliente_id
            AND clientes.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Advisors can insert financial documents for their clients" ON documentos_financieros;
CREATE POLICY "Advisors can insert financial documents for their clients" ON documentos_financieros
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM asesor_cliente
            WHERE asesor_cliente.asesor_id = auth.uid()
            AND asesor_cliente.cliente_id = documentos_financieros.cliente_id
        )
    );

DROP POLICY IF EXISTS "Advisors can update financial documents for their clients" ON documentos_financieros;
CREATE POLICY "Advisors can update financial documents for their clients" ON documentos_financieros
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente
            WHERE asesor_cliente.asesor_id = auth.uid()
            AND asesor_cliente.cliente_id = documentos_financieros.cliente_id
        )
    );

DROP POLICY IF EXISTS "Advisors can delete financial documents for their clients" ON documentos_financieros;
CREATE POLICY "Advisors can delete financial documents for their clients" ON documentos_financieros
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente
            WHERE asesor_cliente.asesor_id = auth.uid()
            AND asesor_cliente.cliente_id = documentos_financieros.cliente_id
        )
    );

-- Consultas financieras policies
DROP POLICY IF EXISTS "Admins can view all financial queries" ON consultas_financieras;
CREATE POLICY "Admins can view all financial queries" ON consultas_financieras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.rol = 'admin'
        )
    );

DROP POLICY IF EXISTS "Advisors can view their clients' financial queries" ON consultas_financieras;
CREATE POLICY "Advisors can view their clients' financial queries" ON consultas_financieras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM asesor_cliente
            WHERE asesor_cliente.asesor_id = auth.uid()
            AND asesor_cliente.cliente_id = consultas_financieras.cliente_id
        )
    );

DROP POLICY IF EXISTS "Clients can view their own financial queries" ON consultas_financieras;
CREATE POLICY "Clients can view their own financial queries" ON consultas_financieras
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM clientes
            WHERE clientes.id = consultas_financieras.cliente_id
            AND clientes.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can insert their own financial queries" ON consultas_financieras;
CREATE POLICY "Clients can insert their own financial queries" ON consultas_financieras
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM clientes
            WHERE clientes.id = consultas_financieras.cliente_id
            AND clientes.user_id = auth.uid()
        )
    );

-- ERP Asientos policies
DROP POLICY IF EXISTS "Admin full access to erp_asientos" ON erp_asientos;
CREATE POLICY "Admin full access to erp_asientos" ON erp_asientos FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Modelos financieros policies
DROP POLICY IF EXISTS "Admin full access to modelos_financieros" ON modelos_financieros_cliente;
CREATE POLICY "Admin full access to modelos_financieros" ON modelos_financieros_cliente FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Auditoria policies
DROP POLICY IF EXISTS "Admin full access to auditoria" ON auditoria_financiera;
CREATE POLICY "Admin full access to auditoria" ON auditoria_financiera FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND rol = 'admin')
);

-- Notificaciones policies
DROP POLICY IF EXISTS "Users access own notifications" ON historial_notificaciones;
CREATE POLICY "Users access own notifications" ON historial_notificaciones FOR ALL USING (
    usuario_id = auth.uid()
);

-- Conversaciones asistente policies
DROP POLICY IF EXISTS "Clients can view their own conversations" ON conversaciones_asistente;
CREATE POLICY "Clients can view their own conversations" ON conversaciones_asistente
    FOR SELECT USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can insert their own conversations" ON conversaciones_asistente;
CREATE POLICY "Clients can insert their own conversations" ON conversaciones_asistente
    FOR INSERT WITH CHECK (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can update their own conversations" ON conversaciones_asistente;
CREATE POLICY "Clients can update their own conversations" ON conversaciones_asistente
    FOR UPDATE USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

-- Mensajes asistente policies
DROP POLICY IF EXISTS "Users can view messages from their conversations" ON mensajes_asistente;
CREATE POLICY "Users can view messages from their conversations" ON mensajes_asistente
    FOR SELECT USING (
        conversacion_id IN (
            SELECT id FROM conversaciones_asistente 
            WHERE cliente_id IN (
                SELECT id FROM clientes WHERE user_id = auth.uid()
            )
        )
    );

DROP POLICY IF EXISTS "Users can insert messages in their conversations" ON mensajes_asistente;
CREATE POLICY "Users can insert messages in their conversations" ON mensajes_asistente
    FOR INSERT WITH CHECK (
        conversacion_id IN (
            SELECT id FROM conversaciones_asistente 
            WHERE cliente_id IN (
                SELECT id FROM clientes WHERE user_id = auth.uid()
            )
        )
    );

-- Base conocimiento policies
DROP POLICY IF EXISTS "Authenticated users can read knowledge base" ON base_conocimiento_e2;
CREATE POLICY "Authenticated users can read knowledge base" ON base_conocimiento_e2
    FOR SELECT TO authenticated USING (true);

-- Calendario fiscal policies
DROP POLICY IF EXISTS "Authenticated users can read fiscal calendar" ON calendario_fiscal;
CREATE POLICY "Authenticated users can read fiscal calendar" ON calendario_fiscal
    FOR SELECT TO authenticated USING (true);

-- Recordatorios fiscales policies
DROP POLICY IF EXISTS "Clients can view their own reminders" ON recordatorios_fiscales;
CREATE POLICY "Clients can view their own reminders" ON recordatorios_fiscales
    FOR SELECT USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can insert their own reminders" ON recordatorios_fiscales;
CREATE POLICY "Clients can insert their own reminders" ON recordatorios_fiscales
    FOR INSERT WITH CHECK (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Clients can update their own reminders" ON recordatorios_fiscales;
CREATE POLICY "Clients can update their own reminders" ON recordatorios_fiscales
    FOR UPDATE USING (
        cliente_id IN (
            SELECT id FROM clientes WHERE user_id = auth.uid()
        )
    );

-- User preferences policies
DROP POLICY IF EXISTS "Users can view their own preferences" ON user_preferences;
CREATE POLICY "Users can view their own preferences" ON user_preferences
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON user_preferences;
CREATE POLICY "Users can insert their own preferences" ON user_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON user_preferences;
CREATE POLICY "Users can update their own preferences" ON user_preferences
    FOR UPDATE USING (auth.uid() = user_id);

-- Notification settings policies
DROP POLICY IF EXISTS "Users can view their own notification settings" ON notification_settings;
CREATE POLICY "Users can view their own notification settings" ON notification_settings
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own notification settings" ON notification_settings;
CREATE POLICY "Users can insert their own notification settings" ON notification_settings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notification settings" ON notification_settings;
CREATE POLICY "Users can update their own notification settings" ON notification_settings
    FOR UPDATE USING (auth.uid() = user_id);

-- Conversaciones asesor policies
DROP POLICY IF EXISTS "Advisors can view their own conversations" ON conversaciones_asesor;
CREATE POLICY "Advisors can view their own conversations" ON conversaciones_asesor
    FOR SELECT USING (asesor_id = auth.uid());

DROP POLICY IF EXISTS "Advisors can insert their own conversations" ON conversaciones_asesor;
CREATE POLICY "Advisors can insert their own conversations" ON conversaciones_asesor
    FOR INSERT WITH CHECK (asesor_id = auth.uid());

DROP POLICY IF EXISTS "Advisors can update their own conversations" ON conversaciones_asesor;
CREATE POLICY "Advisors can update their own conversations" ON conversaciones_asesor
    FOR UPDATE USING (asesor_id = auth.uid());

DROP POLICY IF EXISTS "Advisors can delete their own conversations" ON conversaciones_asesor;
CREATE POLICY "Advisors can delete their own conversations" ON conversaciones_asesor
    FOR DELETE USING (asesor_id = auth.uid());

-- Mensajes asesor policies
DROP POLICY IF EXISTS "Advisors can view messages from their conversations" ON mensajes_asesor;
CREATE POLICY "Advisors can view messages from their conversations" ON mensajes_asesor
    FOR SELECT USING (
        conversacion_id IN (
            SELECT id FROM conversaciones_asesor WHERE asesor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Advisors can insert messages in their conversations" ON mensajes_asesor;
CREATE POLICY "Advisors can insert messages in their conversations" ON mensajes_asesor
    FOR INSERT WITH CHECK (
        conversacion_id IN (
            SELECT id FROM conversaciones_asesor WHERE asesor_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Advisors can delete messages from their conversations" ON mensajes_asesor;
CREATE POLICY "Advisors can delete messages from their conversations" ON mensajes_asesor
    FOR DELETE USING (
        conversacion_id IN (
            SELECT id FROM conversaciones_asesor WHERE asesor_id = auth.uid()
        )
    );

-- User roles policies
DROP POLICY IF EXISTS "Admins manage user roles" ON user_roles;
CREATE POLICY "Admins manage user roles" ON user_roles
    FOR ALL USING (auth.role() = 'service_role')
    WITH CHECK (true);

DROP POLICY IF EXISTS "Users read their roles" ON user_roles;
CREATE POLICY "Users read their roles" ON user_roles
    FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 9. STORAGE BUCKETS
-- ============================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documentos',
    'documentos',
    true,
    10485760,
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public)
VALUES ('incidencias', 'incidencias', true)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- 10. STORAGE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Users can upload to their client folder" ON storage.objects;
CREATE POLICY "Users can upload to their client folder"
    ON storage.objects FOR INSERT
    TO authenticated
    WITH CHECK (
        bucket_id = 'documentos' AND
        (storage.foldername(name))[1] IN (
            SELECT c.id::text
            FROM clientes c
            WHERE c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can view their client files" ON storage.objects;
CREATE POLICY "Users can view their client files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documentos' AND
        (
            (storage.foldername(name))[1] IN (
                SELECT c.id::text
                FROM clientes c
                WHERE c.user_id = auth.uid()
            )
            OR
            (storage.foldername(name))[1] IN (
                SELECT ac.cliente_id::text
                FROM asesor_cliente ac
                JOIN profiles p ON ac.asesor_id = p.id
                WHERE p.id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid() AND p.rol = 'admin'
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete their pending documents" ON storage.objects;
CREATE POLICY "Users can delete their pending documents"
    ON storage.objects FOR DELETE
    TO authenticated
    USING (
        bucket_id = 'documentos' AND
        (storage.foldername(name))[1] IN (
            SELECT c.id::text
            FROM clientes c
            WHERE c.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Asesors can view client files" ON storage.objects;
CREATE POLICY "Asesors can view client files"
    ON storage.objects FOR SELECT
    TO authenticated
    USING (
        bucket_id = 'documentos' AND
        (
            EXISTS (
                SELECT 1
                FROM asesor_cliente ac
                WHERE ac.cliente_id::text = (storage.foldername(name))[1]
                    AND ac.asesor_id = auth.uid()
            )
            OR
            EXISTS (
                SELECT 1 FROM profiles p
                WHERE p.id = auth.uid() AND p.rol IN ('admin', 'asesor')
            )
        )
    );

DROP POLICY IF EXISTS "Users can upload incident attachments" ON storage.objects;
CREATE POLICY "Users can upload incident attachments" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'incidencias' AND auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Users can view incident attachments" ON storage.objects;
CREATE POLICY "Users can view incident attachments" ON storage.objects
    FOR SELECT USING (bucket_id = 'incidencias' AND auth.role() = 'authenticated');

-- ============================================
-- 11. GRANTS
-- ============================================

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON documentos_financieros TO authenticated;
GRANT ALL ON consultas_financieras TO authenticated;

-- ============================================
-- 12. REAL-TIME PUBLICATIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE mensajes_incidencia;
ALTER PUBLICATION supabase_realtime ADD TABLE incidencias;

-- ============================================
-- 13. ALTER TABLE STATEMENTS
-- ============================================

ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_validacion TIMESTAMP WITH TIME ZONE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS validado_por UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS fecha_contabilizacion TIMESTAMP WITH TIME ZONE;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS incluido_en_libro UUID;
ALTER TABLE documentos ADD COLUMN IF NOT EXISTS bloqueado BOOLEAN DEFAULT false;

ALTER TABLE datos_financieros ADD COLUMN IF NOT EXISTS modelo_financiero_id UUID REFERENCES modelos_financieros_cliente(id) ON DELETE SET NULL;

UPDATE mensajes_incidencia SET rol = 'cliente' WHERE rol IS NULL;
UPDATE clientes SET tipo_cliente = 'empresa' WHERE tipo_cliente IS NULL;

-- ============================================
-- 14. SEED DATA
-- ============================================

INSERT INTO calendario_fiscal (modelo, descripcion, periodo, mes_vencimiento, dia_vencimiento, trimestre, obligatorio_autonomos, obligatorio_sociedades, notas) VALUES
('111', 'Retenciones e ingresos a cuenta de rendimientos del trabajo', 'mensual', NULL, 20, NULL, false, true, 'Presentación mensual o trimestral según volumen'),
('115', 'Retenciones e ingresos a cuenta de rendimientos de arrendamiento', 'trimestral', NULL, 20, NULL, true, true, 'Trimestral para la mayoría'),
('130', 'Pago fraccionado IRPF (autónomos)', 'trimestral', NULL, 20, NULL, true, false, 'Trimestral para estimación directa'),
('303', 'IVA - Autoliquidación trimestral', 'trimestral', NULL, 20, 1, true, true, '1T: abril, 2T: julio, 3T: octubre, 4T: enero'),
('303', 'IVA - Autoliquidación trimestral', 'trimestral', NULL, 20, 2, true, true, '1T: abril, 2T: julio, 3T: octubre, 4T: enero'),
('303', 'IVA - Autoliquidación trimestral', 'trimestral', NULL, 20, 3, true, true, '1T: abril, 2T: julio, 3T: octubre, 4T: enero'),
('303', 'IVA - Autoliquidación trimestral', 'trimestral', NULL, 20, 4, true, true, '1T: abril, 2T: julio, 3T: octubre, 4T: enero'),
('100', 'IRPF - Declaración anual de la renta', 'anual', 6, 30, NULL, true, false, 'Campaña de abril a junio'),
('200', 'Impuesto sobre Sociedades', 'anual', 7, 25, NULL, false, true, 'Hasta 25 días después del cierre fiscal'),
('390', 'IVA - Resumen anual', 'anual', 1, 30, NULL, true, true, 'Enero del año siguiente'),
('349', 'Declaración recapitulativa de operaciones intracomunitarias', 'mensual', NULL, 20, NULL, false, true, 'Si hay operaciones intracomunitarias'),
('347', 'Declaración anual de operaciones con terceros', 'anual', 2, 28, NULL, true, true, 'Operaciones superiores a 3.005,06€')
ON CONFLICT DO NOTHING;

INSERT INTO base_conocimiento_e2 (categoria, subcategoria, pregunta, respuesta, palabras_clave, fuente_oficial, prioridad) VALUES
('fiscal', 'iva', '¿Qué tipos de IVA hay en España?', 
'En España existen tres tipos de IVA:

• **IVA General (21%)**: Se aplica a la mayoría de productos y servicios.
• **IVA Reducido (10%)**: Aplicable a alimentos, transporte de viajeros, hostelería, etc.
• **IVA Superreducido (4%)**: Para productos básicos como pan, leche, huevos, frutas, verduras, libros, periódicos, medicamentos de uso humano, viviendas de protección oficial, etc.

Para servicios profesionales se aplica generalmente el IVA general del 21%.', 
ARRAY['iva', 'tipos', 'porcentaje', '21%', '10%', '4%', 'general', 'reducido', 'superreducido'],
'Ley 37/1992, del Impuesto sobre el Valor Añadido',
10),

('fiscal', 'iva', '¿Cuándo tengo que presentar el IVA?',
'El IVA se presenta mediante el **Modelo 303** de forma trimestral para la mayoría de autónomos y pequeñas empresas:

• **1er Trimestre** (ene-mar): hasta el 20 de abril
• **2º Trimestre** (abr-jun): hasta el 20 de julio
• **3er Trimestre** (jul-sep): hasta el 20 de octubre
• **4º Trimestre** (oct-dic): hasta el 30 de enero del año siguiente

Grandes empresas deben presentarlo mensualmente. Al final de año también hay que presentar el **Modelo 390** (resumen anual) antes del 30 de enero.',
ARRAY['iva', 'modelo 303', 'trimestral', 'vencimiento', 'plazo', 'presentación', 'calendario'],
'Orden HAC/3625/2003',
10),

('explicativo', 'conceptos', '¿Qué es una factura rectificativa?',
'Una **factura rectificativa** es un documento contable que se emite para corregir errores en una factura previamente emitida. Se utiliza cuando:

• Hay errores en el importe (precio, cantidad, descuentos)
• Datos incorrectos del cliente o proveedor
• Tipo de IVA aplicado incorrectamente
• Necesitas anular parcial o totalmente una factura

**Requisitos importantes:**
✓ Debe hacer referencia a la factura original (número y fecha)
✓ Indicar claramente el motivo de la rectificación
✓ La factura original NO se elimina, se conservan ambas
✓ Afecta al IVA del period en que se emite la rectificativa

No confundir con factura duplicada, que es simplemente una copia.',
ARRAY['factura', 'rectificativa', 'corrección', 'error', 'anular', 'modificar'],
'Real Decreto 1619/2012, Reglamento de Facturación',
8),

('explicativo', 'conceptos', '¿Qué documentos debo conservar?',
'Por ley, debes conservar durante **4 años** (6 años para el Impuesto de Sociedades):

**Documentos obligatorios:**
✓ Todas las facturas emitidas y recibidas
✓ Tickets y justificantes de gastos deducibles
✓ Contratos relevantes para la actividad
✓ Nóminas y seguros sociales (si tienes empleados)
✓ Extractos bancarios
✓ Libros contables y registros oficiales
✓ Declaraciones de impuestos presentadas

**Formato:**
• Pueden conservarse en formato digital (escaneados)
• Deben ser legibles y estar disponibles para inspecciones
• Organízalos por año y tipo de documento

Nuestra plataforma te ayuda a almacenarlos de forma segura y organizada.',
ARRAY['documentos', 'conservar', 'guardar', 'archivo', 'plazo', 'obligación', 'facturas', 'tickets'],
'Ley 58/2003, Ley General Tributaria',
9),

('fiscal', 'deducciones', '¿Puedo deducir los gastos de mi vehículo?',
'Los gastos de vehículo **sí son deducibles** si lo usas para tu actividad profesional, pero con límites:

**Gastos deducibles:**
✓ Combustible
✓ Reparaciones y mantenimiento
✓ Seguro del vehículo
✓ ITV e impuestos (circulación)
✓ Parking relacionado con la actividad
✓ Amortización del vehículo

**Límites importantes:**
• Para autónomos: deducción del 50% si uso mixto (profesional y personal)
• IVA del vehículo: solo deducible al 50% en turismos
• Debes poder justificar el uso profesional
• Si es uso 100% profesional, debes demostrarlo (ej: vehículo de empresa)

**Recomendación:** Lleva un registro de kilómetros profesionales vs personales. Tu asesor puede ayudarte a calcular la proporción exacta para tu caso.',
ARRAY['vehículo', 'coche', 'gastos', 'deducir', 'combustible', 'deducción', 'autonomo'],
'Ley 35/2006, IRPF - Art. 30',
7),

('laboral', 'autonomos', '¿Cuánto tengo que pagar de cuota de autónomos?',
'La cuota de autónomos en 2025 depende de tus **ingresos reales** (sistema de cotización por tramos):

**Sistema actual:**
• Cuota mínima: ~230€/mes (rendimientos hasta 670€/mes)
• Cuota máxima: ~500€/mes (rendimientos superiores a 6.000€/mes)
• La cuota se ajusta según tus ingresos declarados

**Importante:**
✓ Debes estimar tus ingresos al inicio del año
✓ Puedes cambiar la base de cotización hasta 4 veces al año
✓ Hacienda regularizará si tus ingresos reales difieren de tu cotización
✓ Tarifa plana: 80€/mes los primeros 12 meses (si eres nuevo autónomo)

**Bonificaciones:**
• Autónomos menores de 30 años: bonificaciones adicionales
• Autónomos con discapacidad: reducciones especiales
• Pluriactividad: si también eres asalariado

Consulta con tu asesor tu situación específica.',
ARRAY['autónomo', 'cuota', 'seguridad social', 'cotización', 'pagar', 'tarifa plana'],
'Real Decreto-ley 13/2022',
8)
ON CONFLICT DO NOTHING;

INSERT INTO user_preferences (user_id)
SELECT id FROM profiles
WHERE NOT EXISTS (
    SELECT 1 FROM user_preferences WHERE user_preferences.user_id = profiles.id
)
ON CONFLICT DO NOTHING;

INSERT INTO notification_settings (user_id)
SELECT id FROM profiles
WHERE NOT EXISTS (
    SELECT 1 FROM notification_settings WHERE notification_settings.user_id = profiles.id
)
ON CONFLICT DO NOTHING;

INSERT INTO user_roles (user_id, rol)
SELECT id, rol FROM profiles
WHERE rol is not null
ON CONFLICT DO NOTHING;

-- ============================================
-- 15. COMMENTS
-- ============================================

COMMENT ON TABLE conversaciones_asistente IS 'Stores E2 Assistant conversation sessions for clients';
COMMENT ON TABLE mensajes_asistente IS 'Individual messages within E2 Assistant conversations';
COMMENT ON TABLE base_conocimiento_e2 IS 'Knowledge base for E2 Assistant with fiscal and labor information';
COMMENT ON TABLE calendario_fiscal IS 'Spanish tax calendar with deadlines and models';
COMMENT ON TABLE recordatorios_fiscales IS 'Client-specific tax reminders based on fiscal calendar';
COMMENT ON COLUMN clientes.tipo_cliente IS 'Type of client: personal (individual) or empresa (company)';
COMMENT ON TABLE documentos_financieros IS 'Mixed financial source documents: P&L, Balance, Ledger, etc.';
COMMENT ON TABLE erp_asientos IS 'ERP accounting entries with seat numbers and matching to invoices';
COMMENT ON TABLE libro_registro IS 'Generated invoice record books (Libro Registro) for each period';
COMMENT ON TABLE verificaciones_ia IS 'AI verification workflow with advisor validation';
COMMENT ON TABLE metricas_ia IS 'AI performance metrics and accuracy tracking';
COMMENT ON TABLE modelos_financieros_cliente IS 'AI-generated financial models per client with ratios and analysis';
COMMENT ON TABLE consultas_financieras IS 'Financial queries handled by E2 Assistant';
COMMENT ON TABLE auditoria_financiera IS 'Audit log for all financial actions in the platform';
COMMENT ON TYPE document_type IS 'Document types: otro, emitida_pdf, recibida_pdf, emitida_excel, recibida_excel';
