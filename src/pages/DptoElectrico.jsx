import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { clp, calcPresupuesto, calcCostoReal, semaforoColor, parseNum } from '../lib/helpers';
import { validateObraForm } from '../lib/validators';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const TIPOS = ['Diseño de proyecto', 'Ejecución Eléctrica'];
const ESTADOS_POR_TIPO = {
  'Diseño de proyecto': ['En Estudio', 'Esperando OC', 'En Ejecución', 'En Revisión', 'Esperando Pago', 'Finalizado'],
  'Ejecución Eléctrica': ['Licitación', 'En Ejecución', 'Finalizada', 'Pausada'],
};

const EMPTY = {
  nombre: '', tipo: 'Diseño de proyecto', direccion: '', cliente: '',
  ito: '', superficie: '', responsable: '',
  estado: 'En Estudio', n_contrato: '', fecha_inicio: '', fecha_fin: '',
  descripcion: '', obra_padre_id: '',
};

export default function DptoElectrico() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [obras, setObras]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroTipo,   setFiltroTipo]   = useState('');
  const [obrasMadre, setObrasMadre] = useState([]);

  const [deletingId, setDeletingId] = useState(null);
  const [deletePass, setDeletePass] = useState('');

  const fetchObras = useCallback(async () => {
    const [{ data }, { data: obrasConstruccion }] = await Promise.all([
      supabase
        .from('obras')
        .select(`
          id, nombre, tipo, direccion, estado, avance, responsable, n_contrato,
          gastos_generales_pct, utilidad_pct, fecha_fin,
          presupuesto_items ( cantidad, precio_unitario ),
          compras ( cantidad, precio_unitario ),
          asistencia ( total_pago ),
          subcontratos ( monto_contrato )
        `)
        .eq('departamento', 'Eléctrico')
        .order('created_at', { ascending: false }),
      supabase.from('obras').select('id, nombre').eq('departamento', 'Construcción')
    ]);

    if (data) {
      setObras(data.map((o) => ({
        ...o,
        totalPres: calcPresupuesto(o.presupuesto_items || [], o.gastos_generales_pct, o.utilidad_pct).total,
        totalCompras: calcCostoReal({ compras: o.compras || [], asistencia: o.asistencia || [], subcontratos: o.subcontratos || [] }).total,
      })));
    }
    if (obrasConstruccion) setObrasMadre(obrasConstruccion);
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
      departamento:         'Eléctrico',
      avance:               0,
      superficie:           toNum(form.superficie, 0),
      gastos_generales_pct: 15,
      utilidad_pct:         10,
      fecha_inicio:         form.fecha_inicio || null,
      fecha_fin:            form.fecha_fin    || null,
      obra_padre_id:        form.tipo === 'Ejecución Eléctrica' && form.obra_padre_id ? form.obra_padre_id : null,
    };
    const { error } = await supabase.from('obras').insert([payload]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchObras(); }
    else alert('Error: ' + error.message);
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
      alert('No se pudo eliminar el proyecto: ' + error.message);
      return;
    }
    setDeletingId(null);
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
          <h2>Departamento Eléctrico</h2>
          <p>Gestión completa de proyectos eléctricos</p>
        </div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nuevo proyecto eléctrico</button>
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
            {ESTADOS_POR_TIPO['Diseño de proyecto'].concat(ESTADOS_POR_TIPO['Ejecución Eléctrica']).map((e) => <option key={e}>{e}</option>)}
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
            <div className="empty-icon">⚡</div>
            <h3>No hay proyectos eléctricos</h3>
            <p>Crea tu primer proyecto con el botón superior</p>
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
        <Modal title="⚡ Nuevo proyecto eléctrico" onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-grid">
              <div className="form-group">
                <label>NOMBRE *</label>
                <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} placeholder="Ej: Torre Alameda 1200" />
              </div>
              <div className="form-group">
                <label>TIPO</label>
                <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value, estado: ESTADOS_POR_TIPO[e.target.value][0] })}>
                  {TIPOS.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            {form.tipo === 'Ejecución Eléctrica' && (
              <div className="form-group">
                <label>OBRA ASOCIADA (Opcional)</label>
                <select value={form.obra_padre_id} onChange={(e) => setForm({ ...form, obra_padre_id: e.target.value })}>
                  <option value="">Ninguna - Proyecto independiente</option>
                  {obrasMadre.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                </select>
              </div>
            )}
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
                <label>N° OC / CONTRATO (Opcional)</label>
                <input value={form.n_contrato} onChange={(e) => setForm({ ...form, n_contrato: e.target.value })} placeholder="Dejar en blanco si aún no hay OC" />
              </div>
            </div>
            <div className="form-group">
              <label>ESTADO</label>
              <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })}>
                {ESTADOS_POR_TIPO[form.tipo].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>DESCRIPCIÓN</label>
              <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción general del proyecto..." />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar proyecto</button>
            </div>
          </form>
        </Modal>
      )}
      {/* Modal Confirmar Eliminación */}
      {deletingId && (
        <Modal title="⚠️ Confirmar Eliminación" onClose={() => setDeletingId(null)}>
          <div style={{ textAlign: 'center' }}>
            <p>Estás a punto de eliminar el proyecto eléctrico y <strong>todos sus registros asociados</strong>.</p>
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
