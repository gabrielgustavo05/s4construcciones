-- ============================================================
-- MIGRACIÓN v3.0 — Logística y Solicitudes de Material
-- ============================================================

-- 1. Tabla de Perfiles para manejar Roles
CREATE TABLE IF NOT EXISTS perfiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT,
    rol TEXT DEFAULT 'Administrador', -- 'Administrador', 'Jefe de Obra', 'Camionero'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabla de Solicitudes de Material
CREATE TABLE IF NOT EXISTS solicitudes_material (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    solicitado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    titulo TEXT NOT NULL,
    foto_pedido_url TEXT, -- Foto de la lista escrita a mano
    estado TEXT DEFAULT 'Pendiente', -- 'Pendiente', 'Comprado', 'En Ruta', 'Entregado', 'Rechazado'
    urgencia TEXT DEFAULT 'Normal', -- 'Normal' (48h), 'Urgente' (24h)
    
    -- Datos de Gestión (Cargados por Admin)
    monto_total NUMERIC DEFAULT 0,
    foto_factura_url TEXT, -- Foto de la boleta/factura
    lugar_retiro TEXT,
    detalles_compra TEXT, -- Resumen de lo comprado
    
    -- Logística (Cargada por Camionero/Admin)
    fecha_prometida TIMESTAMP WITH TIME ZONE, -- Fecha en el calendario
    comentario_logistico TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Habilitar RLS
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitudes_material ENABLE ROW LEVEL SECURITY;

-- 4. Políticas para perfiles
DROP POLICY IF EXISTS "perfiles_select_all" ON perfiles;
CREATE POLICY "perfiles_select_all" ON perfiles FOR SELECT USING (true);
DROP POLICY IF EXISTS "perfiles_update_own" ON perfiles;
CREATE POLICY "perfiles_update_own" ON perfiles FOR UPDATE USING (auth.uid() = id);

-- 5. Políticas para solicitudes_material
DROP POLICY IF EXISTS "sol_select" ON solicitudes_material;
CREATE POLICY "sol_select" ON solicitudes_material FOR SELECT USING (true); -- Permitir ver a todos los autenticados por ahora para simplificar

DROP POLICY IF EXISTS "sol_insert" ON solicitudes_material;
CREATE POLICY "sol_insert" ON solicitudes_material FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "sol_update" ON solicitudes_material;
CREATE POLICY "sol_update" ON solicitudes_material FOR UPDATE USING (true);

-- 6. Insertar perfil para el administrador actual si no existe
-- (Esto se ejecutará cuando el usuario entre, pero dejamos la estructura lista)
