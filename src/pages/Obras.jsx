import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { clp, calcPresupuesto, calcCompras, calcAsistencia, semaforoColor } from '../lib/helpers';
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

  const fetchObras = useCallback(async () => {
    const { data, error } = await supabase
      .from('obras')
      .select(`
        id, nombre, tipo, direccion, estado, avance, responsable, n_contrato,
        gastos_generales_pct, utilidad_pct, fecha_fin,
        presupuesto_items ( cantidad, precio_unitario ),
        compras ( cantidad, precio_unitario ),
        asistencia ( total_pago )
      `)
      .eq('departamento', 'Construcción')
      .order('created_at', { ascending: false });

    if (!error) {
      setObras(data.map((o) => ({
        ...o,
        totalPres: calcPresupuesto(o.presupuesto_items || [], o.gastos_generales_pct, o.utilidad_pct).total,
        totalCompras: calcCompras(o.compras || []) + calcAsistencia(o.asistencia || []),
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchObras(); }, [fetchObras]);

  const toNum = (v, def = null) => v === '' || v === undefined ? def : Number(v);

  const handleSave = async (e) => {
    e.preventDefault();
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
    const { error } = await supabase.from('obras').insert([payload]);
    if (!error) { setShowModal(false); setForm(EMPTY); fetchObras(); }
    else alert('Error: ' + error.message);
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!confirm('¿Eliminar esta obra y todos sus datos?')) return;
    await supabase.from('obras').delete().eq('id', id);
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
          <h2>Obras</h2>
          <p>Gestión completa del portafolio de proyectos</p>
        </div>
        <button className="btn btn-a" onClick={() => setShowModal(true)}>+ Nueva obra</button>
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
    </div>
  );
}
