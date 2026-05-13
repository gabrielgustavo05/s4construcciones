-- ============================================================
-- MIGRACIÓN — Grupos y Movimientos Contables (Vía Pegado en Detalle)
-- ============================================================

-- 1. TABLA cuentas_obra (Los "Grupos")
CREATE TABLE IF NOT EXISTS cuentas_obra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  clasificacion TEXT DEFAULT 'Gastos',
  cuenta TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_cuenta_obra UNIQUE (obra_id, cuenta)
);

-- 2. TABLA movimientos_contables (El "Detalle Pegado")
DROP TABLE IF EXISTS movimientos_contables CASCADE;
CREATE TABLE movimientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cuenta_obra_id UUID NOT NULL REFERENCES cuentas_obra(id) ON DELETE CASCADE,
  fecha DATE,
  tipo_v TEXT,
  numero_comprobante TEXT,
  glosa TEXT,
  numero_documento TEXT,
  tipo_documento TEXT,
  rut_proveedor TEXT,
  nombre_proveedor TEXT,
  debe NUMERIC DEFAULT 0,
  haber NUMERIC DEFAULT 0,
  saldo NUMERIC DEFAULT 0,
  hash_unico TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_mc_cuenta_obra ON movimientos_contables(cuenta_obra_id);
CREATE INDEX idx_mc_hash ON movimientos_contables(hash_unico);

-- 3. RLS RELAJADO (Cualquier usuario autenticado puede gestionar)
ALTER TABLE cuentas_obra ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "co_select" ON cuentas_obra;
DROP POLICY IF EXISTS "co_insert" ON cuentas_obra;
DROP POLICY IF EXISTS "co_update" ON cuentas_obra;
DROP POLICY IF EXISTS "co_delete" ON cuentas_obra;
CREATE POLICY "co_select" ON cuentas_obra FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "co_insert" ON cuentas_obra FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "co_update" ON cuentas_obra FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "co_delete" ON cuentas_obra FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE movimientos_contables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mc_select" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_insert" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_update" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_delete" ON movimientos_contables;
CREATE POLICY "mc_select" ON movimientos_contables FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mc_insert" ON movimientos_contables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mc_update" ON movimientos_contables FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "mc_delete" ON movimientos_contables FOR DELETE USING (auth.uid() IS NOT NULL);
