-- Ejecutar en Supabase SQL Editor
-- Crea la tabla de sub-listas de materiales para cada partida y establece permisos

CREATE TABLE IF NOT EXISTS presupuesto_materiales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    presupuesto_item_id UUID NOT NULL REFERENCES presupuesto_items(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    unidad TEXT DEFAULT 'UN',
    cantidad NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

DROP POLICY IF EXISTS "pm_select" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_insert" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_update" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_delete" ON presupuesto_materiales;

CREATE POLICY "pm_select" ON presupuesto_materiales FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_insert" ON presupuesto_materiales FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pm_update" ON presupuesto_materiales FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "pm_delete" ON presupuesto_materiales FOR DELETE USING (auth.uid() IS NOT NULL);

ALTER TABLE presupuesto_materiales ENABLE ROW LEVEL SECURITY;
