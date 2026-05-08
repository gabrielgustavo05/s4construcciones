import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clp, calcPresupuesto, calcCostoReal, semaforoColor, pct } from '../lib/helpers';
import { Chart, registerables } from 'chart.js';
import Badge from '../components/Badge';

Chart.register(...registerables);

export default function Dashboard() {
  const [obras, setObras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const chartPresRef = useRef(null);
  const chartAvRef  = useRef(null);
  const chartPresInst = useRef(null);
  const chartAvInst   = useRef(null);

  const fetchObras = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('obras')
        .select(`
          id, nombre, tipo, estado, avance,
          gastos_generales_pct, utilidad_pct,
          presupuesto_items ( cantidad, precio_unitario ),
          compras ( cantidad, precio_unitario ),
          asistencia ( total_pago ),
          cotizaciones ( monto, estado ),
          subcontratos ( monto_contrato ),
          estados_pago ( monto_bruto, retencion_pct, estado ),
          obra_padre_id, departamento
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setErrorMsg('');

      // 1. Separar obras principales de espejos
      const principales = data.filter(o => o.departamento === 'Construcción' || !o.obra_padre_id);
      const espejos      = data.filter(o => o.departamento === 'Eléctrico' && o.obra_padre_id);

      // 2. Consolidar datos
      const obrasData = principales.map((main) => {
        const espejo = espejos.find(e => e.obra_padre_id === main.id);
        
        const { total: totalPres } = calcPresupuesto(
          main.presupuesto_items || [],
          main.gastos_generales_pct,
          main.utilidad_pct
        );

        // Sumar gastos de la obra principal + gastos del espejo eléctrico
        const gastoPrincipal = calcCostoReal({
          compras: main.compras || [],
          asistencia: main.asistencia || [],
          subcontratos: main.subcontratos || [],
        }).total;
        const gastoEspejo = espejo ? calcCostoReal({
          compras: espejo.compras || [],
          asistencia: espejo.asistencia || [],
          subcontratos: espejo.subcontratos || [],
        }).total : 0;
        
        const totalCompras = gastoPrincipal + gastoEspejo;
        const diferencia   = totalPres - totalCompras;

        return { ...main, totalPres, totalCompras, diferencia };
      });

      setObras(obrasData);
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo actualizar el dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => { fetchObras(); }, [fetchObras]);

  // Supabase Realtime — escucha cambios en todas las tablas relevantes
  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obras' },           fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_items' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' },         fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' },      fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' },    fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontratos' },    fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estados_pago' },    fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_material' }, fetchObras)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchObras]);

  // Renderizar gráficos
  useEffect(() => {
    if (!obras.length || loading) return;

    const labels = obras.map((o) =>
      o.nombre.length > 16 ? o.nombre.slice(0, 16) + '…' : o.nombre
    );
    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#71717a', font: { size: 10 }, boxWidth: 10 } },
      },
      scales: {
        x: { ticks: { color: '#52525b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
        y: { ticks: { color: '#52525b', font: { size: 9 }, callback: (v) => clp(v) }, grid: { color: 'rgba(255,255,255,0.03)' } },
      },
    };

    if (chartPresInst.current) chartPresInst.current.destroy();
    if (chartPresRef.current) {
      chartPresInst.current = new Chart(chartPresRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Presupuesto', data: obras.map((o) => o.totalPres), backgroundColor: 'rgba(59,130,246,0.6)', borderColor: '#3b82f6', borderWidth: 1 },
            { label: 'Gasto real',  data: obras.map((o) => o.totalCompras), backgroundColor: 'rgba(217,119,6,0.6)', borderColor: '#d97706', borderWidth: 1 },
          ],
        },
        options: chartOpts,
      });
    }

    const avOpts = { ...chartOpts, indexAxis: 'y' };
    avOpts.scales = {
      x: { ticks: { color: '#52525b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' }, max: 100 },
      y: { ticks: { color: '#52525b', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.03)' } },
    };
    avOpts.plugins = { legend: { display: false } };

    if (chartAvInst.current) chartAvInst.current.destroy();
    if (chartAvRef.current) {
      chartAvInst.current = new Chart(chartAvRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Avance %',
            data: obras.map((o) => o.avance || 0),
            backgroundColor: obras.map((o) =>
              (o.avance || 0) >= 80 ? 'rgba(16,185,129,0.7)' :
              (o.avance || 0) >= 40 ? 'rgba(217,119,6,0.7)' :
              'rgba(59,130,246,0.7)'
            ),
            borderWidth: 0,
          }],
        },
        options: avOpts,
      });
    }

    return () => {
      if (chartPresInst.current) chartPresInst.current.destroy();
      if (chartAvInst.current)   chartAvInst.current.destroy();
    };
  }, [obras, loading]);

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      Cargando dashboard...
    </div>
  );

  const activas     = obras.filter((o) => o.estado === 'Activa' || o.estado === 'En Progreso');
  const totalPres   = obras.reduce((s, o) => s + o.totalPres, 0);
  const totalGasto  = obras.reduce((s, o) => s + o.totalCompras, 0);
  const avPromedio  = activas.length ? Math.round(activas.reduce((s, o) => s + (o.avance || 0), 0) / activas.length) : 0;
  const totalSubs   = obras.reduce((s, o) => s + (o.subcontratos || []).reduce((a, b) => a + b.monto_contrato, 0), 0);
  const cotPend     = obras.reduce((s, o) => s + (o.cotizaciones || []).filter((c) => c.estado === 'Pendiente').length, 0);

  return (
    <div>
      <div className="ph">
        <div>
          <h2>Dashboard ejecutivo</h2>
          <p>{new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>● EN VIVO</span>
        </div>
      </div>
      {errorMsg && (
        <div className="pb" style={{ paddingBottom: 0 }}>
          <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{errorMsg}</div>
        </div>
      )}

      <div className="pb">
        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card amber">
            <span className="stat-label">Obras activas</span>
            <span className="stat-value">{activas.length}<span style={{ fontSize: 13, color: 'var(--text2)' }}> / {obras.length}</span></span>
            <div className="stat-sub">Total portafolio</div>
          </div>
          <div className="stat-card blue">
            <span className="stat-label">Presupuesto total</span>
            <span className="stat-value" style={{ fontSize: 15 }}>{clp(totalPres)}</span>
            <div className="stat-sub">Suma de obras</div>
          </div>
          <div className="stat-card green">
            <span className="stat-label">Gasto comprometido</span>
            <span className="stat-value" style={{ fontSize: 15 }}>{clp(totalGasto)}</span>
            <div className="stat-sub">{pct(totalGasto, totalPres)}% ejecutado</div>
          </div>
          <div className={`stat-card ${totalPres - totalGasto < 0 ? 'red' : 'green'}`}>
            <span className="stat-label">Resultado</span>
            <span className="stat-value" style={{ fontSize: 15, color: totalPres - totalGasto >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {clp(totalPres - totalGasto)}
            </span>
            <div className="stat-sub">Presupuesto restante</div>
          </div>
          <div className={`stat-card ${cotPend > 0 ? 'red' : 'green'}`}>
            <span className="stat-label">Cots. pendientes</span>
            <span className="stat-value">{cotPend}</span>
            <div className="stat-sub">Por aprobar</div>
          </div>
          <div className="stat-card purple">
            <span className="stat-label">Avance promedio</span>
            <span className="stat-value">{avPromedio}%</span>
            <div className="stat-sub">Obras activas</div>
          </div>
          <div className="stat-card teal">
            <span className="stat-label">Total subcontratos</span>
            <span className="stat-value" style={{ fontSize: 15 }}>{clp(totalSubs)}</span>
            <div className="stat-sub">{obras.reduce((s, o) => s + (o.subcontratos || []).length, 0)} contratos</div>
          </div>
          <div className="stat-card amber">
            <span className="stat-label">Total obras</span>
            <span className="stat-value">{obras.length}</span>
            <div className="stat-sub">En el sistema</div>
          </div>
        </div>

        {/* Gráficos */}
        <div className="g2">
          <div className="card">
            <div className="card-title">📊 Presupuesto vs Gasto real</div>
            <div className="chart-wrap"><canvas ref={chartPresRef} /></div>
          </div>
          <div className="card">
            <div className="card-title">📈 Avance por obra (%)</div>
            <div className="chart-wrap"><canvas ref={chartAvRef} /></div>
          </div>
        </div>

        {/* Tabla de obras */}
        <div className="card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '14px 16px 0' }}>🏢 Estado de obras</div>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th></th>
                  <th>Obra</th>
                  <th>Estado</th>
                  <th>Avance</th>
                  <th>Presupuesto</th>
                  <th>Gasto real</th>
                  <th>Resultado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {obras.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No hay obras registradas</td></tr>
                ) : obras.map((o) => {
                  const color = semaforoColor(o.totalPres, o.totalCompras);
                  const dif = o.totalPres - o.totalCompras;
                  return (
                    <tr key={o.id}>
                      <td><div className="semaforo" style={{ background: color }} /></td>
                      <td>
                        <span
                          style={{ fontWeight: 700, color: 'var(--accent)', cursor: 'pointer' }}
                          onClick={() => navigate(`/obra/${o.id}`)}
                        >
                          {o.nombre}
                        </span>
                        <div className="ts tx">{o.tipo}</div>
                      </td>
                      <td><Badge estado={o.estado} /></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div className="pb2" style={{ width: 60 }}>
                            <div className="pf" style={{
                              width: `${o.avance || 0}%`,
                              background: (o.avance || 0) >= 80 ? 'var(--green)' : (o.avance || 0) >= 40 ? 'var(--accent)' : 'var(--blue)',
                            }} />
                          </div>
                          <span className="ts">{o.avance || 0}%</span>
                        </div>
                      </td>
                      <td className="mono">{clp(o.totalPres)}</td>
                      <td className="mono">{clp(o.totalCompras)}</td>
                      <td className={`mono ${dif >= 0 ? 'tg' : 'tr2'}`}>{clp(dif)}</td>
                      <td>
                        <button className="btn btn-s btn-sm" onClick={() => navigate(`/obra/${o.id}`)}>
                          Ver →
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
