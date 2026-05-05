import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clp, calcPresupuesto, calcCompras, today, parseExcel } from '../lib/helpers';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const TABS = ['Resumen','Presupuesto','Compras','Cotizaciones','Subcontratos','Hitos','Estados de Pago'];

export default function ObraDetail() {
  const { id } = useParams();
  const [obra, setObra] = useState(null);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ presupuesto: [], compras: [], cotizaciones: [], subcontratos: [], hitos: [], estados_pago: [] });
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [excelPreview, setExcelPreview] = useState(null);
  const [form, setForm] = useState({});

  const [showEditObra, setShowEditObra] = useState(false);
  const [editForm, setEditForm] = useState({});

  const fetchObra = useCallback(async () => {
    const { data: o } = await supabase.from('obras').select('*, obra_padre:obra_padre_id(nombre)').eq('id', id).single();
    setObra(o);
  }, [id]);

  const fetchTab = useCallback(async (tabIndex) => {
    setLoading(true);
    const tables = ['presupuesto_items','compras','cotizaciones','subcontratos','hitos','estados_pago'];
    if (tabIndex === 0) { setLoading(false); return; }
    const table = tables[tabIndex - 1];
    const { data: rows } = await supabase.from(table).select('*').eq('obra_id', id).order('created_at', { ascending: true });
    setData(d => ({ ...d, [table === 'presupuesto_items' ? 'presupuesto' : table]: rows || [] }));
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchObra(); }, [fetchObra]);
  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  // ── Acciones genéricas ──
  const deleteRow = async (table, rowId) => {
    if (!confirm('¿Eliminar?')) return;
    await supabase.from(table).delete().eq('id', rowId);
    fetchTab(tab);
  };

  const handleUpdateObra = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from('obras').update(editForm).eq('id', id);
    if (!error) { setShowEditObra(false); fetchObra(); }
    else alert('Error: ' + error.message);
  };

  // ── Importar Excel ──
  const handleExcelFile = async (e) => {
    try {
      const items = await parseExcel(e.target.files[0]);
      setExcelPreview(items);
    } catch { alert('Error leyendo el archivo Excel'); }
    e.target.value = '';
  };

  const confirmExcelImport = async () => {
    const rows = excelPreview.map(i => ({ ...i, obra_id: id }));
    await supabase.from('presupuesto_items').insert(rows);
    setExcelPreview(null);
    fetchTab(1);
  };

  // ── Agregar ítem presupuesto ──
  const [newItem, setNewItem] = useState({ codigo:'', descripcion:'', unidad:'UN', cantidad:'', precio_unitario:'' });
  const addItem = async (e) => {
    e.preventDefault();
    await supabase.from('presupuesto_items').insert([{ ...newItem, obra_id: id, cantidad: Number(newItem.cantidad), precio_unitario: Number(newItem.precio_unitario) }]);
    setNewItem({ codigo:'', descripcion:'', unidad:'UN', cantidad:'', precio_unitario:'' });
    fetchTab(1);
  };

  // ── Agregar compra ──
  const [newCompra, setNewCompra] = useState({ descripcion:'', unidad:'UN', cantidad:'', precio_unitario:'', proveedor:'', n_documento:'', fecha: today() });
  const addCompra = async (e) => {
    e.preventDefault();
    await supabase.from('compras').insert([{ ...newCompra, obra_id: id, cantidad: Number(newCompra.cantidad), precio_unitario: Number(newCompra.precio_unitario) }]);
    setNewCompra({ descripcion:'', unidad:'UN', cantidad:'', precio_unitario:'', proveedor:'', n_documento:'', fecha: today() });
    fetchTab(2);
  };

  const updatePct = async (field, value) => {
    const num = Number(value);
    if (isNaN(num)) return;
    await supabase.from('obras').update({ [field]: num }).eq('id', id);
    fetchObra();
  };

  if (!obra) return <div className="loading-center"><div className="spinner"/>Cargando...</div>;

  const { total: totalPres, subtotal, gastosGenerales, utilidad, neto, iva } = calcPresupuesto(data.presupuesto, obra.gastos_generales_pct, obra.utilidad_pct);
  const totalComp = calcCompras(data.compras);

  return (
    <div className="detail-overlay">
      {/* Header */}
      <div className="detail-header">
        <Link to="/obras" className="btn btn-s btn-sm">← Volver</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{obra.nombre}</div>
          <div className="ts tx">{obra.tipo} · {obra.n_contrato || 'Sin contrato'} · ITO: {obra.ito || '-'}</div>
        </div>
        <Badge estado={obra.estado}/>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={i} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
      </div>

      {/* ── TAB 0: RESUMEN ── */}
      {tab === 0 && (
        <div className="tab-panel active">
          <div className="stats-grid">
            {[
              ['amber','Avance', `${obra.avance||0}%`],
              ['blue','Presupuesto', clp(totalPres)],
              ['green','Gasto real', clp(totalComp)],
              [totalPres - totalComp >= 0 ? 'green':'red','Resultado', clp(totalPres - totalComp)],
              ['teal','Superficie', `${(obra.superficie||0).toLocaleString('es-CL')} m²`],
            ].map(([c,l,v]) => (
              <div className={`stat-card ${c}`} key={l}>
                <span className="stat-label">{l}</span>
                <span className="stat-value" style={{ fontSize:15 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="g2">
            <div className="card">
              <div className="fb">
                <div className="card-title" style={{ margin:0 }}>📋 Datos</div>
                <button className="btn btn-s btn-sm" onClick={() => { setEditForm(obra); setShowEditObra(true); }}>✏️ Editar</button>
              </div>
              <div style={{ marginTop: 14 }}>
                {[['Cliente',obra.cliente],['ITO',obra.ito],['Responsable',obra.responsable],['Inicio',obra.fecha_inicio],['Término est.',obra.fecha_fin],['N° OC / Contrato',obra.n_contrato], ...(obra.obra_padre ? [['Obra Asociada', obra.obra_padre.nombre]] : [])].map(([k,v]) => (
                  <div className="kv" key={k}><span className="k">{k}</span><span className="v">{v||'-'}</span></div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">📝 Descripción</div>
              <div className="nota-box">{obra.descripcion||'Sin descripción.'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: PRESUPUESTO ── */}
      {tab === 1 && (
        <div className="tab-panel active">
          <div className="fb" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize:15,fontWeight:800 }}>Presupuesto Detallado</h3>
            <div style={{ display:'flex',gap:8 }}>
              <label className="btn btn-s btn-sm" style={{ cursor:'pointer' }}>
                🤖 Importar Excel AI
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display:'none' }} onChange={handleExcelFile}/>
              </label>
            </div>
          </div>

          {/* Excel Preview */}
          {excelPreview && (
            <div className="card" style={{ border:'1px solid var(--accent)' }}>
              <div className="card-title">📊 Vista previa — {excelPreview.length} ítems detectados</div>
              <div className="excel-preview">
                <table>
                  <thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th>Cantidad</th><th>P. Unitario</th><th>Total</th></tr></thead>
                  <tbody>
                    {excelPreview.slice(0,20).map((i,idx) => (
                      <tr key={idx}>
                        <td className="ts tx">{i.codigo||'-'}</td>
                        <td>{i.descripcion}</td>
                        <td>{i.unidad}</td>
                        <td className="mono">{i.cantidad}</td>
                        <td className="mono">{clp(i.precio_unitario)}</td>
                        <td className="mono">{clp(i.cantidad * i.precio_unitario)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelPreview.length > 20 && <p className="ts tx" style={{ padding:'8px 12px' }}>...y {excelPreview.length - 20} ítems más</p>}
              <div style={{ display:'flex',gap:8,padding:'12px 0 0' }}>
                <button className="btn btn-a" onClick={confirmExcelImport}>✓ Importar {excelPreview.length} ítems</button>
                <button className="btn btn-s" onClick={() => setExcelPreview(null)}>Cancelar</button>
              </div>
            </div>
          )}

          {/* Formulario agregar ítem */}
          <form onSubmit={addItem} style={{ background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:14,marginBottom:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'80px 1fr 70px 100px 130px 44px',gap:8,alignItems:'end' }}>
              <div className="form-group" style={{ margin:0 }}>
                <label>Código</label>
                <input value={newItem.codigo} onChange={e=>setNewItem({...newItem,codigo:e.target.value})} placeholder="1.1"/>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label>Descripción *</label>
                <input required value={newItem.descripcion} onChange={e=>setNewItem({...newItem,descripcion:e.target.value})} placeholder="Ej: Hormigón H-30"/>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label>Unidad</label>
                <input value={newItem.unidad} onChange={e=>setNewItem({...newItem,unidad:e.target.value})}/>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label>Cantidad</label>
                <input type="number" step="0.01" required value={newItem.cantidad} onChange={e=>setNewItem({...newItem,cantidad:e.target.value})}/>
              </div>
              <div className="form-group" style={{ margin:0 }}>
                <label>P. Unitario</label>
                <input type="number" step="0.01" required value={newItem.precio_unitario} onChange={e=>setNewItem({...newItem,precio_unitario:e.target.value})}/>
              </div>
              <button type="submit" className="btn btn-a" style={{ alignSelf:'flex-end' }}>+</button>
            </div>
          </form>

          <div className="card" style={{ padding:0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>N°</th><th>Código</th><th>Descripción</th><th>Und</th><th style={{ textAlign:'right' }}>Cantidad</th><th style={{ textAlign:'right' }}>P. Unitario</th><th style={{ textAlign:'right' }}>Total</th><th></th></tr></thead>
                <tbody>
                  {data.presupuesto.length === 0 ? (
                    <tr><td colSpan="8" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin ítems. Agrega manualmente o importa desde Excel.</td></tr>
                  ) : data.presupuesto.map((p,i) => {
                    const tot = p.cantidad * p.precio_unitario;
                    return (
                      <tr key={p.id}>
                        <td className="ts tx">{i+1}</td>
                        <td className="ts tx">{p.codigo||'-'}</td>
                        <td><strong>{p.descripcion}</strong></td>
                        <td><span style={{ background:'var(--bg4)',padding:'2px 6px',borderRadius:4,fontSize:10,color:'var(--text2)' }}>{p.unidad}</span></td>
                        <td className="mono" style={{ textAlign:'right' }}>{p.cantidad}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{clp(p.precio_unitario)}</td>
                        <td className="mono" style={{ textAlign:'right',fontWeight:700 }}>{clp(tot)}</td>
                        <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('presupuesto_items', p.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Resumen financiero */}
            <div style={{ background:'var(--bg3)',padding:'14px 18px',borderTop:'1px solid var(--border)' }}>
              <div style={{ display:'flex',justifyContent:'flex-end',gap:60 }}>
                <div style={{ textAlign:'right' }}>
                  <div style={{ fontSize:11,color:'var(--text2)',marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end' }}>Costo directo</div>
                  <div style={{ fontSize:11,color:'var(--text2)',marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6 }}>
                    Gastos Generales
                    <input type="number" step="0.1" value={obra.gastos_generales_pct} onChange={e => updatePct('gastos_generales_pct', e.target.value)} style={{ width:40,background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text)',padding:'0 4px',borderRadius:'var(--r2)',fontSize:10,textAlign:'center',height:18 }} />%
                  </div>
                  <div style={{ fontSize:11,color:'var(--text2)',marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end',gap:6 }}>
                    Utilidades
                    <input type="number" step="0.1" value={obra.utilidad_pct} onChange={e => updatePct('utilidad_pct', e.target.value)} style={{ width:40,background:'var(--bg2)',border:'1px solid var(--border2)',color:'var(--text)',padding:'0 4px',borderRadius:'var(--r2)',fontSize:10,textAlign:'center',height:18 }} />%
                  </div>
                  <div style={{ fontSize:11,color:'var(--text2)',marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end' }}>Subtotal Neto</div>
                  <div style={{ fontSize:11,color:'var(--text2)',marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end' }}>IVA (19%)</div>
                  <div style={{ fontSize:11,color:'var(--accent)',fontWeight:800,marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end' }}>PRESUPUESTO TOTAL</div>
                </div>
                <div style={{ textAlign:'right',fontFamily:'Courier New' }}>
                  {[subtotal, gastosGenerales, utilidad, neto, iva, totalPres].map((v,i) => (
                    <div key={i} style={{ fontSize: i===5?14:11,color:i===5?'var(--accent)':'var(--text)',fontWeight:i===5?800:600,marginBottom:6,lineHeight:1.6,height:18,display:'flex',alignItems:'center',justifyContent:'flex-end' }}>{clp(v)}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: COMPRAS ── */}
      {tab === 2 && (
        <div className="tab-panel active">
          <form onSubmit={addCompra} style={{ background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:14,marginBottom:14 }}>
            <div style={{ display:'grid',gridTemplateColumns:'1fr 70px 100px 130px 1fr 120px 44px',gap:8,alignItems:'end' }}>
              <div className="form-group" style={{ margin:0 }}><label>Descripción *</label><input required value={newCompra.descripcion} onChange={e=>setNewCompra({...newCompra,descripcion:e.target.value})}/></div>
              <div className="form-group" style={{ margin:0 }}><label>Und</label><input value={newCompra.unidad} onChange={e=>setNewCompra({...newCompra,unidad:e.target.value})}/></div>
              <div className="form-group" style={{ margin:0 }}><label>Cantidad</label><input type="number" step="0.01" required value={newCompra.cantidad} onChange={e=>setNewCompra({...newCompra,cantidad:e.target.value})}/></div>
              <div className="form-group" style={{ margin:0 }}><label>P. Unitario</label><input type="number" step="0.01" required value={newCompra.precio_unitario} onChange={e=>setNewCompra({...newCompra,precio_unitario:e.target.value})}/></div>
              <div className="form-group" style={{ margin:0 }}><label>Proveedor</label><input value={newCompra.proveedor} onChange={e=>setNewCompra({...newCompra,proveedor:e.target.value})}/></div>
              <div className="form-group" style={{ margin:0 }}><label>Fecha</label><input type="date" value={newCompra.fecha} onChange={e=>setNewCompra({...newCompra,fecha:e.target.value})}/></div>
              <button type="submit" className="btn btn-a" style={{ alignSelf:'flex-end' }}>+</button>
            </div>
          </form>

          <div className="card" style={{ padding:0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>N°</th><th>Descripción</th><th>Und</th><th style={{ textAlign:'right' }}>Cantidad</th><th style={{ textAlign:'right' }}>P. Unitario</th><th style={{ textAlign:'right' }}>Total</th><th>Proveedor</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {data.compras.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin compras registradas.</td></tr>
                  ) : data.compras.map((c,i) => {
                    const tot = c.cantidad * c.precio_unitario;
                    return (
                      <tr key={c.id}>
                        <td className="ts tx">{i+1}</td>
                        <td><strong>{c.descripcion}</strong></td>
                        <td className="ts tx">{c.unidad}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{c.cantidad}</td>
                        <td className="mono" style={{ textAlign:'right' }}>{clp(c.precio_unitario)}</td>
                        <td className="mono" style={{ textAlign:'right',fontWeight:700 }}>{clp(tot)}</td>
                        <td className="ts tx">{c.proveedor||'-'}</td>
                        <td className="ts">{c.fecha||'-'}</td>
                        <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('compras', c.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'12px 18px',borderTop:'1px solid var(--border)',textAlign:'right' }}>
              <span className="ts tx">Total compras: </span>
              <span style={{ fontFamily:'Courier New',fontWeight:800,fontSize:16,color:'var(--accent)',marginLeft:8 }}>{clp(totalComp)}</span>
            </div>
          </div>
          {totalPres > 0 && (
            <div className="card" style={{ border:`1px solid ${totalComp > totalPres ? 'var(--red)' : 'var(--green)'}` }}>
              <div className="fb">
                <span className="ts">Resultado presupuestario</span>
                <span style={{ fontFamily:'Courier New',fontWeight:800,fontSize:16,color: totalPres - totalComp >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalPres - totalComp >= 0 ? '✅' : '⚠️'} {clp(totalPres - totalComp)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: COTIZACIONES ── */}
      {tab === 3 && (
        <div className="tab-panel active">
          <div className="card" style={{ padding:0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>Ítem</th><th>Proveedor</th><th>Monto</th><th>F. Pago</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
                <tbody>
                  {data.cotizaciones.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin cotizaciones. Agrégalas desde el módulo de Cotizaciones.</td></tr>
                  ) : data.cotizaciones.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.item}</strong></td>
                      <td>{c.proveedor}</td>
                      <td className="mono">{clp(c.monto)}</td>
                      <td className="ts tx">{c.forma_pago}</td>
                      <td><Badge estado={c.estado}/></td>
                      <td className="ts tx">{c.notas||'-'}</td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('cotizaciones', c.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 4: SUBCONTRATOS ── */}
      {tab === 4 && (
        <div className="tab-panel active">
          <div className="card" style={{ padding:0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>Empresa</th><th>Especialidad</th><th>Monto</th><th>Avance</th><th>Pagado</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {data.subcontratos.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin subcontratos para esta obra.</td></tr>
                  ) : data.subcontratos.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.empresa}</strong><div className="ts tx">{s.rut||''}</div></td>
                      <td><span style={{ background:'var(--bg4)',padding:'2px 7px',borderRadius:4,fontSize:10,color:'var(--text2)' }}>{s.especialidad}</span></td>
                      <td className="mono">{clp(s.monto_contrato)}</td>
                      <td>
                        <div style={{ display:'flex',alignItems:'center',gap:5 }}>
                          <div className="pb2" style={{ width:50 }}><div className="pf" style={{ width:`${s.avance}%`,background:'var(--green)' }}/></div>
                          {s.avance}%
                        </div>
                      </td>
                      <td className="mono tg">{clp(s.monto_pagado)}</td>
                      <td><Badge estado={s.estado}/></td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('subcontratos', s.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: HITOS ── */}
      {tab === 5 && (
        <div className="tab-panel active">
          {data.hitos.map(h => {
            const col = h.estado==='Completado'?'var(--green)':h.estado==='En curso'?'var(--blue)':h.estado==='Atrasado'?'var(--red)':'var(--bg5)';
            return (
              <div className="gantt-row" key={h.id}>
                <div className="gantt-label" title={h.nombre}>{h.nombre}</div>
                <div className="gantt-bar-wrap">
                  <div className="gantt-bar" style={{ width:`${h.avance||0}%`,background:col }}>{(h.avance||0)>=20?`${h.avance}%`:''}</div>
                  {(h.avance||0)<20 && <span style={{ position:'absolute',right:6,top:'50%',transform:'translateY(-50%)',fontSize:10,color:'var(--text2)' }}>{h.avance||0}%</span>}
                </div>
                <Badge estado={h.estado}/>
                <button className="btn btn-d btn-sm" onClick={() => deleteRow('hitos', h.id)}>✕</button>
              </div>
            );
          })}
          {data.hitos.length === 0 && <div className="empty-state"><div className="empty-icon">📅</div><h3>Sin hitos</h3><p>Agrega hitos desde el módulo de Cronograma</p></div>}
        </div>
      )}

      {/* ── TAB 6: ESTADOS DE PAGO ── */}
      {tab === 6 && (
        <div className="tab-panel active">
          <div className="card" style={{ padding:0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>EPO N°</th><th>Descripción</th><th>Monto bruto</th><th>Neto</th><th>F. Emisión</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {data.estados_pago.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign:'center',padding:24,color:'var(--text3)' }}>Sin estados de pago para esta obra.</td></tr>
                  ) : data.estados_pago.map(ep => {
                    const neto = ep.monto_bruto - Math.round(ep.monto_bruto * ep.retencion_pct / 100);
                    return (
                      <tr key={ep.id}>
                        <td><strong>{ep.numero}</strong></td>
                        <td>{ep.descripcion}</td>
                        <td className="mono">{clp(ep.monto_bruto)}</td>
                        <td className="mono tg">{clp(neto)}</td>
                        <td className="ts">{ep.fecha_emision}</td>
                        <td><Badge estado={ep.estado}/></td>
                        <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('estados_pago', ep.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showEditObra && (
        <Modal title="✏️ Editar datos del proyecto" onClose={() => setShowEditObra(false)}>
          <form onSubmit={handleUpdateObra}>
            <div className="form-group">
              <label>NOMBRE</label>
              <input required value={editForm.nombre} onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })} />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>N° OC / CONTRATO</label>
                <input value={editForm.n_contrato || ''} onChange={(e) => setEditForm({ ...editForm, n_contrato: e.target.value })} />
              </div>
              <div className="form-group">
                <label>CLIENTE</label>
                <input value={editForm.cliente || ''} onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>ITO / INSPECTOR</label>
                <input value={editForm.ito || ''} onChange={(e) => setEditForm({ ...editForm, ito: e.target.value })} />
              </div>
              <div className="form-group">
                <label>RESPONSABLE</label>
                <input value={editForm.responsable || ''} onChange={(e) => setEditForm({ ...editForm, responsable: e.target.value })} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>FECHA INICIO</label>
                <input type="date" value={editForm.fecha_inicio || ''} onChange={(e) => setEditForm({ ...editForm, fecha_inicio: e.target.value })} />
              </div>
              <div className="form-group">
                <label>FECHA TÉRMINO EST.</label>
                <input type="date" value={editForm.fecha_fin || ''} onChange={(e) => setEditForm({ ...editForm, fecha_fin: e.target.value })} />
              </div>
            </div>
            <div className="form-group">
              <label>DESCRIPCIÓN</label>
              <textarea value={editForm.descripcion || ''} onChange={(e) => setEditForm({ ...editForm, descripcion: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => setShowEditObra(false)}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar cambios</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
