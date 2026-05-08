import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { parseNum, today } from '../lib/helpers';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

export default function Logistica() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSol, setSelectedSol] = useState(null);
  const [uploadingFactura, setUploadingFactura] = useState(false);
  const [savingGestion, setSavingGestion] = useState(false);
  
  // Estado para gestión de compra
  const [gestionForm, setGestionForm] = useState({
    monto_total: '',
    lugar_retiro: '',
    detalles_compra: '',
    urgencia: 'Normal'
  });

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('solicitudes_material')
      .select(`
        *,
        obras ( nombre )
      `)
      .order('created_at', { ascending: false });

    if (error) {
      alert('No se pudieron cargar las solicitudes: ' + error.message);
    } else {
      setSolicitudes(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  const handleGestionarCompra = async (e) => {
    e.preventDefault();
    if (!selectedSol || savingGestion) return;

    const montoTotal = parseNum(gestionForm.monto_total);
    const proveedor = (gestionForm.lugar_retiro || '').trim();
    const detalleCompra = (gestionForm.detalles_compra || '').trim();

    if (montoTotal <= 0) {
      alert('El monto total debe ser mayor a cero.');
      return;
    }
    if (!proveedor) {
      alert('Indica el proveedor o lugar de retiro.');
      return;
    }
    if (!detalleCompra) {
      alert('Resume que se compro para que quede registrado en compras y en obra.');
      return;
    }

    const payload = {
      ...gestionForm,
      monto_total: montoTotal,
      estado: 'Comprado',
      updated_at: new Date()
    };

    setSavingGestion(true);
    let compraId = null;

    try {
      const { data: compra, error: compraError } = await supabase
        .from('compras')
        .insert([{
          obra_id: selectedSol.obra_id,
          descripcion: detalleCompra,
          unidad: 'GL',
          cantidad: 1,
          precio_unitario: montoTotal,
          proveedor,
          n_documento: `SOL-${String(selectedSol.id).slice(0, 8)}`,
          fecha: today(),
        }])
        .select('id')
        .single();

      if (compraError) throw compraError;
      compraId = compra?.id || null;

      const { error } = await supabase
        .from('solicitudes_material')
        .update(payload)
        .eq('id', selectedSol.id);

      if (error) throw error;

      setSelectedSol(null);
      setGestionForm({ monto_total: '', lugar_retiro: '', detalles_compra: '', urgencia: 'Normal' });
      fetchSolicitudes();
    } catch (error) {
      if (compraId) await supabase.from('compras').delete().eq('id', compraId);
      alert('Error al gestionar compra: ' + error.message);
    } finally {
      setSavingGestion(false);
    }
  };

  const handleUploadFactura = async (e) => {
    const file = e.target.files[0];
    if (!file || !selectedSol) return;

    setUploadingFactura(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `factura_${selectedSol.id}_${Date.now()}.${fileExt}`;
      const filePath = `facturas/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logistica')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logistica')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('solicitudes_material')
        .update({ foto_factura_url: publicUrl })
        .eq('id', selectedSol.id);
      if (updateError) throw updateError;
      
      alert('Factura/Boleta subida con éxito');
      fetchSolicitudes();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setUploadingFactura(false);
    }
  };

  const updateEstado = async (id, nuevoEstado) => {
    const { error } = await supabase
      .from('solicitudes_material')
      .update({ estado: nuevoEstado, updated_at: new Date() })
      .eq('id', id);
    if (error) {
      alert('No se pudo actualizar el estado: ' + error.message);
      return;
    }
    fetchSolicitudes();
  };

  const moverFecha = async (id, dias) => {
    const sol = solicitudes.find(s => s.id === id);
    let baseDate = sol.fecha_prometida ? new Date(sol.fecha_prometida) : new Date();
    baseDate.setDate(baseDate.getDate() + dias);
    
    const { error } = await supabase
      .from('solicitudes_material')
      .update({ fecha_prometida: baseDate.toISOString() })
      .eq('id', id);
    if (error) {
      alert('No se pudo mover la fecha: ' + error.message);
      return;
    }
    fetchSolicitudes();
  };

  if (loading) return <div className="p20">Cargando logística...</div>;

  const pendientes = solicitudes.filter(s => s.estado === 'Pendiente');
  const paraRetiro = solicitudes.filter(s => s.estado === 'Comprado');
  const enRuta     = solicitudes.filter(s => s.estado === 'En Ruta');

  return (
    <div className="page-container">
      <header className="page-header">
        <div>
          <h1 className="page-title">🚚 Logística y Despachos</h1>
          <p className="page-subtitle">Gestión de compras, retiros y entregas en obra</p>
        </div>
      </header>

      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <span className="stat-label">Por Comprar</span>
          <span className="stat-value" style={{ color:'var(--orange)' }}>{pendientes.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Listos para Retiro</span>
          <span className="stat-value" style={{ color:'var(--accent)' }}>{paraRetiro.length}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">En Ruta</span>
          <span className="stat-value" style={{ color:'var(--blue)' }}>{enRuta.length}</span>
        </div>
      </div>

      <div className="log-layout" style={{ display:'grid', gridTemplateColumns:'1fr 350px', gap:24 }}>
        
        {/* COLUMNA IZQUIERDA: LISTADO DE GESTIÓN */}
        <div className="log-main">
          <h2 style={{ fontSize:18, marginBottom:16 }}>📦 Solicitudes de Compra (Terreno)</h2>
          {pendientes.length === 0 ? (
            <div className="card tx-c" style={{ padding:40, color:'var(--text3)' }}>No hay solicitudes de compra pendientes.</div>
          ) : (
            <div className="sol-list" style={{ display:'flex', flexDirection:'column', gap:12 }}>
              {pendientes.map(s => (
                <div className="card" key={s.id} style={{ display:'flex', gap:16, alignItems:'center' }}>
                  <img src={s.foto_pedido_url} style={{ width:80, height:80, borderRadius:8, objectFit:'cover', cursor:'pointer' }} onClick={() => window.open(s.foto_pedido_url, '_blank')} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
                      <span style={{ fontWeight:800, fontSize:15 }}>{s.obras?.nombre}</span>
                      <Badge estado={s.estado} />
                      {s.urgencia === 'Urgente' && <span className="badge-red">URGENTE</span>}
                    </div>
                    <div style={{ fontWeight:600 }}>{s.titulo}</div>
                    <div className="ts tx">Pedido hace {Math.floor((new Date() - new Date(s.created_at))/(1000*60*60))} horas</div>
                  </div>
                  <button className="btn btn-a" onClick={() => {
                    setSelectedSol(s);
                    setGestionForm({ monto_total: s.monto_total || '', lugar_retiro: s.lugar_retiro || '', detalles_compra: s.detalles_compra || '', urgencia: s.urgencia });
                  }}>Gestionar Compra</button>
                </div>
              ))}
            </div>
          )}

          <h2 style={{ fontSize:18, marginTop:32, marginBottom:16 }}>🚛 Hoja de Ruta (Camionero)</h2>
          <div className="ruta-columns" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            {/* COLUMNA: LISTOS PARA RETIRO */}
            <div className="ruta-col">
              <div className="card-title" style={{ fontSize:14, marginBottom:10, color:'var(--accent)' }}>🏭 LISTOS PARA RETIRO</div>
              {paraRetiro.map(s => (
                <div className="card" key={s.id} style={{ marginBottom:10, padding:12 }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{s.obras?.nombre}</div>
                  <div style={{ fontSize:12, marginBottom:8 }}>📍 {s.lugar_retiro || 'Sin lugar definido'}</div>
                  <div style={{ display:'flex', gap:6 }}>
                    <button className="btn btn-s btn-sm" onClick={() => window.open(s.foto_factura_url, '_blank')} disabled={!s.foto_factura_url}>📄 Ver Factura</button>
                    <button className="btn btn-a btn-sm" onClick={() => updateEstado(s.id, 'En Ruta')}>🚚 Cargar</button>
                  </div>
                </div>
              ))}
            </div>
            {/* COLUMNA: EN RUTA / ENTREGANDO */}
            <div className="ruta-col">
              <div className="card-title" style={{ fontSize:14, marginBottom:10, color:'var(--blue)' }}>🛣️ EN RUTA A OBRA</div>
              {enRuta.map(s => (
                <div className="card" key={s.id} style={{ marginBottom:10, padding:12, borderLeft:'4px solid var(--blue)' }}>
                  <div style={{ fontWeight:700, fontSize:13 }}>{s.obras?.nombre}</div>
                  <div style={{ fontSize:12, marginBottom:8 }}>Contenido: {s.detalles_compra || 'Materiales varios'}</div>
                  <button className="btn btn-g btn-sm" style={{ width:'100%' }} onClick={() => updateEstado(s.id, 'Entregado')}>✅ Entregado en Obra</button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: CALENDARIO / AGENDA */}
        <div className="log-side">
          <div className="card" style={{ position:'sticky', top:20 }}>
            <div className="card-title">📅 Agenda de Despachos</div>
            <p className="ts tx">Planificación semanal del camión</p>
            <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:10 }}>
               {solicitudes.filter(s => s.estado !== 'Entregado').slice(0, 5).map(s => (
                 <div key={s.id} style={{ padding:10, background:'var(--bg2)', borderRadius:8, fontSize:12 }}>
                    <div style={{ fontWeight:700 }}>{s.obras?.nombre}</div>
                    <div className="tx">Prog: {s.fecha_prometida ? new Date(s.fecha_prometida).toLocaleDateString() : 'Sin fecha'}</div>
                    <div style={{ display:'flex', gap:4, marginTop:6 }}>
                      <button className="btn btn-s btn-sm" style={{ padding:'2px 6px' }} onClick={() => moverFecha(s.id, 1)}>+1 día</button>
                      <button className="btn btn-s btn-sm" style={{ padding:'2px 6px' }} onClick={() => moverFecha(s.id, -1)}>-1 día</button>
                    </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Gestión de Compra */}
      {selectedSol && (
        <Modal title="🛒 Gestionar Compra de Material" onClose={() => setSelectedSol(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'150px 1fr', gap:20 }}>
            <div onClick={() => window.open(selectedSol.foto_pedido_url, '_blank')}>
              <p className="ts tx tx-c">Lista Pedida</p>
              <img src={selectedSol.foto_pedido_url} style={{ width:'100%', borderRadius:8, cursor:'zoom-in' }} />
            </div>
            <form onSubmit={handleGestionarCompra}>
              <div className="form-group">
                <label>Monto Total Bruto ($)</label>
                <input type="number" required value={gestionForm.monto_total} onChange={e=>setGestionForm({...gestionForm, monto_total: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Lugar de Retiro (Proveedor / Sucursal)</label>
                <input type="text" required placeholder="Ej: Sodimac Las Condes" value={gestionForm.lugar_retiro} onChange={e=>setGestionForm({...gestionForm, lugar_retiro: e.target.value})} />
              </div>
              <div className="form-group">
                <label>Resumen de Compra (para el camionero)</label>
                <textarea rows="3" placeholder="Ej: 20 sacos cemento, 10 tablas 2x4" value={gestionForm.detalles_compra} onChange={e=>setGestionForm({...gestionForm, detalles_compra: e.target.value})}></textarea>
              </div>

              <div style={{ marginTop:16, padding:12, background:'var(--bg3)', borderRadius:8 }}>
                <label style={{ display:'block', marginBottom:8, fontWeight:700 }}>📄 Adjuntar Boleta/Factura (Para retiro)</label>
                <input type="file" accept="image/*,application/pdf" onChange={handleUploadFactura} disabled={uploadingFactura} />
                {uploadingFactura && <p className="ts tx">Subiendo documento...</p>}
                {selectedSol.foto_factura_url && <p className="ts tx" style={{ color:'var(--green)' }}>✓ Documento adjunto</p>}
              </div>

              <div className="modal-actions" style={{ marginTop:20 }}>
                <button type="button" className="btn btn-s" onClick={() => setSelectedSol(null)}>Cancelar</button>
                <button type="submit" className="btn btn-a" disabled={savingGestion}>
                  {savingGestion ? 'Guardando...' : 'Confirmar Compra y Enviar a Camión'}
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}
    </div>
  );
}
