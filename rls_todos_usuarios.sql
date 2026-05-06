-- Ejecutar en Supabase SQL Editor
-- Permite que TODOS los usuarios autenticados vean y editen todos los datos

DROP POLICY IF EXISTS "obras_select" ON obras;
DROP POLICY IF EXISTS "obras_insert" ON obras;
DROP POLICY IF EXISTS "obras_update" ON obras;
DROP POLICY IF EXISTS "obras_delete" ON obras;
CREATE POLICY "obras_select" ON obras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "obras_insert" ON obras FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "obras_update" ON obras FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "obras_delete" ON obras FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "pres_select" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_insert" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_update" ON presupuesto_items;
DROP POLICY IF EXISTS "pres_delete" ON presupuesto_items;
CREATE POLICY "pres_select" ON presupuesto_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "pres_insert" ON presupuesto_items FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pres_update" ON presupuesto_items FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "pres_delete" ON presupuesto_items FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "comp_select" ON compras;
DROP POLICY IF EXISTS "comp_insert" ON compras;
DROP POLICY IF EXISTS "comp_update" ON compras;
DROP POLICY IF EXISTS "comp_delete" ON compras;
CREATE POLICY "comp_select" ON compras FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "comp_insert" ON compras FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "comp_update" ON compras FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "comp_delete" ON compras FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "cot_select" ON cotizaciones;
DROP POLICY IF EXISTS "cot_insert" ON cotizaciones;
DROP POLICY IF EXISTS "cot_update" ON cotizaciones;
DROP POLICY IF EXISTS "cot_delete" ON cotizaciones;
CREATE POLICY "cot_select" ON cotizaciones FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "cot_insert" ON cotizaciones FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "cot_update" ON cotizaciones FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "cot_delete" ON cotizaciones FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "sub_select" ON subcontratos;
DROP POLICY IF EXISTS "sub_insert" ON subcontratos;
DROP POLICY IF EXISTS "sub_update" ON subcontratos;
DROP POLICY IF EXISTS "sub_delete" ON subcontratos;
CREATE POLICY "sub_select" ON subcontratos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "sub_insert" ON subcontratos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "sub_update" ON subcontratos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "sub_delete" ON subcontratos FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "hit_select" ON hitos;
DROP POLICY IF EXISTS "hit_insert" ON hitos;
DROP POLICY IF EXISTS "hit_update" ON hitos;
DROP POLICY IF EXISTS "hit_delete" ON hitos;
CREATE POLICY "hit_select" ON hitos FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "hit_insert" ON hitos FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "hit_update" ON hitos FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "hit_delete" ON hitos FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ep_select" ON estados_pago;
DROP POLICY IF EXISTS "ep_insert" ON estados_pago;
DROP POLICY IF EXISTS "ep_update" ON estados_pago;
DROP POLICY IF EXISTS "ep_delete" ON estados_pago;
CREATE POLICY "ep_select" ON estados_pago FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "ep_insert" ON estados_pago FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ep_update" ON estados_pago FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "ep_delete" ON estados_pago FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "fc_select" ON flujo_caja;
DROP POLICY IF EXISTS "fc_insert" ON flujo_caja;
DROP POLICY IF EXISTS "fc_update" ON flujo_caja;
DROP POLICY IF EXISTS "fc_delete" ON flujo_caja;
CREATE POLICY "fc_select" ON flujo_caja FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "fc_insert" ON flujo_caja FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "fc_update" ON flujo_caja FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "fc_delete" ON flujo_caja FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "trab_select" ON trabajadores;
DROP POLICY IF EXISTS "trab_insert" ON trabajadores;
DROP POLICY IF EXISTS "trab_update" ON trabajadores;
DROP POLICY IF EXISTS "trab_delete" ON trabajadores;
CREATE POLICY "trab_select" ON trabajadores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "trab_insert" ON trabajadores FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "trab_update" ON trabajadores FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "trab_delete" ON trabajadores FOR DELETE USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "asis_select" ON asistencia;
DROP POLICY IF EXISTS "asis_insert" ON asistencia;
DROP POLICY IF EXISTS "asis_update" ON asistencia;
DROP POLICY IF EXISTS "asis_delete" ON asistencia;
CREATE POLICY "asis_select" ON asistencia FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "asis_insert" ON asistencia FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "asis_update" ON asistencia FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "asis_delete" ON asistencia FOR DELETE USING (auth.uid() IS NOT NULL);
