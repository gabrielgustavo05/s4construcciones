import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { clp, today } from '../lib/helpers';
import Modal from '../components/Modal';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const EMPTY = { obra_id:'', tipo:'ingreso', concepto:'', categoria:'Otro', monto:'', fecha: today() };
const CATEGORIAS = ['Estado de pago','Proveedor material','Subcontrato','Remuneraciones','Equipos / arriendo','Gastos generales','Otro'];

export default function FlujoCaja() {
  const [movs, setMovs] = useState([]);
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const chartRef = useRef(null);
  const chartInst = useRef(null);

  const fetchData = useCallback(async () => {
    const [{ data: movsData }, { data: obrasData }] = await Promise.all([
      supabase.from('flujo_caja').select('*, obras(nombre)').order('fecha'),
      supabase.from('obras').select('id, nombre').order('nombre'),
    ]);
    setMovs(movsData || []);
    setObras(obrasData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!movs.length || loading) return;
    const byMonth = {};
    movs.forEach(m => {
      if (!m.fecha) return;
      const mes = m.fecha.substring(0, 7);
      if (!byMonth[mes]) byMonth[mes] = { ing: 0, eg: 0 };
      if (m.tipo === 'ingreso') byMonth[mes].ing += m.monto;
      else byMonth[mes].eg += m.monto;
    });
    const meses = Object.keys(byMonth).sort();
    const labels = meses.map(m => { const d = new Date(m + '-01T00:00:00'); return d.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' }); });

    if (chartInst.current) chartInst.current.destroy();
    if (chartRef.current) {
      chartInst.current = new Chart(chartRef.current.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Ingresos', data: meses.map(m => byMonth[m].ing), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.4 },
            { label: 'Egresos',  data: meses.map(m => byMonth[m].eg),  borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)',   fill: true, tension: 0.4 },
          ],
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: { legend: { labels: { color: '#71717a', font: { size: 10 } } } },
          scales: {
            x: { ticks: { color: '#52525b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
            y: { ticks: { color: '#52525b', font: { size: 9 }, callback: v => clp(v) }, grid: { color: 'rgba(255,255,255,0.03)' } },
          },
        },
      });
    }
    return () => { if (chartInst.current) chartInst.current.destroy(); };
  }, [movs, loading]);

  const handleSave = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('flujo_caja').insert([{ ...form, monto: Number(form.monto) }]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchData(); }
    else alert(error.message);
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Eliminar movimiento?')) return;
    await supabase.from('flujo_caja').delete().eq('id', id);
    fetchData();
  };

  let saldo = 0;
  const rows = [...movs].map(m => {
    saldo += m.tipo === 'ingreso' ? m.monto : -m.monto;
    return { ...m, saldoAcum: saldo };
  });

  const totalIng = movs.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto, 0);
  const totalEg  = movs.filter(m => m.tipo === 'egreso').reduce((s, m)  => s + m.monto, 0);

  if (loading) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Flujo de Caja</h2><p>Ingresos, egresos y saldo proyectado</p></div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Registrar movimiento</button>
      </div>
      <div className="pb">
        <div className="stats-grid" style={{ marginBottom: 14 }}>
          <div className="stat-card green"><span className="stat-label">Total ingresos</span><span className="stat-value" style={{ fontSize:14 }}>{clp(totalIng)}</span></div>
          <div className="stat-card red"><span className="stat-label">Total egresos</span><span className="stat-value" style={{ fontSize:14 }}>{clp(totalEg)}</span></div>
          <div className={`stat-card ${totalIng - totalEg >= 0 ? 'green' : 'red'}`}>
            <span className="stat-label">Saldo neto</span>
            <span className="stat-value" style={{ fontSize:14, color: totalIng - totalEg >= 0 ? 'var(--green)' : 'var(--red)' }}>{clp(totalIng - totalEg)}</span>
          </div>
          <div className="stat-card blue"><span className="stat-label">Movimientos</span><span className="stat-value">{movs.length}</span></div>
        </div>

        <div className="card">
          <div className="card-title">💹 Curva ingresos vs egresos</div>
          <div className="chart-wrap"><canvas ref={chartRef}/></div>
        </div>

        <div className="card" style={{ padding: 0 }}>
          <div className="tw">
            <table>
              <thead><tr><th>Fecha</th><th>Obra</th><th>Tipo</th><th>Concepto</th><th>Categoría</th><th>Monto</th><th>Saldo acum.</th><th></th></tr></thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin movimientos</td></tr>
                ) : rows.map(m => (
                  <tr key={m.id}>
                    <td className="ts">{m.fecha}</td>
                    <td className="ts tx">{m.obras?.nombre||'-'}</td>
                    <td><span className={`b ${m.tipo === 'ingreso' ? 'b-g' : 'b-r'}`}>{m.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}</span></td>
                    <td>{m.concepto}</td>
                    <td className="ts tx">{m.categoria}</td>
                    <td className={`mono ${m.tipo === 'ingreso' ? 'tg' : 'tr2'}`}>{m.tipo === 'ingreso' ? '+' : '-'}{clp(m.monto)}</td>
                    <td className={`mono ${m.saldoAcum >= 0 ? 'tg' : 'tr2'}`}>{clp(m.saldoAcum)}</td>
                    <td><button className="btn btn-d btn-sm" onClick={() => handleDelete(m.id)}>🗑</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title="📈 Registrar movimiento" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group"><label>OBRA *</label>
                <select required value={form.obra_id} onChange={e => setForm({...form, obra_id: e.target.value})}>
                  <option value="">Seleccionar...</option>
                  {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
              <div className="form-group"><label>TIPO</label>
                <select value={form.tipo} onChange={e => setForm({...form, tipo: e.target.value})}>
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>CONCEPTO *</label><input required value={form.concepto} onChange={e => setForm({...form, concepto: e.target.value})} placeholder="Pago EPO-003 cliente"/></div>
              <div className="form-group"><label>MONTO (CLP)</label><input type="number" value={form.monto} onChange={e => setForm({...form, monto: e.target.value})}/></div>
            </div>
            <div className="form-grid">
              <div className="form-group"><label>FECHA</label><input type="date" value={form.fecha} onChange={e => setForm({...form, fecha: e.target.value})}/></div>
              <div className="form-group"><label>CATEGORÍA</label>
                <select value={form.categoria} onChange={e => setForm({...form, categoria: e.target.value})}>
                  {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancelar</button>
              <button type="submit" className="btn btn-a">Registrar</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
