-- ============================================================
-- HARDENING RLS - Constructora S4
-- Ejecutar en Supabase SQL Editor despues de respaldar.
-- Objetivo: reemplazar politicas abiertas por acceso autenticado
-- asociado a la obra y roles basicos de perfil.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT rol FROM public.perfiles WHERE id = auth.uid()), 'Usuario')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.current_user_role() IN ('Administrador', 'Gerencia')
$$;

-- OBRAS
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "obras_select" ON obras;
DROP POLICY IF EXISTS "obras_insert" ON obras;
DROP POLICY IF EXISTS "obras_update" ON obras;
DROP POLICY IF EXISTS "obras_delete" ON obras;
CREATE POLICY "obras_select" ON obras FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "obras_insert" ON obras FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "obras_update" ON obras FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "obras_delete" ON obras FOR DELETE USING (public.is_admin());

-- PRESUPUESTO
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pres_select" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_insert" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_update" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_delete" ON presupuesto_items;
CREATE POLICY "pres_select" ON presupuesto_items FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_items.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pres_insert" ON presupuesto_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_items.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pres_update" ON presupuesto_items FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_items.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_items.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pres_delete" ON presupuesto_items FOR DELETE USING (public.is_admin() OR EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_items.obra_id AND o.user_id = auth.uid()));

-- COMPRAS
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "comp_select" ON compras;
DROP POLICY IF EXISTS "comp_insert" ON compras;
DROP POLICY IF EXISTS "comp_update" ON compras;
DROP POLICY IF EXISTS "comp_delete" ON compras;
CREATE POLICY "comp_select" ON compras FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = compras.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "comp_insert" ON compras FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = compras.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "comp_update" ON compras FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = compras.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = compras.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "comp_delete" ON compras FOR DELETE USING (public.is_admin());

-- TABLAS POR OBRA
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['cotizaciones', 'subcontratos', 'hitos', 'estados_pago', 'flujo_caja', 'asistencia', 'solicitudes_material', 'presupuesto_materiales']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

-- COTIZACIONES
DROP POLICY IF EXISTS "cot_select" ON cotizaciones;
DROP POLICY IF EXISTS "cot_insert" ON cotizaciones;
DROP POLICY IF EXISTS "cot_update" ON cotizaciones;
DROP POLICY IF EXISTS "cot_delete" ON cotizaciones;
CREATE POLICY "cot_select" ON cotizaciones FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = cotizaciones.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "cot_insert" ON cotizaciones FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = cotizaciones.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "cot_update" ON cotizaciones FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = cotizaciones.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = cotizaciones.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "cot_delete" ON cotizaciones FOR DELETE USING (public.is_admin());

-- SUBCONTRATOS
DROP POLICY IF EXISTS "sub_select" ON subcontratos;
DROP POLICY IF EXISTS "sub_insert" ON subcontratos;
DROP POLICY IF EXISTS "sub_update" ON subcontratos;
DROP POLICY IF EXISTS "sub_delete" ON subcontratos;
CREATE POLICY "sub_select" ON subcontratos FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = subcontratos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sub_insert" ON subcontratos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = subcontratos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sub_update" ON subcontratos FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = subcontratos.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = subcontratos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sub_delete" ON subcontratos FOR DELETE USING (public.is_admin());

-- HITOS
DROP POLICY IF EXISTS "hit_select" ON hitos;
DROP POLICY IF EXISTS "hit_insert" ON hitos;
DROP POLICY IF EXISTS "hit_update" ON hitos;
DROP POLICY IF EXISTS "hit_delete" ON hitos;
CREATE POLICY "hit_select" ON hitos FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = hitos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "hit_insert" ON hitos FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = hitos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "hit_update" ON hitos FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = hitos.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = hitos.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "hit_delete" ON hitos FOR DELETE USING (public.is_admin());

-- ESTADOS DE PAGO
DROP POLICY IF EXISTS "ep_select" ON estados_pago;
DROP POLICY IF EXISTS "ep_insert" ON estados_pago;
DROP POLICY IF EXISTS "ep_update" ON estados_pago;
DROP POLICY IF EXISTS "ep_delete" ON estados_pago;
CREATE POLICY "ep_select" ON estados_pago FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = estados_pago.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "ep_insert" ON estados_pago FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = estados_pago.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "ep_update" ON estados_pago FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = estados_pago.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = estados_pago.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "ep_delete" ON estados_pago FOR DELETE USING (public.is_admin());

-- FLUJO DE CAJA
DROP POLICY IF EXISTS "fc_select" ON flujo_caja;
DROP POLICY IF EXISTS "fc_insert" ON flujo_caja;
DROP POLICY IF EXISTS "fc_update" ON flujo_caja;
DROP POLICY IF EXISTS "fc_delete" ON flujo_caja;
CREATE POLICY "fc_select" ON flujo_caja FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = flujo_caja.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "fc_insert" ON flujo_caja FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = flujo_caja.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "fc_update" ON flujo_caja FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = flujo_caja.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = flujo_caja.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "fc_delete" ON flujo_caja FOR DELETE USING (public.is_admin());

-- ASISTENCIA
DROP POLICY IF EXISTS "asis_select" ON asistencia;
DROP POLICY IF EXISTS "asis_insert" ON asistencia;
DROP POLICY IF EXISTS "asis_update" ON asistencia;
DROP POLICY IF EXISTS "asis_delete" ON asistencia;
CREATE POLICY "asis_select" ON asistencia FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = asistencia.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "asis_insert" ON asistencia FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = asistencia.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "asis_update" ON asistencia FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = asistencia.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = asistencia.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "asis_delete" ON asistencia FOR DELETE USING (public.is_admin());

-- SOLICITUDES DE MATERIAL
DROP POLICY IF EXISTS "sol_select" ON solicitudes_material;
DROP POLICY IF EXISTS "sol_insert" ON solicitudes_material;
DROP POLICY IF EXISTS "sol_update" ON solicitudes_material;
DROP POLICY IF EXISTS "sol_delete" ON solicitudes_material;
CREATE POLICY "sol_select" ON solicitudes_material FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = solicitudes_material.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sol_insert" ON solicitudes_material FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = solicitudes_material.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sol_update" ON solicitudes_material FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = solicitudes_material.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = solicitudes_material.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "sol_delete" ON solicitudes_material FOR DELETE USING (public.is_admin());

-- PRESUPUESTO MATERIALES
DROP POLICY IF EXISTS "pm_select" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_insert" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_update" ON presupuesto_materiales;
DROP POLICY IF EXISTS "pm_delete" ON presupuesto_materiales;
CREATE POLICY "pm_select" ON presupuesto_materiales FOR SELECT USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_materiales.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pm_insert" ON presupuesto_materiales FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_materiales.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pm_update" ON presupuesto_materiales FOR UPDATE USING (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_materiales.obra_id AND (o.user_id = auth.uid() OR public.is_admin()))) WITH CHECK (EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_materiales.obra_id AND (o.user_id = auth.uid() OR public.is_admin())));
CREATE POLICY "pm_delete" ON presupuesto_materiales FOR DELETE USING (public.is_admin() OR EXISTS (SELECT 1 FROM obras o WHERE o.id = presupuesto_materiales.obra_id AND o.user_id = auth.uid()));

-- TRABAJADORES
ALTER TABLE trabajadores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "trab_select" ON trabajadores;
DROP POLICY IF EXISTS "trab_insert" ON trabajadores;
DROP POLICY IF EXISTS "trab_update" ON trabajadores;
DROP POLICY IF EXISTS "trab_delete" ON trabajadores;
CREATE POLICY "trab_select" ON trabajadores FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "trab_insert" ON trabajadores FOR INSERT WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "trab_update" ON trabajadores FOR UPDATE USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "trab_delete" ON trabajadores FOR DELETE USING (public.is_admin());

-- PERFILES
ALTER TABLE perfiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "perfiles_select_all" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update_own" ON perfiles;
DROP POLICY IF EXISTS "perfiles_select" ON perfiles;
DROP POLICY IF EXISTS "perfiles_update" ON perfiles;
CREATE POLICY "perfiles_select" ON perfiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "perfiles_update" ON perfiles FOR UPDATE USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());

-- Indices recomendados para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_obras_user_id ON obras(user_id);
CREATE INDEX IF NOT EXISTS idx_presupuesto_items_obra_codigo ON presupuesto_items(obra_id, codigo);
CREATE INDEX IF NOT EXISTS idx_compras_obra_fecha ON compras(obra_id, fecha);
CREATE INDEX IF NOT EXISTS idx_compras_presupuesto_item ON compras(presupuesto_item_id);
CREATE INDEX IF NOT EXISTS idx_estados_pago_obra_estado ON estados_pago(obra_id, estado);
CREATE INDEX IF NOT EXISTS idx_solicitudes_material_obra_estado ON solicitudes_material(obra_id, estado, created_at);
