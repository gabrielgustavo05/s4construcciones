import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { today } from '../lib/helpers';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const EMPTY = { obra_id:'', nombre:'', fecha_inicio_plan:'', fecha_fin_plan:'', avance:'0', estado:'Pendiente', responsable:'', notas:'' };

export default function Cronograma() {
  const [hitos, setHitos] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filtroObra, setFiltroObra] = useState('');

  const fetchData = useCallback(async () => {
    const [{ data: hitosData }, { data: obrasData }] = await Promise.all([
      supabase.from('hitos').select('*, obras(nombre)').order('fecha_inicio_plan'),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ]);
    setHitos(hitosData || []);
    setObras(obrasData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = { ...form, avance: Number(form.avance) };
    const { error } = await supabase.from('hitos').insert([payload]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchData(); }
    else alert(error.message);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar hito?')) return;
    await supabase.from('hitos').delete().eq('id', id);
    fetchData();
  };

  const filtrados = filtroObra ? hitos.filter(h => h.obra_id === filtroObra) : hitos;

  // Agrupar por obra
  const groups = {};
  filtrados.forEach(h => {
    const key = h.obra_id;
    if (!groups[key]) groups[key] = { nombre: h.obras?.nombre, hitos: [] };
    groups[key].hitos.push(h);
  });

  if (loading) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Cronograma</h2><p>Fases, hitos y Gantt por obra</p></div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nuevo hito</button>
      </div>
      <div className="pb">
        <div className="fg2" style={{ marginBottom: 14 }}>
          <select value={filtroObra} onChange={e => setFiltroObra(e.target.value)} style={{ background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text)',padding:'7px 12px',borderRadius:'var(--r2)',fontSize:11 }}>
            <option value="">Todas las obras</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
          </select>
        </div>

        {Object.values(groups).length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📅</div><h3>Sin hitos</h3><p>Agrega el primer hito para comenzar</p></div>
        ) : Object.values(groups).map((g, i) => (
          <div className="card" key={i}>
            <div className="fb" style={{ marginBottom: 12 }}>
              <div className="card-title" style={{ margin: 0 }}>🏢 {g.nombre}</div>
              <span className="ts tx">{g.hitos.filter(h => h.estado === 'Completado').length}/{g.hitos.length} completados</span>
            </div>

            {/* Gantt visual */}
            {g.hitos.map(h => {
              const col = h.estado === 'Completado' ? 'var(--green)' : h.estado === 'En curso' ? 'var(--blue)' : h.estado === 'Atrasado' ? 'var(--red)' : 'var(--bg5)';
              return (
                <div className="gantt-row" key={h.id}>
                  <div className="gantt-label">{h.nombre}</div>
                  <div className="gantt-bar-wrap">
                    <div className="gantt-bar" style={{ width: `${h.avance || 0}%`, background: col }}>
                      {h.avance >= 20 ? `${h.avance}%` : ''}
                    </div>
                    {h.avance < 20 && <span style={{ position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'var(--text2)' }}>{h.avance}%</span>}
                  </div>
                  <Badge estado={h.estado}/>
                  <button className="btn btn-d btn-sm" onClick={() => handleDelete(h.id)}>✕</button>
                </div>
              );
            })}

            <hr className="sep"/>
            <div className="tw">
              <table>
                <thead><tr><th>Hito</th><th>Inicio plan.</th><th>Fin plan.</th><th>Resp.</th><th>Estado</th><th>Notas</th></tr></thead>
                <tbody>
                  {g.hitos.map(h => (
                    <tr key={h.id}>
                      <td><strong>{h.nombre}</strong></td>
                      <td className="ts">{h.fecha_inicio_plan||'-'}</td>
                      <td className="ts">{h.fecha_fin_plan||'-'}</td>
                      <td className="ts tx">{h.responsable||'-'}</td>
                      <td><Badge estado={h.estado}/></td>
                      <td className="ts tx">{h.notas||'-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <Modal title="📅 Nuevo hito" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group"><label>OBRA *</label>
                <select required value={form.obra_id} onChange={e => setForm({...form, obra_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>NOMBRE DEL HITO *</label><input required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Fundaciones terminadas"/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>FECHA INICIO PLAN.</label><input type="date" value={form.fecha_inicio_plan} onChange={e => setForm({...form, fecha_inicio_plan: e.target.value})}/></div>
              <div className="form-group"><label>FECHA FIN PLAN.</label><input type="date" value={form.fecha_fin_plan} onChange={e => setForm({...form, fecha_fin_plan: e.target.value})}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>AVANCE (%)</label><input type="number" min="0" max="100" value={form.avance} onChange={e => setForm({...form, avance: e.target.value})}/></div>
              <div className="form-group"><label>ESTADO</label>
                <select value={form.estado} onChange={e => setForm({...form, estado: e.target.value})}>
                  {['Pendiente','En curso','Completado','Atrasado'].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>RESPONSABLE</label><input value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})}/></div>
            </div>
            <div className="form-group"><label>NOTAS</label><textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})}/></div>
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
