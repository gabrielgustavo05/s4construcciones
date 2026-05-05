-- ============================================================
-- MIGRACIÓN v2.0 — Constructora S4
-- Ejecutar en Supabase SQL Editor
-- Agrega columnas nuevas a tablas existentes y crea tablas nuevas
-- ============================================================

-- ============================================================
-- 1. AGREGAR COLUMNAS NUEVAS A TABLA obras (ya existente)
-- ============================================================
ALTER TABLE obras ADD COLUMN IF NOT EXISTS tipo TEXT DEFAULT 'Edificio residencial';
ALTER TABLE obras ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS ito TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS superficie NUMERIC DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS responsable TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS avance NUMERIC DEFAULT 0;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS n_contrato TEXT;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fecha_inicio DATE;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS fecha_fin DATE;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS gastos_generales_pct NUMERIC DEFAULT 15;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS utilidad_pct NUMERIC DEFAULT 10;
ALTER TABLE obras ADD COLUMN IF NOT EXISTS descripcion TEXT;

-- Constraint de avance (0-100) solo si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'obras_avance_check'
  ) THEN
    ALTER TABLE obras ADD CONSTRAINT obras_avance_check CHECK (avance >= 0 AND avance <= 100);
  END IF;
END $$;

-- ============================================================
-- 2. AGREGAR COLUMNA codigo A presupuesto_items (ya existente)
-- ============================================================
ALTER TABLE presupuesto_items ADD COLUMN IF NOT EXISTS codigo TEXT;

-- ============================================================
-- 3. CREAR TABLA cotizaciones (nueva)
-- ============================================================
CREATE TABLE IF NOT EXISTS cotizaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    proveedor TEXT NOT NULL,
    monto NUMERIC DEFAULT 0,
    fecha DATE DEFAULT CURRENT_DATE,
    dias_validez INTEGER DEFAULT 30,
    forma_pago TEXT DEFAULT 'Contado',
    estado TEXT DEFAULT 'Pendiente',
    aprobado_por TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 4. CREAR TABLA subcontratos (nueva)
-- ============================================================
CREATE TABLE IF NOT EXISTS subcontratos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    empresa TEXT NOT NULL,
    rut TEXT,
    especialidad TEXT,
    monto_contrato NUMERIC DEFAULT 0,
    retencion_pct NUMERIC DEFAULT 5,
    monto_pagado NUMERIC DEFAULT 0,
    avance NUMERIC DEFAULT 0,
    estado TEXT DEFAULT 'Activo',
    contacto TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 5. CREAR TABLA hitos (nueva)
-- ============================================================
CREATE TABLE IF NOT EXISTS hitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    fecha_inicio_plan DATE,
    fecha_fin_plan DATE,
    fecha_real DATE,
    avance NUMERIC DEFAULT 0,
    estado TEXT DEFAULT 'Pendiente',
    responsable TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 6. CREAR TABLA estados_pago (nueva)
-- ============================================================
CREATE TABLE IF NOT EXISTS estados_pago (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    numero TEXT NOT NULL,
    descripcion TEXT,
    monto_bruto NUMERIC DEFAULT 0,
    retencion_pct NUMERIC DEFAULT 5,
    fecha_emision DATE DEFAULT CURRENT_DATE,
    fecha_pago_estimada DATE,
    estado TEXT DEFAULT 'Emitido',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 7. CREAR TABLA flujo_caja (nueva)
-- ============================================================
CREATE TABLE IF NOT EXISTS flujo_caja (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('ingreso', 'egreso')),
    concepto TEXT NOT NULL,
    categoria TEXT DEFAULT 'Otro',
    monto NUMERIC NOT NULL DEFAULT 0,
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- 8. RLS EN TABLAS NUEVAS
-- ============================================================
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE flujo_caja ENABLE ROW LEVEL SECURITY;

-- cotizaciones
DROP POLICY IF EXISTS "cot_select" ON cotizaciones;
DROP POLICY IF EXISTS "cot_insert" ON cotizaciones;
DROP POLICY IF EXISTS "cot_update" ON cotizaciones;
DROP POLICY IF EXISTS "cot_delete" ON cotizaciones;
CREATE POLICY "cot_select" ON cotizaciones FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = cotizaciones.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "cot_insert" ON cotizaciones FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = cotizaciones.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "cot_update" ON cotizaciones FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = cotizaciones.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "cot_delete" ON cotizaciones FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = cotizaciones.obra_id AND obras.user_id = auth.uid()));

-- subcontratos
DROP POLICY IF EXISTS "sub_select" ON subcontratos;
DROP POLICY IF EXISTS "sub_insert" ON subcontratos;
DROP POLICY IF EXISTS "sub_update" ON subcontratos;
DROP POLICY IF EXISTS "sub_delete" ON subcontratos;
CREATE POLICY "sub_select" ON subcontratos FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = subcontratos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "sub_insert" ON subcontratos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = subcontratos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "sub_update" ON subcontratos FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = subcontratos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "sub_delete" ON subcontratos FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = subcontratos.obra_id AND obras.user_id = auth.uid()));

-- hitos
DROP POLICY IF EXISTS "hit_select" ON hitos;
DROP POLICY IF EXISTS "hit_insert" ON hitos;
DROP POLICY IF EXISTS "hit_update" ON hitos;
DROP POLICY IF EXISTS "hit_delete" ON hitos;
CREATE POLICY "hit_select" ON hitos FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = hitos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "hit_insert" ON hitos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = hitos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "hit_update" ON hitos FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = hitos.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "hit_delete" ON hitos FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = hitos.obra_id AND obras.user_id = auth.uid()));

-- estados_pago
DROP POLICY IF EXISTS "ep_select" ON estados_pago;
DROP POLICY IF EXISTS "ep_insert" ON estados_pago;
DROP POLICY IF EXISTS "ep_update" ON estados_pago;
DROP POLICY IF EXISTS "ep_delete" ON estados_pago;
CREATE POLICY "ep_select" ON estados_pago FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = estados_pago.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "ep_insert" ON estados_pago FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = estados_pago.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "ep_update" ON estados_pago FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = estados_pago.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "ep_delete" ON estados_pago FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = estados_pago.obra_id AND obras.user_id = auth.uid()));

-- flujo_caja
DROP POLICY IF EXISTS "fc_select" ON flujo_caja;
DROP POLICY IF EXISTS "fc_insert" ON flujo_caja;
DROP POLICY IF EXISTS "fc_update" ON flujo_caja;
DROP POLICY IF EXISTS "fc_delete" ON flujo_caja;
CREATE POLICY "fc_select" ON flujo_caja FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = flujo_caja.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "fc_insert" ON flujo_caja FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = flujo_caja.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "fc_update" ON flujo_caja FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = flujo_caja.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "fc_delete" ON flujo_caja FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = flujo_caja.obra_id AND obras.user_id = auth.uid()));
