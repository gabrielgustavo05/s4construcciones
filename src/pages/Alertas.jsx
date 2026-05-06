import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clp, calcPresupuesto, calcCompras } from '../lib/helpers';
import { useNavigate } from 'react-router-dom';

export default function Alertas() {
  const [alertas, setAlertas] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchAlertas = useCallback(async () => {
    const { data: obras } = await supabase
      .from('obras')
      .select(`id, nombre, estado, presupuesto_items(id, descripcion, cantidad, precio_unitario, presupuesto_materiales(descripcion, cantidad)), compras(cantidad, precio_unitario, presupuesto_item_id, descripcion), cotizaciones(estado), estados_pago(estado, monto_bruto, retencion_pct, fecha_pago_estimada), hitos(estado, nombre, fecha_fin_plan)`)
      .neq('estado', 'Finalizada');

    if (!obras) { setLoading(false); return; }

    const list = [];
    for (const o of obras) {
      const { total: totalPres } = calcPresupuesto(o.presupuesto_items || []);
      const totalComp = calcCompras(o.compras || []);
      const pctGasto = totalPres > 0 ? (totalComp / totalPres) * 100 : 0;

      // Alerta de sobrecosto
      if (pctGasto > 100) {
        list.push({ ico: '🔴', niv: 'c', tit: `Sobrecosto crítico: ${o.nombre}`, desc: `Gasto supera presupuesto en ${Math.round(pctGasto - 100)}%`, oId: o.id });
      } else if (pctGasto > 85) {
        list.push({ ico: '🟡', niv: 'w', tit: `Alerta presupuesto: ${o.nombre}`, desc: `Gasto al ${Math.round(pctGasto)}% del presupuesto`, oId: o.id });
      }

      // Cotizaciones pendientes
      const cotsPend = (o.cotizaciones || []).filter(c => c.estado === 'Pendiente').length;
      if (cotsPend > 0) {
        list.push({ ico: '🟡', niv: 'w', tit: `${cotsPend} cotización(es) pendiente(s): ${o.nombre}`, desc: 'Requiere aprobación', oId: o.id });
      }

      // EPOs no pagados vencidos
      const hoy = new Date();
      (o.estados_pago || []).filter(ep => ep.estado !== 'Pagado' && ep.fecha_pago_estimada).forEach(ep => {
        const fechaEp = new Date(ep.fecha_pago_estimada);
        if (fechaEp < hoy) {
          list.push({ ico: '💰', niv: 'c', tit: `EPO vencido: ${o.nombre}`, desc: `Pago estimado ${ep.fecha_pago_estimada} — ${clp(ep.monto_bruto)}`, oId: o.id });
        }
      });

      // Hitos atrasados
      (o.hitos || []).filter(h => h.estado === 'Atrasado').forEach(h => {
        list.push({ ico: '⚠️', niv: 'w', tit: `Hito atrasado: ${h.nombre}`, desc: `Obra: ${o.nombre} · Fin plan: ${h.fecha_fin_plan || '-'}`, oId: o.id });
      });

      // Sobrecompra por partida / material
      (o.presupuesto_items || []).forEach(p => {
        const comprasPartida = (o.compras || []).filter(c => c.presupuesto_item_id === p.id);
        
        if (p.presupuesto_materiales && p.presupuesto_materiales.length > 0) {
          p.presupuesto_materiales.forEach(mat => {
            const compradoMat = comprasPartida.filter(c => (c.descripcion || '').toLowerCase() === (mat.descripcion || '').toLowerCase()).reduce((s,c)=>s+(c.cantidad||0), 0);
            if (compradoMat > mat.cantidad) {
               const exceso = compradoMat - mat.cantidad;
               list.push({ ico: '📦', niv: 'c', tit: `Sobrecompra: ${mat.descripcion}`, desc: `Obra: ${o.nombre} · Partida: ${p.descripcion} · Requerido: ${mat.cantidad} · Comprado: ${compradoMat} · Exceso: +${exceso}`, oId: o.id });
            }
          });
        } else if (p.cantidad > 0) {
          const comprado = comprasPartida.reduce((s, c) => s + Number(c.cantidad), 0);
          if (comprado > p.cantidad) {
            const exceso = comprado - p.cantidad;
            list.push({ ico: '📦', niv: 'c', tit: `Sobrecompra: ${p.descripcion}`, desc: `Obra: ${o.nombre} · Presupuestado: ${p.cantidad} · Comprado: ${comprado} · Exceso: +${exceso}`, oId: o.id });
          }
        }
      });
    }

    setAlertas(list);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAlertas(); }, [fetchAlertas]);

  const groups = { c: alertas.filter(a => a.niv === 'c'), w: alertas.filter(a => a.niv === 'w'), i: alertas.filter(a => a.niv === 'i') };
  const labels = { c: '🔴 Críticas', w: '🟡 Advertencias', i: '🔵 Informativas' };
  const colors = { c: 'var(--red)', w: 'var(--accent)', i: 'var(--blue)' };

  if (loading) return <div className="loading-center"><div className="spinner"/>Analizando...</div>;

  return (
    <div>
      <div className="ph">
        <div><h2>Centro de alertas</h2><p>Situaciones que requieren atención inmediata</p></div>
        <button className="btn btn-s" onClick={fetchAlertas}>↻ Actualizar</button>
      </div>
      <div className="pb">
        {alertas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">✅</div>
            <h3>Sin alertas activas</h3>
            <p>Todos los proyectos están dentro de los parámetros normales</p>
          </div>
        ) : ['c','w','i'].map(niv => groups[niv].length > 0 && (
          <div className="card" key={niv}>
            <div className="card-title">{labels[niv]} ({groups[niv].length})</div>
            {groups[niv].map((a, i) => (
              <div
                key={i}
                onClick={() => a.oId && navigate(`/obra/${a.oId}`)}
                style={{
                  display:'flex',gap:10,padding:12,background:'var(--bg3)',borderRadius:'var(--r2)',
                  marginBottom:8,borderLeft:`4px solid ${colors[niv]}`,
                  cursor: a.oId ? 'pointer' : 'default',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg4)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--bg3)'}
              >
                <span style={{ fontSize:18 }}>{a.ico}</span>
                <div>
                  <div style={{ fontSize:12,fontWeight:700 }}>{a.tit}</div>
                  <div className="ts tx">{a.desc}</div>
                  {a.oId && <div className="ts" style={{ color:'var(--accent)',marginTop:4 }}>Ver obra →</div>}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
