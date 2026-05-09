import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { clp, calcPresupuesto, calcCostoReal, semaforoColor, parseNum } from '../lib/helpers';
import { validateObraForm } from '../lib/validators';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const TIPOS = ['Edificio residencial', 'Edificio oficinas', 'Casa', 'Industria', 'Infraestructura', 'Remodelación'];
const ESTADOS = ['En Progreso', 'Licitación', 'Activa', 'Pausada', 'Finalizada'];

const EMPTY = {
  nombre: '', tipo: 'Edificio residencial', direccion: '', cliente: '',
  ito: '', superficie: '', responsable: '',
  estado: 'En Progreso', n_contrato: '', fecha_inicio: '', fecha_fin: '',
  descripcion: '',
};

export default function Obras() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [obras, setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo,   setFiltroTipo]   = useState('');
  
  const [deletingId, setDeletingId] = useState(null);
  const [deletePass, setDeletePass] = useState('');

  const fetchObras = useCallback(async () => {
    const [{ data: constructionData }, { data: electricData }] = await Promise.all([
      supabase
        .from('obras')
        .select(`
          id, nombre, tipo, direccion, estado, avance, responsable, n_contrato,
          cliente, ito, fecha_inicio, fecha_fin,
          gastos_generales_pct, utilidad_pct,
          presupuesto_items ( cantidad, precio_unitario ),
          compras ( cantidad, precio_unitario ),
          asistencia ( total_pago ),
          subcontratos ( monto_contrato )
        `)
        .eq('departamento', 'Construcción')
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('obra_padre_id').eq('departamento', 'Eléctrico').not('obra_padre_id', 'is', null)
    ]);

    if (constructionData) {
      const mirroredIds = new Set(electricData?.map(e => e.obra_padre_id) || []);
      setObras(constructionData.map((o) => ({
        ...o,
        totalPres: calcPresupuesto(o.presupuesto_items || [], o.gastos_generales_pct, o.utilidad_pct).total,
        totalCompras: calcCostoReal({ compras: o.compras || [], asistencia: o.asistencia || [], subcontratos: o.subcontratos || [] }).total,
        hasMirror: mirroredIds.has(o.id)
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  const toNum = (v, def = null) => v === '' || v === undefined ? def : parseNum(v);

  const handleSave = async (e) => {
    e.preventDefault();
    const errors = validateObraForm(form);
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    const payload = {
      ...form,
      user_id: user.id,
      departamento:         'Construcción',
      avance:               0,
      superficie:           toNum(form.superficie, 0),
      gastos_generales_pct: 15,
      utilidad_pct:         10,
      fecha_inicio:         form.fecha_inicio || null,
      fecha_fin:            form.fecha_fin    || null,
    };
    const { data: mainObra, error } = await supabase.from('obras').insert([payload]).select().single();
    if (!error && mainObra) {
      // 1. Crear Obra Espejo Eléctrica
      const electricalPayload = {
        ...payload,
        nombre: `${payload.nombre} (ELÉCTRICO)`,
        departamento: 'Eléctrico',
        tipo: 'Ejecución Eléctrica',
        obra_padre_id: mainObra.id
      };
      await supabase.from('obras').insert([electricalPayload]);

      // 2. Crear Partida Eléctrica base en la obra de construcción
      const defaultItem = {
        obra_id: mainObra.id,
        codigo: '4.1',
        descripcion: 'Instalación Eléctrica (Detalle en Depto. Eléctrico)',
        unidad: 'GL',
        cantidad: 1,
        precio_unitario: 0
      };
      await supabase.from('presupuesto_items').insert([defaultItem]);

      setShowModal(false); 
      setForm(EMPTY); 
      fetchObras(); 
    }
    else alert('Error: ' + error?.message);
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    setDeletingId(id);
    setDeletePass('');
  };

  const confirmDelete = async () => {
    if (deletePass !== 'ELIMINAR') {
      alert('Escribe ELIMINAR para confirmar');
      return;
    }
    const { error } = await supabase.from('obras').delete().eq('id', deletingId);
    if (error) {
      alert('No se pudo eliminar la obra: ' + error.message);
      return;
    }
    setDeletingId(null);
    fetchObras();
  };

  const syncMirror = async (e, obra) => {
    e.stopPropagation();
    if (!confirm(`¿Crear espejo eléctrico para "${obra.nombre}"?`)) return;
    
    // 1. Crear Espejo
    const { data: mirror, error: err1 } = await supabase.from('obras').insert([{
      nombre: `${obra.nombre} (ELÉCTRICO)`,
      departamento: 'Eléctrico',
      tipo: 'Ejecución Eléctrica',
      obra_padre_id: obra.id,
      estado: obra.estado,
      direccion: obra.direccion,
      cliente: obra.cliente,
      ito: obra.ito,
      responsable: obra.responsable,
      fecha_inicio: obra.fecha_inicio,
      fecha_fin: obra.fecha_fin
    }]).select().single();

    if (err1) return alert('Error al crear espejo: ' + err1.message);

    // 2. Crear Partida Base en la obra de construcción
    const { error: err2 } = await supabase.from('presupuesto_items').insert([{
      obra_id: obra.id,
      codigo: '4.1',
      descripcion: 'Instalación Eléctrica (Detalle en Depto. Eléctrico)',
      unidad: 'GL',
      cantidad: 1,
      precio_unitario: 0
    }]);

    if (err2) alert('Error al crear partida: ' + err2.message);
    
    fetchObras();
  };

  const filtradas = obras.filter((o) =>
    (!filtroEstado || o.estado === filtroEstado) &&
    (!filtroTipo   || o.tipo   === filtroTipo)
  );

  if (loading) return <div className="loading-center"><div className="spinner" />Cargando obras...</div>;

  return (
    <div>
      <div className="ph">
        <div>
          <h2>Listado de Obras</h2>
          <p>Control de presupuestos y avance por proyecto</p>
        </div>
        <div className="fg2">
          <button className="btn btn-s" onClick={() => navigate('/licitaciones?new=1')}>Ingreso de Licitacion</button>
          <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nueva obra de construcción</button>
        </div>
      </div>

      <div className="pb">
        {/* Filtros */}
        <div className="fg2" style={{ marginBottom: 14 }}>
          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 'var(--r2)', fontSize: 11 }}
          >
            <option value="">Todos los estados</option>
            {ESTADOS.map((e) => <option key={e}>{e}</option>)}
          </select>
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 'var(--r2)', fontSize: 11 }}
          >
            <option value="">Todos los tipos</option>
            {TIPOS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>

        {/* Lista de obras */}
        {filtradas.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🏢</div>
            <h3>No hay obras</h3>
            <p>Crea tu primera obra con el botón "Nueva obra"</p>
          </div>
        ) : filtradas.map((o) => {
          const dif   = o.totalPres - o.totalCompras;
          const color = semaforoColor(o.totalPres, o.totalCompras);
          return (
            <div className="obra-row" key={o.id} onClick={() => navigate(`/obra/${o.id}`)}>
              <div className="fb" style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="semaforo" style={{ background: color }} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 800 }}>{o.nombre}</div>
                    <div className="ts tx">{o.tipo} · {o.direccion || 'Sin dirección'} · {o.n_contrato || 'Sin contrato'}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Badge estado={o.estado} />
                  {!o.hasMirror && (
                    <button 
                      className="btn btn-s btn-sm" 
                      onClick={(e) => syncMirror(e, o)}
                      title="Sincronizar con Depto. Eléctrico"
                      style={{ 
                        background: 'rgba(52, 211, 153, 0.1)', 
                        border: '1px solid var(--green)', 
                        color: 'var(--green)',
                        fontSize: '9px',
                        padding: '2px 6px',
                        fontWeight: 700
                      }}
                    >
                      ⚡ ESPEJAR
                    </button>
                  )}
                  <button className="btn btn-s btn-sm" onClick={(e) => { e.stopPropagation(); navigate(`/obra/${o.id}`); }}>
                    Ver →
                  </button>
                  <button className="btn btn-d btn-sm" onClick={(e) => handleDelete(e, o.id)}>
                    🗑
                  </button>
                </div>
              </div>

              {/* Progress */}
              <div style={{ marginBottom: 8 }}>
                <div className="fb ts tx" style={{ marginBottom: 4 }}>
                  <span>Avance general</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)' }}>{o.avance || 0}%</span>
                </div>
                <div className="pb2">
                  <div className="pf" style={{
                    width: `${o.avance || 0}%`,
                    background: (o.avance || 0) >= 80 ? 'var(--green)' : (o.avance || 0) >= 40 ? 'var(--accent)' : 'var(--blue)',
                  }} />
                </div>
              </div>

              {/* Stats */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginTop: 10 }}>
                {[
                  ['Presupuesto', clp(o.totalPres)],
                  ['Gasto real', clp(o.totalCompras)],
                  ['Resultado', clp(dif), dif >= 0 ? 'var(--green)' : 'var(--red)'],
                  ['Responsable', o.responsable || '-'],
                  ['Término est.', o.fecha_fin || '-'],
                ].map(([label, value, c]) => (
                  <div key={label}>
                    <div className="ts tx">{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: c || 'var(--text)', fontFamily: c ? 'Courier New' : 'inherit' }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Nueva Obra */}
      {showModal && (
        <Modal title="🏢 Nueva obra" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label>NOMBRE *</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Torre Alameda 1200" />
              </div>
              <div className="form-group">
                <label>TIPO</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>DIRECCIÓN</label>
              <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} placeholder="Av. Principal 1234, Santiago" />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>MANDANTE / CLIENTE</label>
                <input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Nombre del cliente" />
              </div>
              <div className="form-group">
                <label>ITO / INSPECTOR</label>
                <input value={form.ito} onChange={(e) => setForm({ ...form, ito: e.target.value })} placeholder="Nombre inspector técnico" />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>FECHA INICIO</label>
                <input type="date" value={form.fecha_inicio} onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })} />
              </div>
              <div className="form-group">
                <label>FECHA TÉRMINO EST.</label>
                <input type="date" value={form.fecha_fin} onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>RESPONSABLE</label>
                <input value={form.responsable} onChange={(e) => setForm({ ...form, responsable: e.target.value })} placeholder="Jefe de obra" />
              </div>
              <div className="form-group">
                <label>N° CONTRATO</label>
                <input value={form.n_contrato} onChange={(e) => setForm({ ...form, n_contrato: e.target.value })} placeholder="CT-2025-001" />
              </div>
            </div>
            <div className="form-group">
              <label>ESTADO</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>DESCRIPCIÓN</label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción general del proyecto..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar obra</button>
            </div>
          </form>
        </Modal>
      )}
      {/* Modal Confirmar Eliminación */}
      {deletingId && (
        <Modal title="⚠️ Confirmar Eliminación" onClose={() => setDeletingId(null)}>
          <div style={{ textAlign: 'center' }}>
            <p>Estás a punto de eliminar la obra y <strong>todos sus registros asociados</strong> (presupuesto, compras, asistencia, etc.).</p>
            <p style={{ color: 'var(--red)', fontWeight: 700, marginBottom: 20 }}>Esta acción es irreversible.</p>
            
            <div className="form-group">
              <label>CONFIRMACIÓN</label>
              <input 
                type="password" 
                value={deletePass} 
                onChange={(e) => setDeletePass(e.target.value)} 
                placeholder="Escribe ELIMINAR"
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 4 }}
                autoFocus
              />
            </div>
            
            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn btn-s" onClick={() => setDeletingId(null)}>Cancelar</button>
              <button className="btn btn-d" onClick={confirmDelete}>Eliminar Definitivamente</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
