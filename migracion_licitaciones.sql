-- ============================================================
-- MIGRACION MODULO LICITACIONES - Constructora S4
-- Ejecutar en Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS licitaciones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre_licitacion TEXT NOT NULL,
    cliente TEXT,
    direccion TEXT,
    fecha_recepcion DATE,
    fecha_entrega DATE NOT NULL,
    responsable TEXT,
    estado TEXT NOT NULL DEFAULT 'En estudio',
    observaciones TEXT,
    clima_estado TEXT NOT NULL DEFAULT 'Pendiente de enviar',
    clima_fecha_envio DATE,
    clima_fecha_recepcion DATE,
    incendio_estado TEXT NOT NULL DEFAULT 'Pendiente de enviar',
    incendio_fecha_envio DATE,
    incendio_fecha_recepcion DATE,
    mobiliario_estado TEXT NOT NULL DEFAULT 'Pendiente de enviar',
    mobiliario_fecha_envio DATE,
    mobiliario_fecha_recepcion DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS nombre_licitacion TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS cliente TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS fecha_recepcion DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS fecha_entrega DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS responsable TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'En estudio';
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS observaciones TEXT;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS clima_estado TEXT DEFAULT 'Pendiente de enviar';
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS clima_fecha_envio DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS clima_fecha_recepcion DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS incendio_estado TEXT DEFAULT 'Pendiente de enviar';
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS incendio_fecha_envio DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS incendio_fecha_recepcion DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS mobiliario_estado TEXT DEFAULT 'Pendiente de enviar';
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS mobiliario_fecha_envio DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS mobiliario_fecha_recepcion DATE;
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());
ALTER TABLE licitaciones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_estado_check'
  ) THEN
    ALTER TABLE licitaciones ADD CONSTRAINT licitaciones_estado_check
      CHECK (estado IN ('En estudio', 'En cotizacion', 'Lista para enviar', 'Enviada', 'Adjudicada', 'Perdida', 'Cerrada'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_nombre_required'
  ) THEN
    ALTER TABLE licitaciones ADD CONSTRAINT licitaciones_nombre_required
      CHECK (length(trim(coalesce(nombre_licitacion, ''))) > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_clima_estado_check'
  ) THEN
    ALTER TABLE licitaciones ADD CONSTRAINT licitaciones_clima_estado_check
      CHECK (clima_estado IN ('Pendiente de enviar', 'Enviada a cotizar', 'Cotizacion recibida', 'No aplica'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_incendio_estado_check'
  ) THEN
    ALTER TABLE licitaciones ADD CONSTRAINT licitaciones_incendio_estado_check
      CHECK (incendio_estado IN ('Pendiente de enviar', 'Enviada a cotizar', 'Cotizacion recibida', 'No aplica'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'licitaciones_mobiliario_estado_check'
  ) THEN
    ALTER TABLE licitaciones ADD CONSTRAINT licitaciones_mobiliario_estado_check
      CHECK (mobiliario_estado IN ('Pendiente de enviar', 'Enviada a cotizar', 'Cotizacion recibida', 'No aplica'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_licitaciones_user_estado ON licitaciones(user_id, estado);
CREATE INDEX IF NOT EXISTS idx_licitaciones_fecha_entrega ON licitaciones(fecha_entrega);

CREATE OR REPLACE FUNCTION set_licitaciones_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licitaciones_updated_at ON licitaciones;
CREATE TRIGGER trg_licitaciones_updated_at
BEFORE UPDATE ON licitaciones
FOR EACH ROW
EXECUTE FUNCTION set_licitaciones_updated_at();

ALTER TABLE licitaciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lic_select" ON licitaciones;
DROP POLICY IF EXISTS "lic_insert" ON licitaciones;
DROP POLICY IF EXISTS "lic_update" ON licitaciones;
DROP POLICY IF EXISTS "lic_delete" ON licitaciones;

CREATE POLICY "lic_select" ON licitaciones
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "lic_insert" ON licitaciones
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lic_update" ON licitaciones
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "lic_delete" ON licitaciones
  FOR DELETE USING (auth.uid() = user_id);

-- Preparacion futura:
-- - Crear licitacion_especialidades para especialidades dinamicas.
-- - Crear licitacion_adjuntos para planos, EETT, cubicaciones y cartas oferta.
-- - Crear licitacion_proveedores para trazabilidad de cotizaciones externas.
-- - Agregar monto_estimado, margen_objetivo y probabilidad_adjudicacion cuando se requiera.
