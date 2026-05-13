-- ============================================================
-- MIGRACIÓN — Módulo Gastos Contabilidad (Vía Pegado)
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT rol FROM public.perfiles WHERE id = auth.uid()), 'Usuario')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.current_user_role() IN ('Administrador', 'Gerencia')
$$;

-- 1. COLUMNA centro_costo EN OBRAS
ALTER TABLE obras ADD COLUMN IF NOT EXISTS centro_costo TEXT;
CREATE INDEX IF NOT EXISTS idx_obras_centro_costo ON obras(centro_costo);

-- 2. TABLA aliases_centros_costo
CREATE TABLE IF NOT EXISTS aliases_centros_costo (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
  centro_costo_contabilidad TEXT NOT NULL,
  activo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT uq_alias_cc UNIQUE (centro_costo_contabilidad)
);

-- 3. TABLA movimientos_contables
CREATE TABLE IF NOT EXISTS movimientos_contables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID REFERENCES obras(id) ON DELETE SET NULL,
  centro_costo TEXT,
  clasificacion TEXT,
  cuenta TEXT,
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

CREATE INDEX IF NOT EXISTS idx_mc_obra_id ON movimientos_contables(obra_id);
CREATE INDEX IF NOT EXISTS idx_mc_cc ON movimientos_contables(centro_costo);
CREATE INDEX IF NOT EXISTS idx_mc_hash ON movimientos_contables(hash_unico);

-- 4. RLS TOTALMENTE RELAJADO (Cualquier usuario logueado puede pegar datos)
ALTER TABLE movimientos_contables ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mc_select" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_insert" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_update" ON movimientos_contables;
DROP POLICY IF EXISTS "mc_delete" ON movimientos_contables;

CREATE POLICY "mc_select" ON movimientos_contables FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "mc_insert" ON movimientos_contables FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "mc_update" ON movimientos_contables FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "mc_delete" ON movimientos_contables FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE aliases_centros_costo ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acc_select" ON aliases_centros_costo;
DROP POLICY IF EXISTS "acc_insert" ON aliases_centros_costo;
DROP POLICY IF EXISTS "acc_update" ON aliases_centros_costo;
DROP POLICY IF EXISTS "acc_delete" ON aliases_centros_costo;

CREATE POLICY "acc_select" ON aliases_centros_costo FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "acc_insert" ON aliases_centros_costo FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "acc_update" ON aliases_centros_costo FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "acc_delete" ON aliases_centros_costo FOR DELETE USING (auth.uid() IS NOT NULL);
