import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clp, today } from '../lib/helpers';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const EMPTY = { obra_id: '', item: '', proveedor: '', monto: '', fecha: today(), dias_validez: '30', forma_pago: 'Contado', estado: 'Pendiente', notas: '' };

export default function Cotizaciones() {
  const [cots, setCots] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filtroObra, setFiltroObra] = useState('');
  const [filtroEst, setFiltroEst] = useState('');

  const fetchData = useCallback(async () => {
    const [{ data: cotsData }, { data: obrasData }] = await Promise.all([
      supabase.from('cotizaciones').select('*, obras(nombre)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ]);
    setCots(cotsData || []);
    setObras(obrasData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('cotizaciones').insert([{ ...form, monto: Number(form.monto), dias_validez: Number(form.dias_validez) }]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchData(); }
    else alert(error.message);
  };

  const handleAprobar = async (id, ok) => {
    await supabase.from('cotizaciones').update({ estado: ok ? 'Aprobada' : 'Rechazada' }).eq('id', id);
    fetchData();
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar cotización?')) return;
    await supabase.from('cotizaciones').delete().eq('id', id);
    fetchData();
  };

  const filtradas = cots.filter(c =>
    (!filtroObra || c.obra_id === filtroObra) &&
    (!filtroEst  || c.estado === filtroEst)
  );

  if (loading) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Cotizaciones</h2><p>Comparativo de ofertas y aprobaciones</p></div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nueva cotización</button>
      </div>
      <div className="pb">
        <div className="fg2" style={{ marginBottom: 12 }}>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text)',padding:'7px 12px',borderRadius:'var(--r2)',fontSize:11 }}>
            <option value="">Todas las obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
          <select value={filtroEst} onChange={e => setFiltroEst(e.target.value)} style={{ background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text)',padding:'7px 12px',borderRadius:'var(--r2)',fontSize:11 }}>
            <option value="">Todos los estados</option>
            {['Pendiente','Aprobada','Rechazada'].map(s => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="card" style={{ padding: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Obra</th><th>Ítem</th><th>Proveedor</th><th>Monto</th>
                  <th>Fecha</th><th>F. Pago</th><th>Estado</th><th>Notas</th><th></th>
                </tr>
              </thead>
              <tbody>
                {filtradas.length === 0 ? (
                  <tr><td colSpan="9" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin cotizaciones</td></tr>
                ) : filtradas.map(c => (
                  <tr key={c.id}>
                    <td className="ts tx">{c.obras?.nombre}</td>
                    <td><strong>{c.item}</strong></td>
                    <td>{c.proveedor}</td>
                    <td className="mono">{clp(c.monto)}</td>
                    <td className="ts">{c.fecha}</td>
                    <td className="ts tx">{c.forma_pago}</td>
                    <td><Badge estado={c.estado}/></td>
                    <td className="ts tx" style={{ maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.notas||'-'}</td>
                    <td>
                      <div style={{ display:'flex',gap:4 }}>
                        {c.estado === 'Pendiente' && <>
                          <button className="btn btn-g btn-sm" onClick={() => handleAprobar(c.id, true)}>✓</button>
                          <button className="btn btn-d btn-sm" onClick={() => handleAprobar(c.id, false)}>✕</button>
                        </>}
                        <button className="btn btn-s btn-sm" onClick={() => handleDelete(c.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="📋 Nueva cotización" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label>OBRA *</label>
                <select required value={form.obra_id} onChange={e => setForm({...form, obra_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>ÍTEM COTIZADO *</label>
                <input required value={form.item} onChange={e => setForm({...form, item: e.target.value})} placeholder="Fierro A630 ø12mm"/>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>PROVEEDOR *</label>
                <input required value={form.proveedor} onChange={e => setForm({...form, proveedor: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>MONTO TOTAL (CLP)</label>
                <input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})}/>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>FECHA</label>
                <input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}/>
              </div>
              <div className="form-group">
                <label>FORMA DE PAGO</label>
                <select value={form.forma_pago} onChange={e => setForm({...form, forma_pago: e.target.value})}>
                  {['Contado','30 días','60 días','50/50','Contra entrega'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>NOTAS</label>
              <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder="Condiciones, plazos..."/>
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
