// Formatear moneda chilena
export const clp = (n) =>
  new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(n || 0);

// Formatear fecha legible
export const fmtDate = (d) => {
  if (!d) return '-';
  return new Date(d + 'T00:00:00').toLocaleDateString('es-CL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
};

// Porcentaje seguro
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

// Fecha de hoy en formato YYYY-MM-DD
export const today = () => new Date().toISOString().split('T')[0];

// Calcular totales de presupuesto
export const calcPresupuesto = (items, ggPct = 15, utilPct = 10) => {
  const subtotal = items.reduce(
    (acc, i) => acc + Number(i.cantidad) * Number(i.precio_unitario), 0
  );
  const gastosGenerales = subtotal * (ggPct / 100);
  const utilidad = subtotal * (utilPct / 100);
  const neto = subtotal + gastosGenerales + utilidad;
  const iva = neto * 0.19;
  const total = neto + iva;
  return { subtotal, gastosGenerales, utilidad, neto, iva, total };
};

// Calcular total de compras
export const calcCompras = (compras) =>
  compras.reduce((acc, c) => acc + Number(c.cantidad) * Number(c.precio_unitario), 0);

// Calcular total de asistencia (Sueldos)
export const calcAsistencia = (asistencias) =>
  asistencias.reduce((acc, a) => acc + Number(a.total_pago), 0);

// Color semáforo según variación financiera
export const semaforoColor = (presupuesto, gasto) => {
  if (!presupuesto) return 'var(--text3)';
  const pct = (gasto / presupuesto) * 100;
  if (pct > 100) return 'var(--red)';
  if (pct > 85) return 'var(--orange)';
  return 'var(--green)';
};

// Clase de badge según estado
export const badgeClass = (estado) => {
  const map = {
    Activa: 'b-g', Activo: 'b-g', Completado: 'b-g', Aprobada: 'b-g',
    Aprobado: 'b-g', Pagado: 'b-g', Terminada: 'b-b', Finalizado: 'b-b',
    Pausada: 'b-y', Pausado: 'b-y', Pendiente: 'b-gray', 'En revisión': 'b-y',
    'En proceso': 'b-y', 'En curso': 'b-b', Emitido: 'b-t',
    Rechazada: 'b-r', Rechazado: 'b-r', Atrasado: 'b-r',
    Licitación: 'b-p', Planificación: 'b-p', 'En Progreso': 'b-b',
    Menor: 'b-g', Mayor: 'b-y', Crítica: 'b-r',
  };
  return map[estado] || 'b-gray';
};

// Importador Excel inteligente
export const parseExcel = async (file) => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        // Encontrar fila de encabezados
        let headerRow = -1;
        let colMap = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };

        const keywords = {
          num: ['n°', 'item', 'ítem', '#', 'número', 'numero', 'cod', 'código', 'nro'],
          desc: ['descripcion', 'descripción', 'nombre', 'partida', 'detalle', 'concepto'],
          unit: ['unidad', 'und', 'um', 'unid'],
          qty: ['cantidad', 'cant', 'qty', 'cantidad total'],
          price: ['precio', 'p.unit', 'p. unit', 'precio unitario', 'valor unit', 'valor', 'pu', 'p/u'],
          total: ['total', 'monto', 'importe', 'subtotal', 'precio total'],
        };

        for (let r = 0; r < Math.min(20, raw.length); r++) {
          const row = raw[r].map((c) => String(c).toLowerCase().trim());
          let matches = 0;
          const tryMap = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };

          for (const [key, kws] of Object.entries(keywords)) {
            for (let c = 0; c < row.length; c++) {
              if (kws.some((kw) => row[c].includes(kw))) {
                if (tryMap[key] === -1) { tryMap[key] = c; matches++; }
              }
            }
          }

          if (matches >= 3) {
            headerRow = r;
            colMap = tryMap;
            break;
          }
        }

        // Si no encontró encabezados, usar orden por defecto
        if (headerRow === -1) {
          colMap = { num: 0, desc: 1, unit: 2, qty: 3, price: 4, total: 5 };
          headerRow = 0;
        }

        const items = [];
        for (let r = headerRow + 1; r < raw.length; r++) {
          const row = raw[r];
          const desc = colMap.desc !== -1 ? String(row[colMap.desc] || '').trim() : '';
          const qty = colMap.qty !== -1 ? parseFloat(row[colMap.qty]) : 0;
          const price = colMap.price !== -1 ? parseFloat(row[colMap.price]) : 0;

          // Filtrar filas vacías o inválidas
          if (!desc || desc.toLowerCase().includes('total') || (!qty && !price)) continue;

          items.push({
            codigo: colMap.num !== -1 ? String(row[colMap.num] || '').trim() : '',
            descripcion: desc,
            unidad: colMap.unit !== -1 ? String(row[colMap.unit] || 'UN').trim() || 'UN' : 'UN',
            cantidad: isNaN(qty) ? 0 : qty,
            precio_unitario: isNaN(price) ? 0 : price,
          });
        }

        resolve(items);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
};
