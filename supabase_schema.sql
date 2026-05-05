-- ============================================================
-- CONSTRUCTORA S4 — SCHEMA COMPLETO v2.0
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLA: obras
-- ============================================================
CREATE TABLE IF NOT EXISTS obras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    tipo TEXT DEFAULT 'Edificio residencial',
    direccion TEXT,
    cliente TEXT,
    ito TEXT,
    superficie NUMERIC DEFAULT 0,
    responsable TEXT,
    avance NUMERIC DEFAULT 0 CHECK (avance >= 0 AND avance <= 100),
    estado TEXT DEFAULT 'En Progreso',
    n_contrato TEXT,
    fecha_inicio DATE,
    fecha_fin DATE,
    gastos_generales_pct NUMERIC DEFAULT 15,
    utilidad_pct NUMERIC DEFAULT 10,
    descripcion TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLA: presupuesto_items
-- ============================================================
CREATE TABLE IF NOT EXISTS presupuesto_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    codigo TEXT,
    descripcion TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'UN',
    cantidad NUMERIC NOT NULL DEFAULT 0,
    precio_unitario NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLA: compras (facturas de materiales)
-- ============================================================
CREATE TABLE IF NOT EXISTS compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    proveedor TEXT,
    n_documento TEXT,
    descripcion TEXT NOT NULL,
    unidad TEXT NOT NULL DEFAULT 'UN',
    cantidad NUMERIC NOT NULL DEFAULT 0,
    precio_unitario NUMERIC NOT NULL DEFAULT 0,
    fecha DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLA: cotizaciones
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
-- TABLA: subcontratos
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
    avance NUMERIC DEFAULT 0 CHECK (avance >= 0 AND avance <= 100),
    estado TEXT DEFAULT 'Activo',
    contacto TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLA: hitos (cronograma)
-- ============================================================
CREATE TABLE IF NOT EXISTS hitos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    fecha_inicio_plan DATE,
    fecha_fin_plan DATE,
    fecha_real DATE,
    avance NUMERIC DEFAULT 0 CHECK (avance >= 0 AND avance <= 100),
    estado TEXT DEFAULT 'Pendiente',
    responsable TEXT,
    notas TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- TABLA: estados_pago (EPOs)
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
-- TABLA: flujo_caja
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
-- ROW LEVEL SECURITY — Habilitar en todas las tablas
-- ============================================================
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcontratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE hitos ENABLE ROW LEVEL SECURITY;
ALTER TABLE estados_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE flujo_caja ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLÍTICAS RLS — obras
-- ============================================================
DROP POLICY IF EXISTS "obras_select" ON obras;
DROP POLICY IF EXISTS "obras_insert" ON obras;
DROP POLICY IF EXISTS "obras_update" ON obras;
DROP POLICY IF EXISTS "obras_delete" ON obras;

CREATE POLICY "obras_select" ON obras FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "obras_insert" ON obras FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "obras_update" ON obras FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "obras_delete" ON obras FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- MACRO para RLS de tablas relacionadas a obras
-- ============================================================

-- presupuesto_items
DROP POLICY IF EXISTS "pi_select" ON presupuesto_items;
DROP POLICY IF EXISTS "pi_insert" ON presupuesto_items;
DROP POLICY IF EXISTS "pi_update" ON presupuesto_items;
DROP POLICY IF EXISTS "pi_delete" ON presupuesto_items;
CREATE POLICY "pi_select" ON presupuesto_items FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "pi_insert" ON presupuesto_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "pi_update" ON presupuesto_items FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "pi_delete" ON presupuesto_items FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid()));

-- compras
DROP POLICY IF EXISTS "compras_select" ON compras;
DROP POLICY IF EXISTS "compras_insert" ON compras;
DROP POLICY IF EXISTS "compras_update" ON compras;
DROP POLICY IF EXISTS "compras_delete" ON compras;
CREATE POLICY "compras_select" ON compras FOR SELECT USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "compras_insert" ON compras FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "compras_update" ON compras FOR UPDATE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid()));
CREATE POLICY "compras_delete" ON compras FOR DELETE USING (EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid()));

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
