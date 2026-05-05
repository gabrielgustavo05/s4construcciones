import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clp, today } from '../lib/helpers';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const EMPTY = { obra_id:'', numero:'', descripcion:'', monto_bruto:'', retencion_pct:'5', fecha_emision: today(), fecha_pago_estimada:'', estado:'Emitido' };

export default function EstadosPago() {
  const [eps, setEps] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const fetchData = useCallback(async () => {
    const [{ data: epsData }, { data: obrasData }] = await Promise.all([
      supabase.from('estados_pago').select('*, obras(nombre)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ]);
    setEps(epsData || []);
    setObras(obrasData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...form, monto_bruto: Number(form.monto_bruto), retencion_pct: Number(form.retencion_pct) };
    const { error } = await supabase.from('estados_pago').insert([payload]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchData(); }
    else alert(error.message);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar estado de pago?')) return;
    await supabase.from('estados_pago').delete().eq('id', id);
    fetchData();
  };

  const totalCobrado = eps.filter(e => e.estado === 'Pagado').reduce((s, e) => s + (e.monto_bruto - Math.round(e.monto_bruto * e.retencion_pct / 100)), 0);
  const totalPendiente = eps.filter(e => e.estado !== 'Pagado').reduce((s, e) => s + e.monto_bruto, 0);

  if (loading) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Estados de Pago</h2><p>Emisión, seguimiento y cobranza de EPOs</p></div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nuevo EPO</button>
      </div>
      <div className="pb">
        <div className="stats-grid" style={{ marginBottom: 14 }}>
          <div className="stat-card green"><span className="stat-label">Total cobrado</span><span className="stat-value" style={{ fontSize:14 }}>{clp(totalCobrado)}</span></div>
          <div className="stat-card amber"><span className="stat-label">Por cobrar</span><span className="stat-value" style={{ fontSize:14 }}>{clp(totalPendiente)}</span></div>
          <div className="stat-card blue"><span className="stat-label">Total EPOs</span><span className="stat-value">{eps.length}</span></div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Obra</th><th>EPO N°</th><th>Descripción</th><th>Monto bruto</th><th>Retención</th><th>Neto</th><th>F. Emisión</th><th>F. Pago est.</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {eps.length === 0 ? (
                  <tr><td colSpan="10" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin estados de pago</td></tr>
                ) : eps.map(ep => {
                  const ret = Math.round(ep.monto_bruto * ep.retencion_pct / 100);
                  const neto = ep.monto_bruto - ret;
                  return (
                    <tr key={ep.id}>
                      <td className="ts tx">{ep.obras?.nombre}</td>
                      <td><strong>{ep.numero}</strong></td>
                      <td className="ts">{ep.descripcion}</td>
                      <td className="mono">{clp(ep.monto_bruto)}</td>
                      <td className="mono ta">{clp(ret)}</td>
                      <td className="mono tg">{clp(neto)}</td>
                      <td className="ts">{ep.fecha_emision}</td>
                      <td className="ts">{ep.fecha_pago_estimada||'-'}</td>
                      <td><Badge estado={ep.estado}/></td>
                      <td><button className="btn btn-d btn-sm" onClick={() => handleDelete(ep.id)}>🗑</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="💰 Nuevo estado de pago" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group"><label>OBRA *</label>
                <select required value={form.obra_id} onChange={e => setForm({...form, obra_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>EPO N°</label><input value={form.numero} onChange={e => setForm({...form, numero: e.target.value})} placeholder="EPO-001"/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>DESCRIPCIÓN *</label><input required value={form.descripcion} onChange={e => setForm({...form, descripcion: e.target.value})} placeholder="Avance estructura pisos 1-4"/></div>
              <div className="form-group"><label>MONTO BRUTO (CLP)</label><input type="number" value={form.monto_bruto} onChange={e => setForm({...form, monto_bruto: e.target.value})}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>% RETENCIÓN</label><input type="number" value={form.retencion_pct} onChange={e => setForm({...form, retencion_pct: e.target.value})}/></div>
              <div className="form-group"><label>ESTADO</label>
                <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  {['Emitido','En revisión','Aprobado','Pagado','Rechazado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>FECHA EMISIÓN</label><input type="date" value={form.fecha_emision} onChange={e => setForm({...form, fecha_emision: e.target.value})}/></div>
              <div className="form-group"><label>FECHA PAGO EST.</label><input type="date" value={form.fecha_pago_estimada} onChange={e => setForm({...form, fecha_pago_estimada: e.target.value})}/></div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
