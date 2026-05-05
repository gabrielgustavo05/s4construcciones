import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clp, today } from '../lib/helpers';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const EMPTY = { obra_id:'', empresa:'', rut:'', especialidad:'Estructura', monto_contrato:'', retencion_pct:'5', monto_pagado:'0', avance:'0', estado:'Activo', contacto:'' };
const ESPECIALIDADES = ['Estructura','Hormigón armado','Gasfitería','Electricidad','HVAC','Terminaciones','Pintura','Ascensores','Vidriería','Otros'];

export default function Subcontratos() {
  const [subs, setSubs] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);

  const fetchData = useCallback(async () => {
    const [{ data: subsData }, { data: obrasData }] = await Promise.all([
      supabase.from('subcontratos').select('*, obras(nombre)').order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ]);
    setSubs(subsData || []);
    setObras(obrasData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...form, monto_contrato: Number(form.monto_contrato), retencion_pct: Number(form.retencion_pct), monto_pagado: Number(form.monto_pagado), avance: Number(form.avance) };
    const { error } = await supabase.from('subcontratos').insert([payload]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchData(); }
    else alert(error.message);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar subcontrato?')) return;
    await supabase.from('subcontratos').delete().eq('id', id);
    fetchData();
  };

  if (loading) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Subcontratos</h2><p>Empresas, contratos y pagos</p></div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nuevo subcontrato</button>
      </div>
      <div className="pb">
        <div className="card" style={{ padding: 0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Obra</th><th>Empresa</th><th>RUT</th><th>Especialidad</th><th>Contrato</th><th>Avance</th><th>Pagado</th><th>Retención</th><th>Saldo</th><th>Estado</th><th></th></tr>
              </thead>
              <tbody>
                {subs.length === 0 ? (
                  <tr><td colSpan="11" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin subcontratos</td></tr>
                ) : subs.map(s => {
                  const ret = Math.round(s.monto_contrato * s.retencion_pct / 100);
                  const saldo = Math.max(0, s.monto_contrato - s.monto_pagado);
                  return (
                    <tr key={s.id}>
                      <td className="ts tx">{s.obras?.nombre}</td>
                      <td><strong>{s.empresa}</strong></td>
                      <td className="ts tx mono">{s.rut||'-'}</td>
                      <td><span style={{ background:'var(--bg4)',padding:'2px 7px',borderRadius:4,fontSize:10,fontWeight:600,color:'var(--text2)' }}>{s.especialidad}</span></td>
                      <td className="mono">{clp(s.monto_contrato)}</td>
                      <td>
                        <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                          <div className="pb2" style={{ width:50 }}><div className="pf" style={{ width:`${s.avance}%`,background:'var(--green)' }}/></div>
                          <span className="ts">{s.avance}%</span>
                        </div>
                      </td>
                      <td className="mono tg">{clp(s.monto_pagado)}</td>
                      <td className="mono ta">{clp(ret)}</td>
                      <td className="mono tr2">{clp(saldo)}</td>
                      <td><Badge estado={s.estado}/></td>
                      <td><button className="btn btn-d btn-sm" onClick={() => handleDelete(s.id)}>🗑</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="👷 Nuevo subcontrato" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group"><label>OBRA *</label>
                <select required value={form.obra_id} onChange={e => setForm({...form, obra_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>EMPRESA *</label>
                <input required value={form.empresa} onChange={e => setForm({...form, empresa: e.target.value})}/>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>RUT</label><input value={form.rut} onChange={e => setForm({...form, rut: e.target.value})} placeholder="76.543.210-K"/></div>
              <div className="form-group"><label>ESPECIALIDAD</label>
                <select value={form.especialidad} onChange={e => setForm({...form, especialidad: e.target.value})}>
                  {ESPECIALIDADES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>MONTO CONTRATO (CLP)</label><input type="number" value={form.monto_contrato} onChange={e => setForm({...form, monto_contrato: e.target.value})}/></div>
              <div className="form-group"><label>% RETENCIÓN</label><input type="number" min="0" max="20" value={form.retencion_pct} onChange={e => setForm({...form, retencion_pct: e.target.value})}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>MONTO PAGADO</label><input type="number" value={form.monto_pagado} onChange={e => setForm({...form, monto_pagado: e.target.value})}/></div>
              <div className="form-group"><label>AVANCE (%)</label><input type="number" min="0" max="100" value={form.avance} onChange={e => setForm({...form, avance: e.target.value})}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>CONTACTO</label><input value={form.contacto} onChange={e => setForm({...form, contacto: e.target.value})} placeholder="Nombre y teléfono"/></div>
              <div className="form-group"><label>ESTADO</label>
                <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  {['Activo','Pausado','Finalizado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
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
