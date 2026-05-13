import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { clp } from '../lib/helpers';
import { parseTsvData } from '../lib/contabilidad_paste';
import PageHeader from '../components/PageHeader';
import Badge from '../components/Badge';

export default function PegarContabilidad() {
  const [text, setText] = useState('');
  const [obras, setObras] = useState([]);
  const [aliases, setAliases] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [parsed, setParsed] = useState(null);
  const [asignaciones, setAsignaciones] = useState({});
  const [insertando, setInsertando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    const [{ data: oData }, { data: aData }] = await Promise.all([
      supabase.from('obras').select('id, nombre').neq('departamento', 'Eléctrico').order('nombre'),
      supabase.from('aliases_centros_costo').select('*, obra:obra_id(nombre)')
    ]);
    setObras(oData || []);
    setAliases(aData || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBase(); }, [fetchBase]);

  const procesarPegado = () => {
    if (!text.trim()) return;
    const aliasMap = {};
    aliases.forEach(a => { if (a.activo) aliasMap[a.centro_costo_contabilidad.toUpperCase()] = a.obra_id; });
    
    const res = parseTsvData(text, aliasMap);
    if (res.error) {
      alert(res.error);
      return;
    }

    const pending = {};
    res.ccUnicos.forEach(cc => {
      if (!aliasMap[cc.toUpperCase()]) pending[cc] = '';
    });
    setAsignaciones(pending);
    setParsed(res);
  };

  const guardarDatos = async () => {
    setInsertando(true);
    
    // Guardar nuevos aliases
    const nuevosAliases = Object.entries(asignaciones)
      .filter(([, obraId]) => obraId)
      .map(([cc, obraId]) => ({ centro_costo_contabilidad: cc.toUpperCase(), obra_id: obraId, activo: true }));
      
    if (nuevosAliases.length > 0) {
      await supabase.from('aliases_centros_costo').upsert(nuevosAliases, { onConflict: 'centro_costo_contabilidad' });
    }

    // Actualizar obra_id en movimientos según las nuevas asignaciones
    const mapFinal = { ...asignaciones };
    aliases.forEach(a => { if (a.activo) mapFinal[a.centro_costo_contabilidad.toUpperCase()] = a.obra_id; });

    const rows = parsed.movimientos.map(m => {
      const oid = mapFinal[m.centro_costo.toUpperCase()] || null;
      return { ...m, obra_id: oid };
    });

    // Inserción en batch
    let insertados = 0, duplicados = 0;
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { data, error } = await supabase.from('movimientos_contables').upsert(chunk, { onConflict: 'hash_unico', ignoreDuplicates: true }).select('id');
      if (error && error.code === '23505') duplicados += chunk.length;
      else if (!error) {
        insertados += data?.length || 0;
        duplicados += chunk.length - (data?.length || 0);
      }
    }

    setResultado({ insertados, duplicados });
    setInsertando(false);
    setText('');
    fetchBase();
  };

  if (loading) return <div className="loading-center"><div className="spinner" /></div>;

  return (
    <div>
      <PageHeader eyebrow="Finanzas" title="Pegar Datos de Contabilidad" subtitle="Copia desde Excel y pega aquí para cargar los movimientos" />

      <div className="pb">
        {!parsed && !resultado && (
          <div className="card">
            <p className="ts tx" style={{ marginBottom: 16 }}>Selecciona las filas en Excel (incluyendo los encabezados) presiona Ctrl+C, haz clic en esta caja y presiona Ctrl+V.</p>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Pega aquí los datos de Excel (Ctrl+V)..."
              style={{ width: '100%', height: 300, padding: 16, fontFamily: 'monospace', fontSize: 12, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r2)', whiteSpace: 'pre' }}
            />
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn btn-a" onClick={procesarPegado} disabled={!text.trim()}>Analizar datos pegados</button>
            </div>
          </div>
        )}

        {parsed && !resultado && (
          <div className="card">
            <div className="card-title">Resumen de Datos</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
              <div className="stat-card blue"><span className="stat-label">Movimientos detectados</span><span className="stat-value">{parsed.movimientos.length}</span></div>
              <div className="stat-card green"><span className="stat-label">C.C. detectados</span><span className="stat-value">{parsed.ccUnicos.length}</span></div>
            </div>

            {Object.keys(asignaciones).length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ marginBottom: 12 }}>Centros de Costo no reconocidos</h4>
                <div className="tw">
                  <table>
                    <thead><tr><th>Centro de Costo (C.C.)</th><th>Asignar a Obra</th></tr></thead>
                    <tbody>
                      {Object.keys(asignaciones).map(cc => (
                        <tr key={cc}>
                          <td style={{ fontWeight: 600 }}>{cc}</td>
                          <td>
                            <select value={asignaciones[cc]} onChange={e => setAsignaciones(prev => ({ ...prev, [cc]: e.target.value }))}>
                              <option value="">— Dejar pendiente —</option>
                              {obras.map(o => <option key={o.id} value={o.id}>{o.nombre}</option>)}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-s" onClick={() => setParsed(null)}>Cancelar</button>
              <button className="btn btn-a" onClick={guardarDatos} disabled={insertando}>
                {insertando ? 'Guardando...' : `Confirmar y Guardar (${parsed.movimientos.length} filas)`}
              </button>
            </div>
          </div>
        )}

        {resultado && (
          <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Importación completada</div>
            <p>Se insertaron <strong>{resultado.insertados}</strong> nuevos movimientos.</p>
            <p className="ts tx" style={{ marginBottom: 24 }}>Se omitieron {resultado.duplicados} filas que ya existían (mismo hash).</p>
            <button className="btn btn-a" onClick={() => { setParsed(null); setResultado(null); }}>Pegar más datos</button>
          </div>
        )}
      </div>
    </div>
  );
}
