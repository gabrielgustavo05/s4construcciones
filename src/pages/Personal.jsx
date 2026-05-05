import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { clp } from '../lib/helpers';
import Modal from '../components/Modal';

const EMPTY = {
  nombre: '',
  rut: '',
  cargo: 'Maestro',
  sueldo_base_mensual: ''
};

const CARGOS = ['Maestro', 'Jornal', 'Capataz', 'Supervisor', 'Eléctrico', 'Conductor', 'Operador', 'Administrativo', 'Otro'];

export default function Personal() {
  const { user } = useAuth();
  const [trabajadores, setTrabajadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filtroCargo, setFiltroCargo] = useState('');

  const fetchTrabajadores = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('trabajadores')
      .select('*')
      .order('nombre', { ascending: true });

    if (!error) {
      setTrabajadores(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTrabajadores(); }, [fetchTrabajadores]);

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      user_id: user.id,
      sueldo_base_mensual: Number(form.sueldo_base_mensual)
    };
    
    // Si tiene ID, es un update. Si no, es un insert.
    let error;
    if (form.id) {
      const { error: err } = await supabase.from('trabajadores').update(payload).eq('id', form.id);
      error = err;
    } else {
      const { error: err } = await supabase.from('trabajadores').insert([payload]);
      error = err;
    }

    if (!error) {
      setShowModal(false);
      setForm(EMPTY);
      fetchTrabajadores();
    } else {
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Seguro que quieres eliminar este trabajador? Todo su registro de asistencia en las obras se perderá.')) return;
    await supabase.from('trabajadores').delete().eq('id', id);
    fetchTrabajadores();
  };

  const filtrados = trabajadores.filter(t => !filtroCargo || t.cargo === filtroCargo);

  if (loading) return <div className="loading-center"><div className="spinner" />Cargando personal...</div>;

  return (
    <div>
      <div className="ph">
        <div>
          <h2>Personal y Trabajadores</h2>
          <p>Base de datos general de trabajadores de la empresa</p>
        </div>
        <button className="btn btn-a" onClick={() => { setForm(EMPTY); setShowModal(true); }}>+ Nuevo trabajador</button>
      </div>

      <div className="pb">
        <div className="fg2" style={{ marginBottom: 14 }}>
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '7px 12px', borderRadius: 'var(--r2)', fontSize: 11 }}
          >
            <option value="">Todos los cargos</option>
            {CARGOS.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>

        <div className="card" style={{ padding:0 }}>
          <div className="tw">
            <table>
              <thead>
                <tr>
                  <th>Nombre completo</th>
                  <th>RUT</th>
                  <th>Cargo</th>
                  <th>Sueldo Mensual Base</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ textAlign:'center', padding:24, color:'var(--text3)' }}>
                      No hay trabajadores registrados.
                    </td>
                  </tr>
                ) : filtrados.map(t => (
                  <tr key={t.id}>
                    <td><strong>{t.nombre}</strong></td>
                    <td className="ts">{t.rut || '-'}</td>
                    <td>{t.cargo}</td>
                    <td className="mono tg">{clp(t.sueldo_base_mensual)}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button className="btn btn-s btn-sm" onClick={() => { setForm(t); setShowModal(true); }}>✏️ Editar</button>
                        <button className="btn btn-d btn-sm" onClick={() => handleDelete(t.id)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showModal && (
        <Modal title={form.id ? "✏️ Editar Trabajador" : "👷 Nuevo Trabajador"} onClose={() => { setShowModal(false); setForm(EMPTY); }}>
          <form onSubmit={handleSave}>
            <div className="form-group">
              <label>NOMBRE COMPLETO *</label>
              <input required value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Juan Pérez" />
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>RUT</label>
                <input value={form.rut} onChange={e => setForm({...form, rut: e.target.value})} placeholder="12.345.678-9" />
              </div>
              <div className="form-group">
                <label>CARGO / ROL</label>
                <select value={form.cargo} onChange={e => setForm({...form, cargo: e.target.value})}>
                  {CARGOS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>SUELDO BASE MENSUAL ($) *</label>
              <input type="number" required value={form.sueldo_base_mensual} onChange={e => setForm({...form, sueldo_base_mensual: e.target.value})} placeholder="Ej: 850000" />
            </div>
            <p className="ts tx" style={{ marginTop: -10, marginBottom: 14 }}>
              Este valor se dividirá por 30 para calcular días trabajados, y se usará la base legal chilena para horas extras.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => { setShowModal(false); setForm(EMPTY); }}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar Trabajador</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
