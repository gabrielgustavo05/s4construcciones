import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { clp, fmtDate, today, calcPresupuesto, calcCompras, calcAsistencia, calcCostoReal, parseExcel, parseNum, cleanNum } from '../lib/helpers';
import { validateCompraForm } from '../lib/validators';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

const TABS = ['Resumen', 'Presupuesto', 'RRHH', 'Compras', 'Cotizaciones', 'Subcontratos', 'Hitos', 'Estados de Pago'];
const PRESUPUESTO_COLUMNS = [
  { key: 'n', label: 'N°', width: 52, minWidth: 42, align: 'center' },
  { key: 'codigo', label: 'Código', width: 90, minWidth: 70 },
  { key: 'descripcion', label: 'Descripción', width: 360, minWidth: 180 },
  { key: 'unidad', label: 'Und', width: 70, minWidth: 55 },
  { key: 'cantidad', label: 'Cant. Pres.', width: 110, minWidth: 85, align: 'right' },
  { key: 'comprado', label: 'Comprado', width: 110, minWidth: 85, align: 'right' },
  { key: 'precio_unitario', label: 'P. Unitario', width: 120, minWidth: 90, align: 'right' },
  { key: 'total', label: 'Total', width: 130, minWidth: 100, align: 'right' },
];

const getCodigoAbove = (rowIndex, rows) => {
  if (rows.length === 0) return '1';

  let candidate;
  if (rowIndex <= 0) {
    const current = (rows[0]?.codigo || '1').trim();
    const parts = current.split('.');
    const lastNumber = Number(parts[parts.length - 1]);
    if (Number.isFinite(lastNumber) && lastNumber > 0) {
      parts[parts.length - 1] = String(lastNumber - 1);
      candidate = parts.join('.');
    } else {
      candidate = '0';
    }
  } else {
    const prevCodigo = (rows[rowIndex - 1]?.codigo || String(rowIndex)).trim();
    candidate = `${prevCodigo}.0`;
  }

  const usedCodes = new Set(rows.map(row => (row.codigo || '').trim()));
  while (usedCodes.has(candidate)) {
    candidate = `${candidate}.0`;
  }

  return candidate;
};

const getDefaultPresupuestoColWidths = () =>
  Object.fromEntries(PRESUPUESTO_COLUMNS.map(col => [col.key, col.width]));

export default function ObraDetail() {
  const { id } = useParams(); const navigate = useNavigate();
  const [obra, setObra] = useState(null);
  const [tab, setTab] = useState(0);
  const [data, setData] = useState({ presupuesto: [], asistencia: [], compras: [], cotizaciones: [], subcontratos: [], hitos: [], estados_pago: [], compras_cotejo: [] });
  const [loading, setLoading] = useState(true);
  const [excelPreview, setExcelPreview] = useState(null);

  const [showEditObra, setShowEditObra] = useState(false);
  const [editForm, setEditForm] = useState({});

  const [trabajadores, setTrabajadores] = useState([]);
  const [newAsistencia, setNewAsistencia] = useState({ trabajador_id: '', fecha: today(), dias_trabajados: 1, horas_extra: 0, bono_trato: 0, descuentos: 0, sueldo_base_mensual: '' });

  const [materialesGlobales, setMaterialesGlobales] = useState([]);
  const [showResumenCompras, setShowResumenCompras] = useState(false);
  const [showSolicitudModal, setShowSolicitudModal] = useState(false);
  const [newSolicitud, setNewSolicitud] = useState({ titulo: '', urgencia: 'Normal' });
  const [uploading, setUploading] = useState(false);
  const [totalEspejo, setTotalEspejo] = useState(0);
  const [presupuestoItems, setPresupuestoItems] = useState([]);
  const [presupuestoColWidths, setPresupuestoColWidths] = useState(getDefaultPresupuestoColWidths);
  const [budgetContextMenu, setBudgetContextMenu] = useState(null);

  const [selectedPartida, setSelectedPartida] = useState(null);
  const [editPartidaForm, setEditPartidaForm] = useState(null);
  const [newMaterial, setNewMaterial] = useState({ descripcion: '', unidad: 'UN', cantidad: '' });

  const [newCotizacion, setNewCotizacion] = useState({ item: '', proveedor: '', monto: '', forma_pago: 'Contado', estado: 'Pendiente', notas: '' });
  const [newSubcontrato, setNewSubcontrato] = useState({ empresa: '', rut: '', especialidad: '', monto_contrato: '', retencion_pct: 5, avance: 0, estado: 'Activo' });
  const [newHito, setNewHito] = useState({ nombre: '', fecha_inicio_plan: today(), fecha_fin_plan: today(), estado: 'Pendiente', avance: 0 });
  const [newEstadoPago, setNewEstadoPago] = useState({ numero: '', descripcion: '', monto_bruto: '', retencion_pct: 5, fecha_emision: today(), estado: 'Emitido' });


  const fetchObra = useCallback(async () => {
    const { data: o } = await supabase.from('obras').select('*').eq('id', id).single();
    if (o) {
      setObra(o);
      setEditForm(o);

      // Obtener total del espejo para sumarlo al presupuesto total
      const { data: mirrors } = await supabase.from('obras').select('id').eq('obra_padre_id', id).eq('departamento', 'Eléctrico');

      if (mirrors && mirrors.length > 0) {
        const mirrorId = mirrors[0].id;
        const { data: mItems } = await supabase.from('presupuesto_items').select('cantidad, precio_unitario').eq('obra_id', mirrorId);
        const st = (mItems || []).reduce((acc, i) => acc + parseNum(i.cantidad) * parseNum(i.precio_unitario), 0);
        setTotalEspejo(st);
      } else {
        setTotalEspejo(0);
      }
    }
  }, [id]);

  const fetchTab = useCallback(async (tabIndex) => {
    setLoading(true);
    const tables = ['presupuesto_items', 'asistencia', 'compras', 'cotizaciones', 'subcontratos', 'hitos', 'estados_pago'];

    // Si es Resumen (Tab 0), traer gasto real del espejo eléctrico si existe
    if (tabIndex === 0) {
      const [{ data: presupuesto }, { data: asistencia }, { data: compras }, { data: subcontratos }] = await Promise.all([
        supabase.from('presupuesto_items').select('*, presupuesto_materiales(*)').eq('obra_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
        supabase.from('asistencia').select('*, trabajador:trabajador_id(*)').eq('obra_id', id).order('fecha', { ascending: false }),
        supabase.from('compras').select('*').eq('obra_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
        supabase.from('subcontratos').select('*').eq('obra_id', id).order('created_at', { ascending: true }).order('id', { ascending: true }),
      ]);

      setData(d => ({
        ...d,
        presupuesto: presupuesto || [],
        asistencia: asistencia || [],
        compras: compras || [],
        subcontratos: subcontratos || [],
        gasto_espejo: 0,
      }));
      if (obra?.departamento === 'Construcción') {
        const { data: espejo } = await supabase.from('obras').select('id').eq('obra_padre_id', id).eq('departamento', 'Eléctrico').single();
        if (espejo) {
          const [{ data: asisEsp }, { data: compEsp }, { data: subsEsp }] = await Promise.all([
            supabase.from('asistencia').select('total_pago').eq('obra_id', espejo.id),
            supabase.from('compras').select('cantidad, precio_unitario').eq('obra_id', espejo.id),
            supabase.from('subcontratos').select('monto_contrato').eq('obra_id', espejo.id)
          ]);
          const gastoEsp = calcCostoReal({ compras: compEsp || [], asistencia: asisEsp || [], subcontratos: subsEsp || [] }).total;
          setData(d => ({ ...d, gasto_espejo: gastoEsp }));
        }
      }
      setLoading(false);
      return;
    }

    const table = tables[tabIndex - 1];

    let query = supabase.from(table).select('*').eq('obra_id', id).order('created_at', { ascending: true }).order('id', { ascending: true });
    if (table === 'presupuesto_items') {
      query = supabase.from('presupuesto_items').select('*, presupuesto_materiales(*)').eq('obra_id', id).order('created_at', { ascending: true }).order('id', { ascending: true });
    }
    if (table === 'asistencia') {
      query = supabase.from('asistencia').select('*, trabajador:trabajador_id(*)').eq('obra_id', id).order('fecha', { ascending: false });
    }

    const { data: rows } = await query;
    let sortedRows = rows || [];

    // Si estamos cargando presupuesto de obra de construcción, sincronizar con detalle eléctrico
    if (table === 'presupuesto_items' && obra?.departamento === 'Construcción' && totalEspejo > 0) {
      // Buscar partida eléctrica específica (Código 4.1)
      const idxElec = sortedRows.findIndex(p => p.codigo === '4.1');
      if (idxElec !== -1 && sortedRows[idxElec].precio_unitario !== totalEspejo) {
        await supabase.from('presupuesto_items').update({ precio_unitario: totalEspejo }).eq('id', sortedRows[idxElec].id);
        sortedRows[idxElec].precio_unitario = totalEspejo;
      }
    }

    if (table === 'presupuesto_items') {
      sortedRows.sort((a, b) => (a.codigo || '').trim().localeCompare((b.codigo || '').trim(), undefined, { numeric: true, sensitivity: 'base' }));
    }
    setData(d => ({ ...d, [table === 'presupuesto_items' ? 'presupuesto' : table]: sortedRows }));

    if (table === 'asistencia') {
      const { data: tr } = await supabase.from('trabajadores').select('*').order('nombre');
      setTrabajadores(tr || []);
    }

    if (table === 'presupuesto_items') {
      const { data: cmp } = await supabase.from('compras').select('presupuesto_item_id, cantidad, descripcion').eq('obra_id', id);
      setData(d => ({ ...d, compras_cotejo: cmp || [] }));
    }

    if (table === 'compras') {
      const { data: items } = await supabase.from('presupuesto_items').select('id, codigo, descripcion, unidad, cantidad, precio_unitario').eq('obra_id', id).order('created_at', { ascending: true });
      setPresupuestoItems(items || []);
    }

    if (tabIndex === 4) {
      const { data: sol } = await supabase.from('solicitudes_material').select('*').eq('obra_id', id).order('created_at', { ascending: false });
      setData(d => ({ ...d, solicitudes: sol || [] }));
    }
    setLoading(false);
  }, [id, obra]);

  useEffect(() => { fetchObra(); }, [fetchObra]);
  useEffect(() => { fetchTab(tab); }, [tab, fetchTab]);

  useEffect(() => {
    const savedWidths = localStorage.getItem(`obra-${id}-presupuesto-col-widths`);
    if (!savedWidths) {
      setPresupuestoColWidths(getDefaultPresupuestoColWidths());
      return;
    }

    try {
      const parsedWidths = JSON.parse(savedWidths);
      setPresupuestoColWidths({
        ...getDefaultPresupuestoColWidths(),
        ...parsedWidths
      });
    } catch {
      setPresupuestoColWidths(getDefaultPresupuestoColWidths());
    }
  }, [id]);

  useEffect(() => {
    localStorage.setItem(`obra-${id}-presupuesto-col-widths`, JSON.stringify(presupuestoColWidths));
  }, [id, presupuestoColWidths]);

  useEffect(() => {
    const closeBudgetContextMenu = () => setBudgetContextMenu(null);
    const closeOnEscape = (e) => {
      if (e.key === 'Escape') setBudgetContextMenu(null);
    };

    document.addEventListener('click', closeBudgetContextMenu);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('click', closeBudgetContextMenu);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  useEffect(() => {
    if (tab === 1 || tab === 3) {
      const fetchMaterialesGlobales = async () => {
        const { data } = await supabase.from('compras').select('descripcion');
        if (data) {
          const unique = [...new Set(data.map(d => d.descripcion))].filter(Boolean).sort();
          setMaterialesGlobales(unique);
        }
      };
      fetchMaterialesGlobales();
    }
  }, [tab]);

  // ── Acciones genéricas ──
  const deleteRow = async (table, rowId, noConfirm = false) => {
    if (!noConfirm && !confirm('¿Eliminar?')) return;
    await supabase.from(table).delete().eq('id', rowId);
    fetchTab(tab);
  };

  const handleUpdateObra = async (e) => {
    e.preventDefault();
    // Limpiar el objeto de cualquier propiedad que no sea una columna real (evita error de Schema Cache)
    const { obra_padre, espejos, presupuesto_items, compras, asistencia, cotizaciones, subcontratos, hitos, estados_pago, ...payload } = editForm;
    const { error } = await supabase.from('obras').update(payload).eq('id', id);
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

  const detachMaterialsFromItems = async (itemIds) => {
    if (!itemIds.length) return true;

    await supabase
      .from('presupuesto_materiales')
      .update({ obra_id: id })
      .in('presupuesto_item_id', itemIds);

    const { error } = await supabase
      .from('presupuesto_materiales')
      .update({ presupuesto_item_id: null })
      .in('presupuesto_item_id', itemIds);

    if (error) {
      alert('No se pudo dejar los materiales sin asignar. Revisa que la migración de presupuesto_materiales esté aplicada antes de vaciar.');
      return false;
    }

    return true;
  };

  const deleteAllPresupuesto = async () => {
    if (!confirm('¿Estás SEGURO de vaciar TODO el presupuesto de esta obra? Las partidas se eliminarán, pero los materiales quedarán sin asignar.')) return;
    const itemIds = data.presupuesto.map(item => item.id).filter(Boolean);
    const materialsDetached = await detachMaterialsFromItems(itemIds);
    if (!materialsDetached) return;

    const { error } = await supabase.from('presupuesto_items').delete().eq('obra_id', id);
    if (error) return alert('Error al vaciar presupuesto: ' + error.message);
    fetchTab(1);
  };

  // ── Agregar ítem presupuesto ──
  const [newItem, setNewItem] = useState({ codigo: '', descripcion: '', unidad: 'UN', cantidad: '', precio_unitario: '' });
  const addItem = async (e) => {
    e.preventDefault();
    await supabase.from('presupuesto_items').insert([{ ...newItem, obra_id: id, cantidad: Number(newItem.cantidad), precio_unitario: Number(newItem.precio_unitario) }]);
    setNewItem({ codigo: '', descripcion: '', unidad: 'UN', cantidad: '', precio_unitario: '' });
    fetchTab(1);
  };

  const openBudgetContextMenu = (e, rowIndex = -1, row = null) => {
    e.preventDefault();
    setBudgetContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowIndex,
      row
    });
  };

  const addItemAbove = async (rowIndex = -1) => {
    setBudgetContextMenu(null);

    const codigo = getCodigoAbove(rowIndex, data.presupuesto);
    const payload = {
      obra_id: id,
      codigo,
      descripcion: 'Nueva partida',
      unidad: 'UN',
      cantidad: 1,
      precio_unitario: 0
    };

    const { data: inserted, error } = await supabase
      .from('presupuesto_items')
      .insert([payload])
      .select()
      .single();

    if (error) {
      alert('Error al crear fila: ' + error.message);
      return;
    }

    await fetchTab(1);
    setTimeout(() => {
      document.querySelector(`[data-id="${inserted.id}"][data-field="descripcion"]`)?.focus();
    }, 80);
  };

  const deleteBudgetRowFromMenu = async (row) => {
    setBudgetContextMenu(null);
    if (!row) return;
    if (!confirm('¿Eliminar fila? Los materiales asociados quedarán sin asignar.')) return;

    const materialsDetached = await detachMaterialsFromItems([row.id]);
    if (!materialsDetached) return;

    const { error } = await supabase.from('presupuesto_items').delete().eq('id', row.id);
    if (error) return alert('Error al eliminar fila: ' + error.message);
    fetchTab(1);
  };

  const handleUpdatePartida = async (e) => {
    e.preventDefault();
    const payload = {
      codigo: editPartidaForm.codigo,
      descripcion: editPartidaForm.descripcion,
      unidad: editPartidaForm.unidad,
      cantidad: Number(editPartidaForm.cantidad),
      precio_unitario: Number(editPartidaForm.precio_unitario)
    };
    const { error } = await supabase.from('presupuesto_items').update(payload).eq('id', editPartidaForm.id);
    if (!error) {
      setEditPartidaForm(null);
      fetchTab(1);
    } else alert(error.message);
  };

  // ── Agregar compra ──
  const [newCompra, setNewCompra] = useState({ descripcion: '', unidad: 'UN', cantidad: '', precio_unitario: '', proveedor: '', n_documento: '', fecha: today(), presupuesto_item_id: '' });
  const addCompra = async (e) => {
    e.preventDefault();
    const errors = validateCompraForm(newCompra);
    if (errors.length) {
      alert(errors.join('\n'));
      return;
    }

    const payload = { ...newCompra, obra_id: id, cantidad: parseNum(newCompra.cantidad), precio_unitario: parseNum(newCompra.precio_unitario) };
    if (!payload.presupuesto_item_id) delete payload.presupuesto_item_id;
    const { error } = await supabase.from('compras').insert([payload]);
    if (error) {
      alert('No se pudo agregar la compra: ' + error.message);
      return;
    }
    // Mantener Proveedor, N° Documento y Fecha para facilitar ingresos múltiples de una misma factura
    setNewCompra({
      ...newCompra,
      descripcion: '',
      cantidad: '',
      precio_unitario: '',
      presupuesto_item_id: ''
    });
    fetchTab(3);
  };

  const addMaterialRequerido = async (e) => {
    e.preventDefault();
    const payload = { ...newMaterial, presupuesto_item_id: selectedPartida.id, cantidad: Number(newMaterial.cantidad) };
    const { data: inserted, error } = await supabase.from('presupuesto_materiales').insert([payload]).select().single();
    if (!error) {
      setSelectedPartida(prev => ({ ...prev, presupuesto_materiales: [...(prev.presupuesto_materiales || []), inserted] }));
      setNewMaterial({ descripcion: '', unidad: 'UN', cantidad: '' });
    } else alert(error.message);
  };

  const deleteMaterialRequerido = async (matId) => {
    if (!confirm('¿Eliminar material requerido?')) return;
    const { error } = await supabase.from('presupuesto_materiales').delete().eq('id', matId);
    if (!error) {
      setSelectedPartida(prev => ({ ...prev, presupuesto_materiales: prev.presupuesto_materiales.filter(m => m.id !== matId) }));
    }
  };

  const addAsistencia = async (e) => {
    e.preventDefault();
    const tr = trabajadores.find(t => t.id === newAsistencia.trabajador_id);
    if (!tr) return alert('Seleccione un trabajador');

    const dias = Number(newAsistencia.dias_trabajados);
    const bono = Number(newAsistencia.bono_trato);
    const horas = Number(newAsistencia.horas_extra);
    const desc = Number(newAsistencia.descuentos);
    const sueldoMensual = Number(newAsistencia.sueldo_base_mensual);

    // Fórmula Legal Chilena (Mensual, 42 horas semanales)
    // 1. Valor por día trabajado (Mes comercial = 30 días)
    const valorDia = sueldoMensual / 30;

    // 2. Factor Hora Extra para 42 hrs = (1/30) * 7 / 42 * 1.5 = 0.0083333333333
    const factorHoraExtra = (1 / 30) * (7 / 42) * 1.5;
    const pagoHorasExtra = horas * (sueldoMensual * factorHoraExtra);

    const total_pago = (valorDia * dias) + bono + pagoHorasExtra - desc;

    const payload = {
      ...newAsistencia,
      obra_id: id,
      dias_trabajados: dias,
      bono_trato: bono,
      horas_extra: horas,
      descuentos: desc,
      total_pago: Math.round(total_pago)
    };

    await supabase.from('asistencia').insert([payload]);
    setNewAsistencia({ ...newAsistencia, trabajador_id: '', dias_trabajados: 1, horas_extra: 0, bono_trato: 0, descuentos: 0, sueldo_base_mensual: '' });
    fetchTab(2); // tab 2 es Asistencia
  };

  const handleUploadPedido = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${id}_${Date.now()}.${fileExt}`;
      const filePath = `pedidos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('logistica')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('logistica')
        .getPublicUrl(filePath);

      // Crear registro en la tabla
      const { error: dbError } = await supabase.from('solicitudes_material').insert([{
        obra_id: id,
        titulo: newSolicitud.titulo || 'Solicitud de Material',
        foto_pedido_url: publicUrl,
        urgencia: newSolicitud.urgencia,
        estado: 'Pendiente'
      }]);

      if (dbError) throw dbError;

      setNewSolicitud({ titulo: '', urgencia: 'Normal' });
      setShowSolicitudModal(false);
      fetchTab(4);
    } catch (err) {
      alert('Error al subir solicitud: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const getHorasTranscurridas = (dateStr) => {
    const start = new Date(dateStr);
    const now = new Date();
    const diffMs = now - start;
    const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
    return diffHrs;
  };

  const addCotizacion = async (e) => {
    e.preventDefault();
    await supabase.from('cotizaciones').insert([{ ...newCotizacion, obra_id: id, monto: Number(newCotizacion.monto) }]);
    setNewCotizacion({ item: '', proveedor: '', monto: '', forma_pago: 'Contado', estado: 'Pendiente', notas: '' });
    fetchTab(4);
  };

  const addSubcontrato = async (e) => {
    e.preventDefault();
    await supabase.from('subcontratos').insert([{ ...newSubcontrato, obra_id: id, monto_contrato: Number(newSubcontrato.monto_contrato) }]);
    setNewSubcontrato({ empresa: '', rut: '', especialidad: '', monto_contrato: '', retencion_pct: 5, avance: 0, estado: 'Activo' });
    fetchTab(5);
  };

  const addHito = async (e) => {
    e.preventDefault();
    await supabase.from('hitos').insert([{ ...newHito, obra_id: id, avance: Number(newHito.avance) }]);
    setNewHito({ nombre: '', fecha_inicio_plan: today(), fecha_fin_plan: today(), estado: 'Pendiente', avance: 0 });
    fetchTab(6);
  };

  const addEstadoPago = async (e) => {
    e.preventDefault();
    await supabase.from('estados_pago').insert([{ ...newEstadoPago, obra_id: id, monto_bruto: Number(newEstadoPago.monto_bruto) }]);
    setNewEstadoPago({ numero: '', descripcion: '', monto_bruto: '', retencion_pct: 5, fecha_emision: today(), estado: 'Emitido' });
    fetchTab(7);
  };


  const updatePct = async (field, value) => {
    const num = Number(value);
    if (isNaN(num)) return;
    await supabase.from('obras').update({ [field]: num }).eq('id', id);
    fetchObra();
  };

  const updateItemField = async (itemId, field, value) => {
    let finalVal = value;
    if (field === 'cantidad' || field === 'precio_unitario') {
      finalVal = parseNum(value);
    }

    // Update local state first for instant feedback
    setData(prev => ({
      ...prev,
      presupuesto: prev.presupuesto.map(p => p.id === itemId ? { ...p, [field]: finalVal } : p)
    }));

    const { error } = await supabase.from('presupuesto_items').update({ [field]: finalVal }).eq('id', itemId);
    if (error) {
      alert('Error al guardar cambio: ' + error.message);
      fetchTab(1); // Rollback on error
    }
  };

  const handlePaste = async (e) => {
    const text = e.clipboardData.getData('text');
    if (!text.includes('\t') && !text.includes('\n')) return;

    e.preventDefault();
    const rows = text.split('\n')
      .map(row => row.split('\t'))
      .filter(row => row.length >= 2 && row[1]?.trim());

    const newItems = rows.map(cols => ({
      obra_id: id,
      codigo: cols[0] || '',
      descripcion: cols[1] || '',
      unidad: cols[2] || 'UN',
      cantidad: parseNum(cols[3]),
      precio_unitario: parseNum(cols[4])
    }));

    if (newItems.length > 0) {
      const { error } = await supabase.from('presupuesto_items').insert(newItems);
      if (!error) fetchTab(1);
      else alert('Error al pegar: ' + error.message);
    }
  };

  const handleGridKey = (e, itemId, field, index) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextId = data.presupuesto[index + 1]?.id;
      if (nextId) document.querySelector(`[data-id="${nextId}"][data-field="${field}"]`)?.focus();
      else document.querySelector(`.new-row-input[data-field="${field}"]`)?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prevId = data.presupuesto[index - 1]?.id;
      if (prevId) document.querySelector(`[data-id="${prevId}"][data-field="${field}"]`)?.focus();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.target.blur();
      const nextId = data.presupuesto[index + 1]?.id;
      if (nextId) document.querySelector(`[data-id="${nextId}"][data-field="${field}"]`)?.focus();
      else document.querySelector(`.new-row-input[data-field="${field}"]`)?.focus();
    }
  };

  const startColumnResize = (e, column) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startWidth = presupuestoColWidths[column.key] || column.width;

    const onPointerMove = (moveEvent) => {
      const nextWidth = Math.max(column.minWidth, startWidth + moveEvent.clientX - startX);
      setPresupuestoColWidths(prev => ({ ...prev, [column.key]: nextWidth }));
    };

    const onPointerUp = () => {
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.body.classList.remove('is-resizing-column');
    };

    document.body.classList.add('is-resizing-column');
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
  };

  if (!obra) return <div className="loading-center"><div className="spinner" />Cargando...</div>;

  const { total: totalPres, subtotal, gastosGenerales, utilidad, neto, iva } = calcPresupuesto(data.presupuesto, obra.gastos_generales_pct, obra.utilidad_pct, totalEspejo);
  const totalComp = calcCostoReal({
    compras: data.compras,
    asistencia: data.asistencia,
    subcontratos: data.subcontratos,
    gastoEspejo: data.gasto_espejo || 0
  }).total;
  const presupuestoTableWidth = PRESUPUESTO_COLUMNS.reduce((sum, col) => sum + (presupuestoColWidths[col.key] || col.width), 0);

  return (
    <div className="detail-overlay">

      {/* Header */}
      <div className="detail-header">
        <Link to="/obras" className="btn btn-s btn-sm">← Volver</Link>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{obra.nombre}</div>
          <div className="ts tx">{obra.tipo} · {obra.n_contrato || 'Sin contrato'} · ITO: {obra.ito || '-'}</div>
        </div>
        <Badge estado={obra.estado} />
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map((t, i) => (
          <button key={i} className={`tab-btn ${tab === i ? 'active' : ''}`} onClick={() => setTab(i)}>{t}</button>
        ))}
        <button className={`tab-btn ${tab === 3 ? 'active' : ''}`} onClick={() => setTab(3)}>🛒 Compras</button>
        <button className={`tab-btn ${tab === 4 ? 'active' : ''}`} onClick={() => setTab(4)}>📋 Solicitudes</button>
        <button className={`tab-btn ${tab === 0 ? 'active' : ''}`} onClick={() => setTab(0)}>📊 Resumen</button>
      </div>

      {/* ── TAB 0: RESUMEN ── */}
      {tab === 0 && (
        <div className="tab-panel active">
          <div className="stats-grid">
            {[
              ['amber', 'Avance', `${obra.avance || 0}%`],
              ['blue', 'Presupuesto', clp(totalPres)],
              ['green', 'Gasto real', clp(totalComp)],
              [totalPres - totalComp >= 0 ? 'green' : 'red', 'Resultado', clp(totalPres - totalComp)],
              ['teal', 'Superficie', `${(obra.superficie || 0).toLocaleString('es-CL')} m²`],
            ].map(([c, l, v]) => (
              <div className={`stat-card ${c}`} key={l}>
                <span className="stat-label">{l}</span>
                <span className="stat-value" style={{ fontSize: 15 }}>{v}</span>
              </div>
            ))}
          </div>
          <div className="g2">
            <div className="card">
              <div className="fb">
                <div className="card-title" style={{ margin: 0 }}>📋 Datos</div>
                <button className="btn btn-s btn-sm" onClick={() => { setEditForm(obra); setShowEditObra(true); }}>✏️ Editar</button>
              </div>
              <div style={{ marginTop: 14 }}>
                {[['Cliente', obra.cliente], ['ITO', obra.ito], ['Responsable', obra.responsable], ['Inicio', obra.fecha_inicio], ['Término est.', obra.fecha_fin], ['N° OC - Contrato', obra.n_contrato]].map(([k, v]) => (
                  <div className="kv" key={k}><span className="k">{k}</span><span className="v">{v || '-'}</span></div>
                ))}
              </div>
            </div>
            <div className="card">
              <div className="card-title">📝 Descripción</div>
              <div className="nota-box">{obra.descripcion || 'Sin descripción.'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 1: PRESUPUESTO ── */}
      {tab === 1 && (
        <div className="tab-panel active">
          <div className="fb" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>Presupuesto Detallado</h3>
            <div style={{ display: 'flex', gap: 8 }}>
              <label className="btn btn-s btn-sm" style={{ cursor: 'pointer' }}>
                🤖 Importar Excel AI
                <input type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleExcelFile} />
              </label>
              <button className="btn btn-d btn-sm" onClick={deleteAllPresupuesto}>🗑 Vaciar Presupuesto</button>
            </div>
          </div>

          {/* Excel Preview */}
          {excelPreview && (
            <div className="card" style={{ border: '1px solid var(--accent)' }}>
              <div className="card-title">📊 Vista previa — {excelPreview.length} ítems detectados</div>
              <div className="excel-preview">
                <table>
                  <thead><tr><th>Código</th><th>Descripción</th><th>Und</th><th>Cantidad</th><th>P. Unitario</th><th>Total</th></tr></thead>
                  <tbody>
                    {excelPreview.slice(0, 20).map((i, idx) => {
                      const isTitle = (i.cantidad === 0 && i.precio_unitario === 0 && i.codigo);
                      if (isTitle) {
                        return (
                          <tr key={idx} style={{ background: 'var(--bg3)' }}>
                            <td className="ts" style={{ color: 'var(--accent)', fontWeight: 800 }}>{i.codigo}</td>
                            <td colSpan="5"><strong>{i.descripcion}</strong></td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={idx}>
                          <td className="ts tx">{i.codigo || '-'}</td>
                          <td>{i.descripcion}</td>
                          <td>{i.unidad}</td>
                          <td className="mono">{i.cantidad}</td>
                          <td className="mono">{clp(i.precio_unitario)}</td>
                          <td className="mono">{clp(i.cantidad * i.precio_unitario)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {excelPreview.length > 20 && <p className="ts tx" style={{ padding: '8px 12px' }}>...y {excelPreview.length - 20} ítems más</p>}
              <div style={{ display: 'flex', gap: 8, padding: '12px 0 0' }}>
                <button className="btn btn-a" onClick={confirmExcelImport}>✓ Importar {excelPreview.length} ítems</button>
                <button className="btn btn-s" onClick={() => setExcelPreview(null)}>Cancelar</button>
              </div>
            </div>
          )}

          <div className="fb" style={{ marginBottom: 14, background: 'var(--bg2)', padding: 12, borderRadius: 'var(--r2)', border: '1px solid var(--border)' }}>
            <p className="ts tx" style={{ margin: 0 }}>💡 Puedes navegar con las flechas (↑↓), pulsar Enter para bajar, <strong>pegar desde Excel (Ctrl+V)</strong> y abrir opciones con click derecho.</p>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="tw" onPaste={handlePaste}>
              <table className="excel-table resizable-table" style={{ width: presupuestoTableWidth, minWidth: presupuestoTableWidth }}>
                <colgroup>
                  {PRESUPUESTO_COLUMNS.map(col => (
                    <col key={col.key} style={{ width: presupuestoColWidths[col.key] || col.width }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {PRESUPUESTO_COLUMNS.map(col => (
                      <th key={col.key} style={{ textAlign: col.align || 'left' }}>
                        <span>{col.label}</span>
                        <span
                          className="col-resizer"
                          role="separator"
                          aria-orientation="vertical"
                          title="Arrastra para cambiar el ancho"
                          onPointerDown={(e) => startColumnResize(e, col)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.presupuesto.length === 0 ? (
                    <tr onContextMenu={(e) => openBudgetContextMenu(e)}><td colSpan="8" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Sin ítems. Click derecho para agregar una fila o importa desde Excel.</td></tr>
                  ) : data.presupuesto.map((p, i) => {
                    const isTitle = (Number(p.cantidad) === 0 && Number(p.precio_unitario) === 0 && p.codigo && !p.descripcion.toLowerCase().includes('instalación'));

                    let sobrecompra = false;
                    const comprasPartida = data.compras_cotejo.filter(c => c.presupuesto_item_id === p.id);
                    const cantComprada = comprasPartida.reduce((s, c) => s + (c.cantidad || 0), 0);

                    if (p.presupuesto_materiales && p.presupuesto_materiales.length > 0) {
                      p.presupuesto_materiales.forEach(mat => {
                        const compradoMat = comprasPartida.filter(c => (c.descripcion || '').toLowerCase() === (mat.descripcion || '').toLowerCase()).reduce((s, c) => s + (c.cantidad || 0), 0);
                        if (compradoMat > mat.cantidad) sobrecompra = true;
                      });
                    } else {
                      sobrecompra = !isTitle && p.cantidad > 0 && cantComprada > p.cantidad;
                    }

                    return (
                      <tr
                        key={p.id}
                        onClick={() => setSelectedPartida(p)}
                        onContextMenu={(e) => openBudgetContextMenu(e, i, p)}
                        style={{ background: isTitle ? 'var(--bg3)' : sobrecompra ? 'rgba(239,68,68,0.07)' : undefined, cursor: 'pointer' }}
                      >
                        <td className="ts tx" style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td className="ts">
                          <input
                            data-id={p.id}
                            data-field="codigo"
                            defaultValue={p.codigo}
                            onBlur={(e) => updateItemField(p.id, 'codigo', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleGridKey(e, p.id, 'codigo', i)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="0.0"
                            className="excel-input"
                            style={{ fontWeight: isTitle ? 800 : 400, color: isTitle ? 'var(--accent)' : 'inherit' }}
                          />
                        </td>
                        <td>
                          <input
                            data-id={p.id}
                            data-field="descripcion"
                            defaultValue={p.descripcion}
                            onBlur={(e) => updateItemField(p.id, 'descripcion', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleGridKey(e, p.id, 'descripcion', i)}
                            onClick={(e) => e.stopPropagation()}
                            onDoubleClick={(e) => { e.stopPropagation(); setEditPartidaForm(p); }}
                            placeholder="Descripción de la partida"
                            className="excel-input"
                            style={{ fontWeight: isTitle ? 800 : 500, width: '100%' }}
                          />
                        </td>
                        <td>
                          <input
                            data-id={p.id}
                            data-field="unidad"
                            defaultValue={p.unidad}
                            onBlur={(e) => updateItemField(p.id, 'unidad', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleGridKey(e, p.id, 'unidad', i)}
                            onClick={(e) => e.stopPropagation()}
                            className="excel-input center"
                            style={{ fontSize: 10 }}
                          />
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          <input
                            data-id={p.id}
                            data-field="cantidad"
                            type="text"
                            defaultValue={p.cantidad === 0 ? '' : p.cantidad}
                            onBlur={(e) => updateItemField(p.id, 'cantidad', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleGridKey(e, p.id, 'cantidad', i)}
                            onClick={(e) => e.stopPropagation()}
                            className="excel-input right"
                          />
                        </td>
                        <td className="mono" style={{ textAlign: 'right', color: sobrecompra ? 'var(--red)' : cantComprada > 0 ? 'var(--green)' : 'var(--text3)', fontWeight: cantComprada > 0 ? 700 : 400 }}>
                          {(p.presupuesto_materiales && p.presupuesto_materiales.length > 0) ? 'Sub-lista' : (cantComprada > 0 ? cantComprada : '-')}{sobrecompra && ` ⚠️`}
                        </td>
                        <td className="mono" style={{ textAlign: 'right' }}>
                          <input
                            data-id={p.id}
                            data-field="precio_unitario"
                            type="text"
                            defaultValue={p.precio_unitario === 0 ? '' : p.precio_unitario}
                            onBlur={(e) => updateItemField(p.id, 'precio_unitario', e.target.value)}
                            onFocus={(e) => e.target.select()}
                            onKeyDown={(e) => handleGridKey(e, p.id, 'precio_unitario', i)}
                            onClick={(e) => e.stopPropagation()}
                            className="excel-input right"
                          />
                        </td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>
                          {(() => {
                            const c = cleanNum(p.cantidad);
                            const u = cleanNum(p.precio_unitario);
                            const res = c * u;
                            if (res === 0 && (c > 0 || u > 0)) {
                              return <span style={{ color: 'var(--orange)', fontSize: 10 }}>Falta: C:{c} P:{u}</span>;
                            }
                            if (res === 0 && !isTitle) return clp(0);
                            return clp(res);
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {budgetContextMenu && (
            <div
              className="budget-context-menu"
              style={{ left: budgetContextMenu.x, top: budgetContextMenu.y }}
              onClick={(e) => e.stopPropagation()}
            >
              <button type="button" onClick={() => addItemAbove(budgetContextMenu.rowIndex)}>
                Agregar fila sobre
              </button>
              <button
                type="button"
                className="danger"
                disabled={!budgetContextMenu.row}
                onClick={() => deleteBudgetRowFromMenu(budgetContextMenu.row)}
              >
                Eliminar fila
              </button>
            </div>
          )}

          {/* Resumen financiero */}
          <div style={{ background: 'var(--bg3)', padding: '14px 18px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 60 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Costo directo</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  Gastos Generales
                  <input type="number" step="0.1" value={obra.gastos_generales_pct} onChange={e => updatePct('gastos_generales_pct', e.target.value)} style={{ width: 40, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '0 4px', borderRadius: 'var(--r2)', fontSize: 10, textAlign: 'center', height: 18 }} /> {'%'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                  Utilidades
                  <input type="number" step="0.1" value={obra.utilidad_pct} onChange={e => updatePct('utilidad_pct', e.target.value)} style={{ width: 40, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text)', padding: '0 4px', borderRadius: 'var(--r2)', fontSize: 10, textAlign: 'center', height: 18 }} /> {'%'}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>Subtotal Neto</div>
                <div style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>IVA (19 %)</div>
                <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800, marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>PRESUPUESTO TOTAL</div>
              </div>
              <div style={{ textAlign: 'right', fontFamily: 'Courier New' }}>
                {[subtotal, gastosGenerales, utilidad, neto, iva, totalPres].map((v, i) => (
                  <div key={i} style={{ fontSize: i === 5 ? 14 : 11, color: i === 5 ? 'var(--accent)' : 'var(--text)', fontWeight: i === 5 ? 800 : 600, marginBottom: 6, lineHeight: '1.6', height: 18, display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>{clp(v)}</div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: RRHH - ASISTENCIA ── */}
      {tab === 2 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">👷 Registrar Asistencia - Trato</div>
            <form onSubmit={addAsistencia} className="form-grid" style={{ alignItems: 'flex-end' }}>
              <div className="form-group">
                <label>Trabajador</label>
                <select required value={newAsistencia.trabajador_id} onChange={e => {
                  const tid = e.target.value;
                  const tr = trabajadores.find(t => t.id === tid);
                  setNewAsistencia({ ...newAsistencia, trabajador_id: tid, sueldo_base_mensual: tr ? tr.sueldo_base_mensual : '' });
                }}>
                  <option value="">Seleccione...</option>
                  {trabajadores.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.cargo})</option>)}
                </select>
              </div>
              <div className="form-group"><label>Sueldo Mensual ($)</label><input type="number" required value={newAsistencia.sueldo_base_mensual} onChange={e => setNewAsistencia({ ...newAsistencia, sueldo_base_mensual: e.target.value })} /></div>
              <div className="form-group"><label>Fecha</label><input type="date" required value={newAsistencia.fecha} onChange={e => setNewAsistencia({ ...newAsistencia, fecha: e.target.value })} /></div>
              <div className="form-group"><label>Días Trab.</label><input type="number" step="0.5" min="0" required value={newAsistencia.dias_trabajados} onChange={e => setNewAsistencia({ ...newAsistencia, dias_trabajados: e.target.value })} /></div>
              <div className="form-group"><label>Horas Extras</label><input type="number" step="0.5" min="0" required value={newAsistencia.horas_extra} onChange={e => setNewAsistencia({ ...newAsistencia, horas_extra: e.target.value })} /></div>
              <div className="form-group"><label>Bono - Trato ($)</label><input type="number" required value={newAsistencia.bono_trato} onChange={e => setNewAsistencia({ ...newAsistencia, bono_trato: e.target.value })} /></div>
              <div className="form-group"><label>Descuentos ($)</label><input type="number" required value={newAsistencia.descuentos} onChange={e => setNewAsistencia({ ...newAsistencia, descuentos: e.target.value })} /></div>
              <button className="btn btn-a">Guardar Planilla</button>
            </form>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>Fecha</th><th>Trabajador</th><th>Cargo</th><th>Días</th><th>H. Ext</th><th>Bonos</th><th>Dsctos</th><th>Total Pago</th><th></th></tr></thead>
                <tbody>
                  {data.asistencia.length === 0 ? (
                    <tr><td colSpan="9" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No hay registros de asistencia.</td></tr>
                  ) : data.asistencia.map(a => (
                    <tr key={a.id}>
                      <td className="ts">{a.fecha}</td>
                      <td><strong>{a.trabajador?.nombre || 'Desconocido'}</strong></td>
                      <td className="ts tx">{a.trabajador?.cargo}</td>
                      <td className="mono">{a.dias_trabajados}</td>
                      <td className="mono">{a.horas_extra}</td>
                      <td className="mono tg">{clp(a.bono_trato)}</td>
                      <td className="mono" style={{ color: 'var(--red)' }}>{a.descuentos > 0 ? clp(-a.descuentos) : 0}</td>
                      <td className="mono" style={{ fontWeight: 800, color: 'var(--accent)' }}>{clp(a.total_pago)}</td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('asistencia', a.id)}>✕</button></td>
                    </tr>
                  ))}
                  {data.asistencia.length > 0 && (
                    <tr style={{ background: 'var(--bg3)', fontWeight: 800 }}>
                      <td colSpan="7" style={{ textAlign: 'right' }}>Total Mano de Obra:</td>
                      <td className="mono" style={{ color: 'var(--accent)' }}>{clp(calcAsistencia(data.asistencia))}</td>
                      <td></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 3: COMPRAS ── */}
      {tab === 3 && (
        <div className="tab-panel active">
          <form onSubmit={addCompra} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14 }}>
            <div className="compra-form-grid">
              <div className="form-group compra-field-descripcion" style={{ margin: 0 }}>
                <label>Descripción *</label>
                <input required list="materiales-list" value={newCompra.descripcion} onChange={e => setNewCompra({ ...newCompra, descripcion: e.target.value })} />
                <datalist id="materiales-list">
                  {materialesGlobales.map((m, i) => <option key={i} value={m} />)}
                </datalist>
              </div>
              <div className="form-group" style={{ margin: 0 }}><label>Und</label><input value={newCompra.unidad} onChange={e => setNewCompra({ ...newCompra, unidad: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Cantidad</label><input type="number" step="0.01" required value={newCompra.cantidad} onChange={e => setNewCompra({ ...newCompra, cantidad: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>P. Unit</label><input type="number" step="0.01" required value={newCompra.precio_unitario} onChange={e => setNewCompra({ ...newCompra, precio_unitario: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Proveedor</label><input value={newCompra.proveedor} onChange={e => setNewCompra({ ...newCompra, proveedor: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>N° Doc</label><input value={newCompra.n_documento} onChange={e => setNewCompra({ ...newCompra, n_documento: e.target.value })} /></div>
              <div className="form-group compra-field-partida" style={{ margin: 0 }}>
                <label>Partida Asignada</label>
                <select value={newCompra.presupuesto_item_id} onChange={e => setNewCompra({ ...newCompra, presupuesto_item_id: e.target.value })}>
                  <option value="">Sin partida</option>
                  {presupuestoItems.filter(p => p.cantidad > 0 || p.precio_unitario > 0).map(p => (
                    <option key={p.id} value={p.id}>{p.codigo ? `${p.codigo} — ` : ''}{p.descripcion} ({p.unidad})</option>
                  ))}
                </select>
              </div>
              <div className="form-group compra-field-fecha" style={{ margin: 0 }}><label>Fecha</label><input type="date" max={today()} value={newCompra.fecha} onChange={e => setNewCompra({ ...newCompra, fecha: e.target.value })} /></div>
              <button type="submit" className="btn btn-a compra-submit" aria-label="Agregar compra">+</button>
            </div>
          </form>

          <div className="fb" style={{ marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800 }}>Historial de Compras</h3>
            <button className="btn btn-s btn-sm" onClick={() => setShowResumenCompras(true)}>📊 Ver Resumen por Material</button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>N°</th><th>Descripción</th><th>Und</th><th style={{ textAlign: 'right' }}>Cantidad</th><th style={{ textAlign: 'right' }}>P. Unitario</th><th style={{ textAlign: 'right' }}>Total</th><th>Proveedor</th><th>N° Doc</th><th>Fecha</th><th></th></tr></thead>
                <tbody>
                  {data.compras.length === 0 ? (
                    <tr><td colSpan="10" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Sin compras registradas.</td></tr>
                  ) : data.compras.map((c, i) => {
                    const tot = c.cantidad * c.precio_unitario;
                    return (
                      <tr key={c.id}>
                        <td className="ts tx">{i + 1}</td>
                        <td><strong>{c.descripcion}</strong></td>
                        <td className="ts tx">{c.unidad}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{c.cantidad}</td>
                        <td className="mono" style={{ textAlign: 'right' }}>{clp(c.precio_unitario)}</td>
                        <td className="mono" style={{ textAlign: 'right', fontWeight: 700 }}>{clp(tot)}</td>
                        <td className="ts tx">{c.proveedor || '-'}</td>
                        <td className="ts tx">{c.n_documento || '-'}</td>
                        <td className="ts">{c.fecha || '-'}</td>
                        <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('compras', c.id)}>✕</button></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
              <span className="ts tx">Total compras: </span>
              <span style={{ fontFamily: 'Courier New', fontWeight: 800, fontSize: 16, color: 'var(--accent)', marginLeft: 8 }}>{clp(totalComp)}</span>
            </div>
          </div>
          {totalPres > 0 && (
            <div className="card" style={{ border: `1px solid ${totalComp > totalPres ? 'var(--red)' : 'var(--green)'}` }}>
              <div className="fb">
                <span className="ts">Resultado presupuestario</span>
                <span style={{ fontFamily: 'Courier New', fontWeight: 800, fontSize: 16, color: totalPres - totalComp >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totalPres - totalComp >= 0 ? '✅' : '⚠️'} {clp(totalPres - totalComp)}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 4: COTIZACIONES ── */}
      {tab === 4 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📝 Agregar Cotización</div>
            <form onSubmit={addCotizacion} className="form-grid" style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>Ítem - Descripción</label><input required value={newCotizacion.item} onChange={e => setNewCotizacion({ ...newCotizacion, item: e.target.value })} /></div>
              <div className="form-group"><label>Proveedor</label><input required value={newCotizacion.proveedor} onChange={e => setNewCotizacion({ ...newCotizacion, proveedor: e.target.value })} /></div>
              <div className="form-group"><label>Monto ($)</label><input type="number" required value={newCotizacion.monto} onChange={e => setNewCotizacion({ ...newCotizacion, monto: e.target.value })} /></div>
              <div className="form-group">
                <label>Estado</label>
                <select value={newCotizacion.estado} onChange={e => setNewCotizacion({ ...newCotizacion, estado: e.target.value })}>
                  <option>Pendiente</option>
                  <option>Aprobado</option>
                  <option>Rechazado</option>
                </select>
              </div>
              <button className="btn btn-a">+</button>
            </form>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>Ítem</th><th>Proveedor</th><th>Monto</th><th>F. Pago</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
                <tbody>
                  {data.cotizaciones.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Sin cotizaciones. Agrégalas desde el módulo de Cotizaciones.</td></tr>
                  ) : data.cotizaciones.map(c => (
                    <tr key={c.id}>
                      <td><strong>{c.item}</strong></td>
                      <td>{c.proveedor}</td>
                      <td className="mono">{clp(c.monto)}</td>
                      <td className="ts tx">{c.forma_pago}</td>
                      <td><Badge estado={c.estado} /></td>
                      <td className="ts tx">{c.notas || '-'}</td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('cotizaciones', c.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 5: SUBCONTRATOS ── */}
      {tab === 5 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">🤝 Registrar Subcontrato</div>
            <form onSubmit={addSubcontrato} className="form-grid" style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>Empresa</label><input required value={newSubcontrato.empresa} onChange={e => setNewSubcontrato({ ...newSubcontrato, empresa: e.target.value })} /></div>
              <div className="form-group"><label>Especialidad</label><input required value={newSubcontrato.especialidad} onChange={e => setNewSubcontrato({ ...newSubcontrato, especialidad: e.target.value })} /></div>
              <div className="form-group"><label>Monto Contrato ($)</label><input type="number" required value={newSubcontrato.monto_contrato} onChange={e => setNewSubcontrato({ ...newSubcontrato, monto_contrato: e.target.value })} /></div>
              <div className="form-group"><label>Retención (%)</label><input type="number" value={newSubcontrato.retencion_pct} onChange={e => setNewSubcontrato({ ...newSubcontrato, retencion_pct: e.target.value })} /></div>
              <button className="btn btn-a">+</button>
            </form>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>Empresa</th><th>Especialidad</th><th>Monto</th><th>Avance</th><th>Pagado</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {data.subcontratos.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Sin subcontratos para esta obra.</td></tr>
                  ) : data.subcontratos.map(s => (
                    <tr key={s.id}>
                      <td><strong>{s.empresa}</strong><div className="ts tx">{s.rut || ''}</div></td>
                      <td><span style={{ background: 'var(--bg4)', padding: '2px 7px', borderRadius: 4, fontSize: 10, color: 'var(--text2)' }}>{s.especialidad}</span></td>
                      <td className="mono">{clp(s.monto_contrato)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div className="pb2" style={{ width: 50 }}><div className="pf" style={{ width: `${s.avance}%`, background: 'var(--green)' }} /></div>
                          {s.avance}%
                        </div>
                      </td>
                      <td className="mono tg">{clp(s.monto_pagado)}</td>
                      <td><Badge estado={s.estado} /></td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteRow('subcontratos', s.id)}>✕</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 6: HITOS ── */}
      {tab === 6 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">📅 Agregar Hito - Tarea</div>
            <form onSubmit={addHito} className="form-grid" style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>Nombre del Hito</label><input required value={newHito.nombre} onChange={e => setNewHito({ ...newHito, nombre: e.target.value })} /></div>
              <div className="form-group"><label>Inicio</label><input type="date" value={newHito.fecha_inicio_plan} onChange={e => setNewHito({ ...newHito, fecha_inicio_plan: e.target.value })} /></div>
              <div className="form-group"><label>Fin Plan</label><input type="date" value={newHito.fecha_fin_plan} onChange={e => setNewHito({ ...newHito, fecha_fin_plan: e.target.value })} /></div>
              <div className="form-group">
                <label>Estado</label>
                <select value={newHito.estado} onChange={e => setNewHito({ ...newHito, estado: e.target.value })}>
                  <option>Pendiente</option>
                  <option>En curso</option>
                  <option>Completado</option>
                  <option>Atrasado</option>
                </select>
              </div>
              <button className="btn btn-a">+</button>
            </form>
          </div>
          {data.hitos.map(h => {
            const col = h.estado === 'Completado' ? 'var(--green)' : h.estado === 'En curso' ? 'var(--blue)' : h.estado === 'Atrasado' ? 'var(--red)' : 'var(--bg5)';
            return (
              <div className="gantt-row" key={h.id}>
                <div className="gantt-label" title={h.nombre}>{h.nombre}</div>
                <div className="gantt-bar-wrap">
                  <div className="gantt-bar" style={{ width: `${h.avance || 0}%`, background: col }}>{(h.avance || 0) >= 20 ? `${h.avance}%` : ''}</div>
                  {(h.avance || 0) < 20 && <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: 10, color: 'var(--text2)' }}>{h.avance || 0}%</span>}
                </div>
                <Badge estado={h.estado} />
                <button className="btn btn-d btn-sm" onClick={() => deleteRow('hitos', h.id)}>✕</button>
              </div>
            );
          })}
          {data.hitos.length === 0 && <div className="empty-state"><div className="empty-icon">📅</div><h3>Sin hitos</h3><p>Agrega hitos desde el módulo de Cronograma</p></div>}
        </div>
      )}

      {/* ── TAB 7: ESTADOS DE PAGO ── */}
      {tab === 7 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">💰 Emitir Estado de Pago</div>
            <form onSubmit={addEstadoPago} className="form-grid" style={{ alignItems: 'flex-end' }}>
              <div className="form-group"><label>EPO N°</label><input required value={newEstadoPago.numero} onChange={e => setNewEstadoPago({ ...newEstadoPago, numero: e.target.value })} /></div>
              <div className="form-group"><label>Descripción</label><input required value={newEstadoPago.descripcion} onChange={e => setNewEstadoPago({ ...newEstadoPago, descripcion: e.target.value })} /></div>
              <div className="form-group"><label>Monto Bruto ($)</label><input type="number" required value={newEstadoPago.monto_bruto} onChange={e => setNewEstadoPago({ ...newEstadoPago, monto_bruto: e.target.value })} /></div>
              <div className="form-group"><label>Retención (%)</label><input type="number" value={newEstadoPago.retencion_pct} onChange={e => setNewEstadoPago({ ...newEstadoPago, retencion_pct: e.target.value })} /></div>
              <button className="btn btn-a">+</button>
            </form>
          </div>
          <div className="card" style={{ padding: 0 }}>
            <div className="tw">
              <table>
                <thead><tr><th>EPO N°</th><th>Descripción</th><th>Monto bruto</th><th>Neto</th><th>F. Emisión</th><th>Estado</th><th></th></tr></thead>
                <tbody>
                  {data.estados_pago.length === 0 ? (
                    <tr><td colSpan="7" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>Sin estados de pago para esta obra.</td></tr>
                  ) : data.estados_pago.map(ep => {
                    const neto = ep.monto_bruto - Math.round((ep.monto_bruto * ep.retencion_pct) / 100);
                    return (
                      <tr key={ep.id}>
                        <td><strong>{ep.numero}</strong></td>
                        <td>{ep.descripcion}</td>
                        <td className="mono">{clp(ep.monto_bruto)}</td>
                        <td className="mono tg">{clp(neto)}</td>
                        <td className="ts">{ep.fecha_emision}</td>
                        <td><Badge estado={ep.estado} /></td>
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
                <label>N° OC - CONTRATO</label>
                <input value={editForm.n_contrato || ''} onChange={(e) => setEditForm({ ...editForm, n_contrato: e.target.value })} />
              </div>
              <div className="form-group">
                <label>CLIENTE</label>
                <input value={editForm.cliente || ''} onChange={(e) => setEditForm({ ...editForm, cliente: e.target.value })} />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>ITO - INSPECTOR</label>
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

      {showResumenCompras && (
        <Modal title="📊 Resumen de Compras por Material" onClose={() => setShowResumenCompras(false)}>
          <div className="tw">
            <table>
              <thead>
                <tr><th>Material - Descripción</th><th>Und</th><th style={{ textAlign: 'right' }}>Cant. Total</th><th style={{ textAlign: 'right' }}>P. Unit. Promedio</th><th style={{ textAlign: 'right' }}>Total Gastado</th></tr>
              </thead>
              <tbody>
                {Object.values(
                  data.compras.reduce((acc, c) => {
                    if (!acc[c.descripcion]) acc[c.descripcion] = { desc: c.descripcion, und: c.unidad, cant: 0, total: 0 };
                    acc[c.descripcion].cant += c.cantidad;
                    acc[c.descripcion].total += c.cantidad * c.precio_unitario;
                    return acc;
                  }, {})
                )
                  .sort((a, b) => b.total - a.total)
                  .map((m, i) => (
                    <tr key={i}>
                      <td><strong>{m.desc}</strong></td>
                      <td className="ts tx">{m.und}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{m.cant}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{clp(m.total / (m.cant || 1))}</td>
                      <td className="mono" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{clp(m.total)}</td>
                    </tr>
                  ))}
                {data.compras.length > 0 && (
                  <tr style={{ background: 'var(--bg3)' }}>
                    <td colSpan="4" style={{ textAlign: 'right', fontWeight: 800 }}>TOTAL COMPRAS:</td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 800, color: 'var(--accent)' }}>{clp(calcCompras(data.compras))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="modal-actions">
            <button className="btn btn-s" onClick={() => setShowResumenCompras(false)}>Cerrar</button>
          </div>
        </Modal>
      )}

      {/* Modal Sub-Lista de Materiales Requeridos */}
      {selectedPartida && (
        <Modal title={`📦 Materiales Requeridos — ${selectedPartida.descripcion}`} onClose={() => { setSelectedPartida(null); fetchTab(1); }}>
          <form onSubmit={addMaterialRequerido} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--r)', padding: 14, marginBottom: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 70px 100px 44px', gap: 8, alignItems: 'end' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label>Descripción *</label>
                <input required list="materiales-list" value={newMaterial.descripcion} onChange={e => setNewMaterial({ ...newMaterial, descripcion: e.target.value })} />
              </div>
              <div className="form-group" style={{ margin: 0 }}><label>Und</label><input value={newMaterial.unidad} onChange={e => setNewMaterial({ ...newMaterial, unidad: e.target.value })} /></div>
              <div className="form-group" style={{ margin: 0 }}><label>Cant.</label><input type="number" step="0.01" required value={newMaterial.cantidad} onChange={e => setNewMaterial({ ...newMaterial, cantidad: e.target.value })} /></div>
              <button type="submit" className="btn btn-a" style={{ alignSelf: 'flex-end' }}>+</button>
            </div>
          </form>
          <div className="tw" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <table>
              <thead><tr><th>Descripción</th><th>Und</th><th style={{ textAlign: 'right' }}>Cant. Requerida</th><th style={{ textAlign: 'right' }}>Comprado</th><th></th></tr></thead>
              <tbody>
                {(!selectedPartida.presupuesto_materiales || selectedPartida.presupuesto_materiales.length === 0) ? (
                  <tr><td colSpan="5" style={{ textAlign: 'center', padding: 24, color: 'var(--text3)' }}>No hay materiales específicos en esta partida.</td></tr>
                ) : selectedPartida.presupuesto_materiales.map(m => {
                  const compradoMat = data.compras_cotejo.filter(c => c.presupuesto_item_id === selectedPartida.id && (c.descripcion || '').toLowerCase() === (m.descripcion || '').toLowerCase()).reduce((s, c) => s + (c.cantidad || 0), 0);
                  const exc = compradoMat > m.cantidad;
                  return (
                    <tr key={m.id} style={{ background: exc ? 'rgba(239,68,68,0.07)' : undefined }}>
                      <td><strong>{m.descripcion}</strong></td>
                      <td className="ts tx">{m.unidad}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{m.cantidad}</td>
                      <td className="mono" style={{ textAlign: 'right', color: exc ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{compradoMat} {exc && '⚠️'}</td>
                      <td><button className="btn btn-d btn-sm" onClick={() => deleteMaterialRequerido(m.id)}>✕</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {/* Modal Editar Partida */}
      {editPartidaForm && (
        <Modal title="✏️ Editar Partida" onClose={() => setEditPartidaForm(null)}>
          <form onSubmit={handleUpdatePartida}>
            <div className="form-group">
              <label>Código</label>
              <input value={editPartidaForm.codigo} onChange={e => setEditPartidaForm({ ...editPartidaForm, codigo: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Descripción *</label>
              <input required value={editPartidaForm.descripcion} onChange={e => setEditPartidaForm({ ...editPartidaForm, descripcion: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Unidad</label>
              <input value={editPartidaForm.unidad} onChange={e => setEditPartidaForm({ ...editPartidaForm, unidad: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Cantidad</label>
              <input type="number" step="0.01" required value={editPartidaForm.cantidad === 0 ? '' : editPartidaForm.cantidad} onChange={e => setEditPartidaForm({ ...editPartidaForm, cantidad: e.target.value })} />
            </div>
            <div className="form-group">
              <label>P. Unitario</label>
              <input type="number" step="0.01" required value={editPartidaForm.precio_unitario === 0 ? '' : editPartidaForm.precio_unitario} onChange={e => setEditPartidaForm({ ...editPartidaForm, precio_unitario: e.target.value })} />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-s" onClick={() => setEditPartidaForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-a">Guardar cambios</button>
            </div>
          </form>
        </Modal>
      )}
      {/* ── TAB 4: SOLICITUDES DE MATERIAL ── */}
      {tab === 4 && (
        <div className="tab-panel active">
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div className="card-title">📝 Solicitudes de Terreno</div>
                <p className="ts tx">Jefe de Obra carga foto de lista manual para gestión</p>
              </div>
              <button className="btn btn-a" onClick={() => setShowSolicitudModal(true)}>+ Nueva Solicitud (Foto)</button>
            </div>
          </div>

          <div className="sol-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {(!data.solicitudes || data.solicitudes.length === 0) ? (
              <div className="card" style={{ gridColumn: '1/-1', textAlign: 'center', padding: 40, color: 'var(--text3)' }}>No hay solicitudes pendientes.</div>
            ) : data.solicitudes.map(s => {
              const hrs = getHorasTranscurridas(s.created_at);
              const colorReloj = hrs >= 4 ? 'var(--red)' : hrs >= 2 ? 'var(--orange)' : 'var(--green)';

              return (
                <div className="card" key={s.id} style={{ padding: 0, overflow: 'hidden', border: hrs >= 4 ? '2px solid var(--red)' : '1px solid var(--border)' }}>
                  <div style={{ position: 'relative', height: 180, background: 'var(--bg3)' }}>
                    <img src={s.foto_pedido_url} alt="Pedido" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', top: 8, right: 8 }}>
                      <Badge estado={s.estado} />
                    </div>
                    {s.urgencia === 'Urgente' && (
                      <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--red)', color: 'white', fontSize: 10, padding: '2px 6px', borderRadius: 4, fontWeight: 800 }}>URGENTE</div>
                    )}
                  </div>
                  <div style={{ padding: 14 }}>
                    <div style={{ fontWeight: 700, marginBottom: 4 }}>{s.titulo}</div>
                    <div className="ts tx" style={{ marginBottom: 10 }}>Pedido por: Jefe de Obra · {fmtDate(s.created_at.split('T')[0])}</div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg2)', padding: '8px 12px', borderRadius: 8 }}>
                      <div style={{ fontSize: 11, color: 'var(--text2)' }}>Tiempo transcurrido:</div>
                      <div style={{ fontWeight: 800, color: colorReloj, display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontSize: 16 }}>⏱️</span> {hrs}h {hrs >= 4 && '(FUERA DE PLAZO)'}
                      </div>
                    </div>

                    <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
                      <button className="btn btn-s btn-sm" style={{ flex: 1 }} onClick={() => window.open(s.foto_pedido_url, '_blank')}>Ver Foto</button>
                      <button className="btn btn-a btn-sm" style={{ flex: 1 }} onClick={() => navigate('/logistica')}>Gestionar</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal Nueva Solicitud */}
      {showSolicitudModal && (
        <Modal title="📷 Nueva Solicitud de Material" onClose={() => setShowSolicitudModal(false)}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <p>Saca una foto a la lista de materiales escrita a mano para enviarla a gestión.</p>

            <div className="form-group" style={{ marginTop: 20 }}>
              <label>Título - Glosa Corta</label>
              <input
                type="text"
                placeholder="Ej: Materiales para fundaciones"
                value={newSolicitud.titulo}
                onChange={e => setNewSolicitud({ ...newSolicitud, titulo: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Urgencia</label>
              <select value={newSolicitud.urgencia} onChange={e => setNewSolicitud({ ...newSolicitud, urgencia: e.target.value })}>
                <option value="Normal">Normal (48 horas)</option>
                <option value="Urgente">Urgente (24 horas)</option>
              </select>
            </div>

            <div style={{ marginTop: 20 }}>
              <label className="btn btn-a" style={{ display: 'inline-block', cursor: 'pointer', padding: '14px 24px' }}>
                {uploading ? 'Subiendo...' : '📷 SACAR FOTO - SUBIR ARCHIVO'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  hidden
                  onChange={handleUploadPedido}
                  disabled={uploading}
                />
              </label>
            </div>
          </div>
        </Modal>
      )}


    </div>
  );
}
