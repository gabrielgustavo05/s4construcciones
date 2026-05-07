-- Ejecutar en Supabase SQL Editor
-- Crea la tabla de sub-listas de materiales para cada partida y establece permisos

CREATE TABLE IF NOT EXISTS presupuesto_materiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID REFERENCES obras(id) ON DELETE CASCADE,
    presupuesto_item_id UUID REFERENCES presupuesto_items(id) ON DELETE SET NULL,
    descripcion TEXT NOT NULL,
    unidad TEXT DEFAULT 'UN',
    cantidad NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE presupuesto_materiales ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES obras(id) ON DELETE CASCADE;

UPDATE presupuesto_materiales pm
SET obra_id = pi.obra_id
FROM presupuesto_items pi
WHERE pm.presupuesto_item_id = pi.id
  AND pm.obra_id IS NULL;

ALTER TABLE presupuesto_materiales ALTER COLUMN presupuesto_item_id DROP NOT NULL;

DO $$
DECLARE
    constraint_name text;
BEGIN
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND tc.table_name = 'presupuesto_materiales'
      AND kcu.column_name = 'presupuesto_item_id'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE format('ALTER TABLE presupuesto_materiales DROP CONSTRAINT %I', constraint_name);
    END IF;
END $$;

ALTER TABLE presupuesto_materiales
ADD CONSTRAINT presupuesto_materiales_presupuesto_item_id_fkey
FOREIGN KEY (presupuesto_item_id) REFERENCES presupuesto_items(id) ON DELETE SET NULL;

DROP POLICY IF EXISTS "pm_select" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_insert" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_update" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_delete" ON presupuesto_materiales;

CREATE POLICY "pm_select" ON presupuesto_materiales FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_insert" ON presupuesto_materiales FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pm_update" ON presupuesto_materiales FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_delete" ON presupuesto_materiales FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE presupuesto_materiales ENABLE ROW LEVEL SECURITY;
