import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ClipboardPlus, Pencil, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fmtDate } from '../lib/helpers';
import {
  ESPECIALIDADES,
  ESPECIALIDAD_ESTADOS,
  LICITACION_ESTADOS,
  LICITACION_FINALIZADA,
  daysUntil,
  emptyLicitacion,
  getHealthColor,
  getHealthLabel,
  getLicitacionHealth,
  getPendingSpecialties,
  getSpecialtyState,
  normalizeLicitacionPayload,
  specialtyToneClass,
} from '../lib/licitaciones';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import PageHeader from '../components/PageHeader';

const buildForm = (row = null) => {
  if (!row) return { ...emptyLicitacion };
  return {
    ...emptyLicitacion,
    ...row,
    fecha_recepcion: row.fecha_recepcion || '',
    fecha_entrega: row.fecha_entrega || '',
    clima_fecha_envio: row.clima_fecha_envio || '',
    clima_fecha_recepcion: row.clima_fecha_recepcion || '',
    incendio_fecha_envio: row.incendio_fecha_envio || '',
    incendio_fecha_recepcion: row.incendio_fecha_recepcion || '',
    mobiliario_fecha_envio: row.mobiliario_fecha_envio || '',
    mobiliario_fecha_recepcion: row.mobiliario_fecha_recepcion || '',
  };
};

export default function Licitaciones() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [licitaciones, setLicitaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showForm, setShowForm] = useState(searchParams.get('new') === '1');
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(buildForm());
  const [filtroEstado, setFiltroEstado] = useState('Activas');

  const fetchLicitaciones = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('licitaciones')
      .select('*')
      .order('fecha_entrega', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });

    if (error) {
      setErrorMsg('No se pudieron cargar las licitaciones. Revisa que la tabla licitaciones exista en Supabase.');
      setLicitaciones([]);
    } else {
      setErrorMsg('');
      setLicitaciones(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchLicitaciones(); }, [fetchLicitaciones]);

  useEffect(() => {
    const channel = supabase
      .channel('licitaciones-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'licitaciones' }, fetchLicitaciones)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLicitaciones]);

  useEffect(() => {
    if (searchParams.get('new') === '1') {
      setEditingId(null);
      setForm(buildForm());
      setShowForm(true);
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return licitaciones
      .filter((l) => {
        if (filtroEstado === 'Activas') return !LICITACION_FINALIZADA.includes(l.estado);
        if (filtroEstado === 'Todas') return true;
        return l.estado === filtroEstado;
      })
      .sort((a, b) => (a.fecha_entrega || '9999-12-31').localeCompare(b.fecha_entrega || '9999-12-31'));
  }, [licitaciones, filtroEstado]);

  const stats = useMemo(() => {
    const activas = licitaciones.filter((l) => !LICITACION_FINALIZADA.includes(l.estado));
    const riesgo = activas.filter((l) => getLicitacionHealth(l) === 'danger').length;
    const listas = activas.filter((l) => getLicitacionHealth(l) === 'ready').length;
    return { activas: activas.length, riesgo, listas };
  }, [licitaciones]);

  const resetForm = () => {
    setEditingId(null);
    setForm(buildForm());
    setShowForm(false);
    setSearchParams({});
  };

  const openNew = () => {
    setEditingId(null);
    setForm(buildForm());
    setShowForm(true);
    setSearchParams({ new: '1' });
  };

  const openEdit = (licitacion) => {
    setEditingId(licitacion.id);
    setForm(buildForm(licitacion));
    setShowForm(true);
    setSearchParams({});
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = [];
    if (!(form.nombre_licitacion || '').trim()) errors.push('El nombre de la licitacion es obligatorio.');
    if (!form.fecha_entrega) errors.push('La fecha limite de entrega es obligatoria.');
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    setSaving(true);
    const payload = normalizeLicitacionPayload({
      ...form,
      nombre_licitacion: form.nombre_licitacion.trim(),
      cliente: (form.cliente || '').trim(),
      direccion: (form.direccion || '').trim(),
      responsable: (form.responsable || '').trim(),
      observaciones: (form.observaciones || '').trim(),
    });

    delete payload.id;
    delete payload.created_at;
    delete payload.updated_at;
    delete payload.user_id;

    const request = editingId
      ? supabase.from('licitaciones').update(payload).eq('id', editingId)
      : supabase.from('licitaciones').insert([{ ...payload, user_id: user.id }]);

    const { error } = await request;
    setSaving(false);

    if (error) {
      alert('No se pudo guardar la licitacion: ' + error.message);
      return;
    }

    resetForm();
    fetchLicitaciones();
  };

  const updateQuickSpecialty = async (licitacion, key, estado) => {
    const payload = { [`${key}_estado`]: estado };
    if (estado === 'No aplica') {
      payload[`${key}_fecha_envio`] = null;
      payload[`${key}_fecha_recepcion`] = null;
    }

    const { error } = await supabase.from('licitaciones').update(payload).eq('id', licitacion.id);
    if (error) alert('No se pudo actualizar la especialidad: ' + error.message);
    else fetchLicitaciones();
  };

  return (
    <div>
      <PageHeader
        eyebrow="Postulaciones y propuestas"
        title="Licitaciones"
        subtitle="Control de fechas criticas, responsables y especialidades externas"
        actions={(
          <button className="btn btn-a" onClick={openNew}>
            <ClipboardPlus size={15} strokeWidth={1.9} />
            Ingreso de Licitacion
          </button>
        )}
      />

      <div className="pb">
        {errorMsg && <div className="card lic-alert-card">{errorMsg}</div>}

        <div className="licitacion-kpis">
          <div className="licitacion-kpi">
            <span>Activas</span>
            <strong>{stats.activas}</strong>
          </div>
          <div className="licitacion-kpi warning">
            <span>En riesgo</span>
            <strong>{stats.riesgo}</strong>
          </div>
          <div className="licitacion-kpi success">
            <span>Listas</span>
            <strong>{stats.listas}</strong>
          </div>
        </div>

        {showForm && (
          <div className="card lic-form-card">
            <div className="fb" style={{ marginBottom: 14 }}>
              <div>
                <div className="card-title" style={{ marginBottom: 2 }}>
                  {editingId ? 'Editar licitacion' : 'Ingreso de Licitacion'}
                </div>
                <div className="ts tx">Nombre y fecha de entrega son obligatorios. Las especialidades en "No aplica" se consideran resueltas.</div>
              </div>
              <button type="button" className="btn btn-s btn-sm" onClick={resetForm}>Cerrar</button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-grid">
                <div className="form-group">
                  <label>NOMBRE LICITACION *</label>
                  <input value={form.nombre_licitacion} onChange={(e) => setField('nombre_licitacion', e.target.value)} placeholder="Ej: Local Mall Plaza Norte" />
                </div>
                <div className="form-group">
                  <label>CLIENTE / MANDANTE</label>
                  <input value={form.cliente} onChange={(e) => setField('cliente', e.target.value)} placeholder="Mandante o inmobiliaria" />
                </div>
              </div>

              <div className="form-group">
                <label>DIRECCION / UBICACION</label>
                <input value={form.direccion} onChange={(e) => setField('direccion', e.target.value)} placeholder="Direccion del proyecto" />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>RECEPCION ANTECEDENTES</label>
                  <input type="date" value={form.fecha_recepcion} onChange={(e) => setField('fecha_recepcion', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>FECHA LIMITE ENTREGA *</label>
                  <input type="date" value={form.fecha_entrega} onChange={(e) => setField('fecha_entrega', e.target.value)} />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label>RESPONSABLE</label>
                  <input value={form.responsable} onChange={(e) => setField('responsable', e.target.value)} placeholder="Responsable interno" />
                </div>
                <div className="form-group">
                  <label>ESTADO LICITACION</label>
                  <select value={form.estado} onChange={(e) => setField('estado', e.target.value)}>
                    {LICITACION_ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
                  </select>
                </div>
              </div>

              <div className="licitacion-specialties-form">
                {ESPECIALIDADES.map(({ key, label }) => {
                  const estado = form[`${key}_estado`];
                  const noAplica = estado === 'No aplica';
                  return (
                    <div className="specialty-edit-card" key={key}>
                      <div className="specialty-edit-title">{label}</div>
                      <div className="form-group">
                        <label>ESTADO</label>
                        <select value={estado} onChange={(e) => setField(`${key}_estado`, e.target.value)}>
                          {ESPECIALIDAD_ESTADOS.map((opt) => <option key={opt}>{opt}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>FECHA ENVIO</label>
                        <input
                          type="date"
                          value={form[`${key}_fecha_envio`]}
                          disabled={noAplica}
                          onChange={(e) => setField(`${key}_fecha_envio`, e.target.value)}
                        />
                      </div>
                      <div className="form-group">
                        <label>FECHA RECEPCION</label>
                        <input
                          type="date"
                          value={form[`${key}_fecha_recepcion`]}
                          disabled={noAplica}
                          onChange={(e) => setField(`${key}_fecha_recepcion`, e.target.value)}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="form-group">
                <label>OBSERVACIONES</label>
                <textarea value={form.observaciones} onChange={(e) => setField('observaciones', e.target.value)} placeholder="Notas generales, riesgos, condicionantes o alcance pendiente..." />
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-s" onClick={resetForm}>Cancelar</button>
                <button type="submit" className="btn btn-a" disabled={saving}>{saving ? 'Guardando...' : 'Guardar licitacion'}</button>
              </div>
            </form>
          </div>
        )}

        <div className="fg2 lic-toolbar">
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option>Activas</option>
            <option>Todas</option>
            {LICITACION_ESTADOS.map((estado) => <option key={estado}>{estado}</option>)}
          </select>
          <button className="btn btn-s btn-sm" onClick={fetchLicitaciones}>
            <RefreshCw size={14} strokeWidth={1.9} />
            Actualizar
          </button>
        </div>

        <div className="card data-card" style={{ padding: 0 }}>
          <div className="card-title" style={{ padding: '14px 16px 0' }}>Seguimiento de licitaciones</div>
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
                  <th>Observaciones</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Cargando licitaciones...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No hay licitaciones para el filtro seleccionado</td></tr>
                ) : filtered.map((l) => {
                  const health = getLicitacionHealth(l);
                  const days = daysUntil(l.fecha_entrega);
                  const pending = getPendingSpecialties(l);
                  return (
                    <tr key={l.id}>
                      <td className="lic-status-cell"><div className="semaforo" style={{ background: getHealthColor(health) }} /></td>
                      <td data-label="Licitacion">
                        <div className="lic-name">{l.nombre_licitacion}</div>
                        <div className="ts tx">{l.cliente || 'Sin mandante'} · {l.direccion || 'Sin ubicacion'}</div>
                        {health === 'danger' && (
                          <div className="lic-risk-line">
                            <AlertTriangle size={12} strokeWidth={2} />
                            {getHealthLabel(l)}
                          </div>
                        )}
                      </td>
                      <td data-label="Entrega">
                        <div className="mono">{fmtDate(l.fecha_entrega)}</div>
                        <div className={`ts ${days !== null && days < 3 && pending.length ? 'tr2' : 'tx'}`}>
                          {days === null ? '-' : days < 0 ? `Vencio hace ${Math.abs(days)} d` : `${days} d restantes`}
                        </div>
                      </td>
                      <td data-label="Estado"><Badge estado={l.estado} /></td>
                      <td data-label="Responsable">{l.responsable || '-'}</td>
                      <td data-label="Especialidades">
                        <div className="specialty-stack">
                          {ESPECIALIDADES.map(({ key, label }) => {
                            const estado = getSpecialtyState(l, key);
                            return (
                              <label className={`specialty-pill ${specialtyToneClass(estado)}`} key={key}>
                                <span>{label}</span>
                                <select value={estado} onChange={(e) => updateQuickSpecialty(l, key, e.target.value)}>
                                  {ESPECIALIDAD_ESTADOS.map((opt) => <option key={opt}>{opt}</option>)}
                                </select>
                              </label>
                            );
                          })}
                        </div>
                      </td>
                      <td data-label="Observaciones" className="lic-notes">{l.observaciones || '-'}</td>
                      <td className="lic-actions-cell">
                        <button className="btn btn-s btn-sm" onClick={() => openEdit(l)}>
                          <Pencil size={13} strokeWidth={1.9} />
                          Editar
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
