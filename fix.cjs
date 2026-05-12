const fs = require('fs');
const path = 'src/pages/ObraDetail.jsx';
let content = fs.readFileSync(path, 'utf8');

const target = `  const addEstadoPago = async (e) => {
      presupuesto: prev.presupuesto.map(p => p.id === itemId ? { ...p, [field]: finalVal } : p)
    }));

    const { error } = await supabase.from('presupuesto_items').update({ [field]: finalVal }).eq('id', itemId);
    if (error) {
      alert('Error al guardar cambio: ' + error.message);
      fetchTab(1); // Rollback on error
    }
  };`;

const replacement = `  const addEstadoPago = async (e) => {
    e.preventDefault();
    if (!(newEstadoPago.descripcion || '').trim()) return alert('La descripcion del estado de pago es obligatoria.');
    if (parseNum(newEstadoPago.monto_bruto) <= 0) return alert('El monto bruto debe ser mayor a cero.');
    const { error } = await supabase.from('estados_pago').insert([{ ...newEstadoPago, obra_id: id, monto_bruto: parseNum(newEstadoPago.monto_bruto), retencion_pct: parseNum(newEstadoPago.retencion_pct) }]);
    if (error) return alert('Error al crear estado de pago: ' + error.message);
    setNewEstadoPago({ numero: '', descripcion: '', monto_bruto: '', retencion_pct: 5, fecha_emision: today(), estado: 'Emitido' });
    fetchTab(8);
  };

  const updateObraLocal = (field, value) => {
    setObra(prev => ({ ...prev, [field]: value }));
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
  };`;

const normalizedContent = content.replace(/\r\n/g, '\n');
if (normalizedContent.includes(target)) {
  fs.writeFileSync(path, normalizedContent.replace(target, replacement));
  console.log("Success");
} else {
  console.log("Target not found");
}
