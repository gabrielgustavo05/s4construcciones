import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  ClipboardCheck,
  ClipboardPlus,
  FileClock,
  Gauge,
  Handshake,
  WalletCards,
} from 'lucide-react';
import { Chart, registerables } from 'chart.js';
import { supabase } from '../lib/supabase';
import { clp, calcPresupuesto, calcCostoReal, semaforoColor, pct } from '../lib/helpers';
import {
  ESPECIALIDADES,
  LICITACION_FINALIZADA,
  daysUntil,
  getHealthColor,
  getHealthLabel,
  getLicitacionHealth,
  getPendingSpecialties,
  getSpecialtyState,
  specialtyToneClass,
} from '../lib/licitaciones';
import Badge from '../components/Badge';
import KpiCard from '../components/KpiCard';
import PageHeader from '../components/PageHeader';

Chart.register(...registerables);

export default function Dashboard() {
  const [obras, setObras] = useState([]);
  const [licitaciones, setLicitaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();
  const chartPresRef = useRef(null);
  const chartAvRef = useRef(null);
  const chartPresInst = useRef(null);
  const chartAvInst = useRef(null);

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

      const principales = data.filter((o) => o.departamento === 'Construccion' || o.departamento === 'Construcción' || !o.obra_padre_id);
      const espejos = data.filter((o) => (o.departamento === 'Electrico' || o.departamento === 'Eléctrico') && o.obra_padre_id);

      const obrasData = principales.map((main) => {
        const espejo = espejos.find((e) => e.obra_padre_id === main.id);
        const { total: totalPres } = calcPresupuesto(
          main.presupuesto_items || [],
          main.gastos_generales_pct,
          main.utilidad_pct
        );

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
        const diferencia = totalPres - totalCompras;

        return { ...main, totalPres, totalCompras, diferencia };
      });

      setObras(obrasData);

      const { data: licData, error: licError } = await supabase
        .from('licitaciones')
        .select('*')
        .order('fecha_entrega', { ascending: true, nullsFirst: false })
        .limit(12);

      if (licError) {
        console.warn('Modulo licitaciones pendiente de migracion:', licError.message);
        setLicitaciones([]);
      } else {
        setLicitaciones(licData || []);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('No se pudo actualizar el dashboard: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  useEffect(() => {
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'obras' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'presupuesto_items' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'compras' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'asistencia' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cotizaciones' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subcontratos' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'estados_pago' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitudes_material' }, fetchObras)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitaciones' }, fetchObras)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchObras]);

  useEffect(() => {
    if (!obras.length || loading) return;

    const labels = obras.map((o) => (o.nombre.length > 16 ? `${o.nombre.slice(0, 16)}...` : o.nombre));
    const chartOpts = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#a8b1bd', font: { size: 10 }, boxWidth: 10 } },
      },
      scales: {
        x: { ticks: { color: '#737f8c', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.035)' } },
        y: { ticks: { color: '#737f8c', font: { size: 9 }, callback: (v) => clp(v) }, grid: { color: 'rgba(255,255,255,0.035)' } },
      },
    };

    if (chartPresInst.current) chartPresInst.current.destroy();
    if (chartPresRef.current) {
      chartPresInst.current = new Chart(chartPresRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            { label: 'Presupuesto', data: obras.map((o) => o.totalPres), backgroundColor: 'rgba(79,140,201,0.64)', borderColor: '#4f8cc9', borderWidth: 1 },
            { label: 'Gasto real', data: obras.map((o) => o.totalCompras), backgroundColor: 'rgba(201,138,44,0.68)', borderColor: '#c98a2c', borderWidth: 1 },
          ],
        },
        options: chartOpts,
      });
    }

    const avOpts = { ...chartOpts, indexAxis: 'y' };
    avOpts.scales = {
      x: { ticks: { color: '#737f8c', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.035)' }, max: 100 },
      y: { ticks: { color: '#737f8c', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.035)' } },
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
              (o.avance || 0) >= 80 ? 'rgba(40,168,117,0.72)' :
              (o.avance || 0) >= 40 ? 'rgba(201,138,44,0.72)' :
              'rgba(79,140,201,0.72)'
            ),
            borderWidth: 0,
          }],
        },
        options: avOpts,
      });
    }

    return () => {
      if (chartPresInst.current) chartPresInst.current.destroy();
      if (chartAvInst.current) chartAvInst.current.destroy();
    };
  }, [obras, loading]);

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" />
      Cargando dashboard...
    </div>
  );

  const activas = obras.filter((o) => o.estado === 'Activa' || o.estado === 'En Progreso');
  const totalPres = obras.reduce((s, o) => s + o.totalPres, 0);
  const totalGasto = obras.reduce((s, o) => s + o.totalCompras, 0);
  const resultado = totalPres - totalGasto;
  const avPromedio = activas.length ? Math.round(activas.reduce((s, o) => s + (o.avance || 0), 0) / activas.length) : 0;
  const totalSubs = obras.reduce((s, o) => s + (o.subcontratos || []).reduce((a, b) => a + b.monto_contrato, 0), 0);
  const cotPend = obras.reduce((s, o) => s + (o.cotizaciones || []).filter((c) => c.estado === 'Pendiente').length, 0);
  const obrasRiesgo = obras.filter((o) => o.totalPres > 0 && o.totalCompras / o.totalPres >= 0.85).length;
  const licitacionesActivas = licitaciones
    .filter((l) => !LICITACION_FINALIZADA.includes(l.estado))
    .sort((a, b) => (a.fecha_entrega || '9999-12-31').localeCompare(b.fecha_entrega || '9999-12-31'));
  const licitacionesRiesgo = licitacionesActivas.filter((l) => getLicitacionHealth(l) === 'danger').length;
  const fechaDashboard = new Date().toLocaleDateString('es-CL', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div>
      <PageHeader
        eyebrow="Control financiero y operativo"
        title="Dashboard ejecutivo"
        subtitle={fechaDashboard}
        live
      />

      {errorMsg && (
        <div className="pb" style={{ paddingBottom: 0 }}>
          <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{errorMsg}</div>
        </div>
      )}

      <div className="pb">
        <div className="kpi-grid">
          <KpiCard label="Obras activas" value={`${activas.length} / ${obras.length}`} sub="Portafolio en control" icon={BriefcaseBusiness} tone="warning" />
          <KpiCard label="Presupuesto total" value={clp(totalPres)} sub="Suma de obras" icon={WalletCards} tone="info" />
          <KpiCard label="Gasto comprometido" value={clp(totalGasto)} sub="Ejecutado sobre presupuesto" meta={`${pct(totalGasto, totalPres)}%`} icon={BarChart3} tone="success" />
          <KpiCard label="Resultado" value={clp(resultado)} sub={resultado >= 0 ? 'Presupuesto disponible' : 'Sobrecosto acumulado'} icon={Gauge} tone={resultado >= 0 ? 'success' : 'danger'} />
          <KpiCard label="Cotizaciones pendientes" value={cotPend} sub="Por aprobar" icon={FileClock} tone={cotPend > 0 ? 'danger' : 'success'} />
          <KpiCard label="Avance promedio" value={`${avPromedio}%`} sub="Obras activas" icon={ClipboardCheck} tone="neutral" />
          <KpiCard label="Subcontratos" value={clp(totalSubs)} sub={`${obras.reduce((s, o) => s + (o.subcontratos || []).length, 0)} contratos`} icon={Handshake} tone="accent" />
          <KpiCard label="Obras en riesgo" value={obrasRiesgo} sub="Sobre 85% de consumo" icon={AlertTriangle} tone={obrasRiesgo > 0 ? 'danger' : 'success'} />
          <KpiCard label="Licitaciones activas" value={licitacionesActivas.length} sub={`${licitacionesRiesgo} con alerta`} icon={ClipboardPlus} tone={licitacionesRiesgo > 0 ? 'danger' : 'info'} />
        </div>

        <div className="g2 dashboard-panels">
          <div className="card chart-card">
            <div className="card-title">Presupuesto vs gasto real</div>
            <div className="chart-wrap"><canvas ref={chartPresRef} /></div>
          </div>
          <div className="card chart-card">
            <div className="card-title">Avance por obra (%)</div>
            <div className="chart-wrap"><canvas ref={chartAvRef} /></div>
          </div>
        </div>

        <div className="card data-card dashboard-licitaciones" style={{ padding: 0 }}>
          <div className="fb" style={{ padding: '14px 16px 0' }}>
            <div>
              <div className="card-title" style={{ marginBottom: 2 }}>Licitaciones en postulacion</div>
              <div className="ts tx">Ordenadas por fecha de entrega y riesgo de cotizaciones externas</div>
            </div>
            <button className="btn btn-s btn-sm" onClick={() => navigate('/licitaciones?new=1')}>Ingreso de Licitacion</button>
          </div>
          <div className="tw">
            <table className="licitaciones-table">
              <thead>
                <tr>
                  <th></th>
                  <th>Licitacion</th>
                  <th>Entrega</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Especialidades</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {licitacionesActivas.length === 0 ? (
                  <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No hay licitaciones activas registradas</td></tr>
                ) : licitacionesActivas.slice(0, 6).map((l) => {
                  const health = getLicitacionHealth(l);
                  const days = daysUntil(l.fecha_entrega);
                  const pending = getPendingSpecialties(l);
                  return (
                    <tr key={l.id}>
                      <td><div className="semaforo" style={{ background: getHealthColor(health) }} /></td>
                      <td>
                        <div className="lic-name">{l.nombre_licitacion}</div>
                        <div className="ts tx">{l.cliente || 'Sin mandante'} · {l.observaciones || 'Sin observaciones'}</div>
                      </td>
                      <td>
                        <div className="mono">{l.fecha_entrega || '-'}</div>
                        <div className={`ts ${days !== null && days < 3 && pending.length ? 'tr2' : 'tx'}`}>
                          {getHealthLabel(l)}
                        </div>
                      </td>
                      <td><Badge estado={l.estado} /></td>
                      <td>{l.responsable || '-'}</td>
                      <td>
                        <div className="specialty-stack compact">
                          {ESPECIALIDADES.map(({ key, label }) => {
                            const estado = getSpecialtyState(l, key);
                            return (
                              <span className={`specialty-pill readonly ${specialtyToneClass(estado)}`} key={key}>
                                <span>{label}</span>
                                <em>{estado}</em>
                              </span>
                            );
                          })}
                        </div>
                      </td>
                      <td><button className="btn btn-s btn-sm" onClick={() => navigate('/licitaciones')}>Ver</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card data-card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '14px 16px 0' }}>Estado de obras</div>
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
                          Ver
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
