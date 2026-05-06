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
export const calcPresupuesto = (items, ggPct = 15, utilPct = 10, totalEspejo = 0) => {
  const subtotalItems = items.reduce(
    (acc, i) => acc + parseNum(i.cantidad) * parseNum(i.precio_unitario), 0
  );
  const subtotal = subtotalItems + parseNum(totalEspejo);
  const gastosGenerales = subtotal * (ggPct / 100);
  const utilidad = subtotal * (utilPct / 100);
  const neto = subtotal + gastosGenerales + utilidad;
  const iva = neto * 0.19;
  const total = neto + iva;
  return { subtotal, subtotalItems, gastosGenerales, utilidad, neto, iva, total };
};

// Calcular total de compras
export const calcCompras = (compras) =>
  compras.reduce((acc, c) => acc + parseNum(c.cantidad) * parseNum(c.precio_unitario), 0);

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

// Parser de números Chileno (Punto = Miles, Coma = Decimal)
export const parseNum = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return v;
  
  // Limpiar: quitar $, espacios, %, y cualquier carácter no numérico excepto punto y coma
  let s = String(v).trim().replace(/[$\s%]/g, '');
  
  if (!s) return 0;

  // CASO CHILE: 1.234,56 o 1.234
  // Si hay coma, es el decimal. El punto es miles.
  if (s.includes(',')) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    // Si NO hay coma, pero hay punto(s), el punto es miles (ej: 1.000 -> 1000)
    // A menos que sea un formato puramente decimal tipo 1.5 (muy raro en CLP)
    // Pero en construcción, 1.000 siempre es mil.
    if (s.includes('.')) {
      // Si el punto está seguido por 3 dígitos al final, es casi seguro que es miles
      // O si hay más de un punto.
      const parts = s.split('.');
      if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
        s = s.replace(/\./g, '');
      }
    }
  }

  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
};

        // Encontrar fila de encabezados
        let headerRow = -1;
        let colMap = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };

        const keywords = {
          num:   ['n°', 'nro', 'item', 'ítem', 'cod', 'código', 'codigo', '#'],
          desc:  ['descripcion', 'descripción', 'nombre', 'partida', 'detalle', 'concepto', 'glosa'],
          unit:  ['unidad', 'und', 'um', 'unid', 'u.m'],
          qty:   ['cantidad', 'cant', 'qty', 'cantidad total'],
          // precio: primero buscar específico para evitar confundir con "precio total"
          price: ['precio', 'precio unit', 'p. unit', 'p.unit', 'p.u.', 'p. u.', 'pu', 'p/u', 'v.unit', 'valor unit', 'costo unit', 'precio unitario', 'valor unitario', 'costo unitario'],
          total: ['precio total', 'precio fin', 'precio final', 'importe', 'total', 'subtotal', 'monto total', 'monto'],
        };

        for (let r = 0; r < Math.min(20, raw.length); r++) {
          const row = raw[r].map((c) => String(c).toLowerCase().trim());
          let matches = 0;
          const tryMap = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };

          // Primero buscar coincidencias exactas, luego parciales
          for (const [key, kws] of Object.entries(keywords)) {
            for (let c = 0; c < row.length; c++) {
              const cell = row[c];
              // Coincidencia exacta primero
              if (kws.some((kw) => cell === kw)) {
                if (tryMap[key] === -1) { tryMap[key] = c; matches++; }
              }
            }
          }
          // Si no encontró exactas, buscar parciales
          for (const [key, kws] of Object.entries(keywords)) {
            if (tryMap[key] !== -1) continue;
            for (let c = 0; c < row.length; c++) {
              const cell = row[c];
              if (kws.some((kw) => cell.includes(kw))) {
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
          const desc   = colMap.desc  !== -1 ? String(row[colMap.desc]  || '').trim() : '';
          const qty    = colMap.qty   !== -1 ? parseNum(row[colMap.qty])   : 0;
          const price  = colMap.price !== -1 ? parseNum(row[colMap.price]) : 0;
          const codigo = colMap.num   !== -1 ? String(row[colMap.num]   || '').trim() : '';

          // Filtrar filas vacías o inválidas (si no tiene ni código ni montos, se ignora)
          if (!desc || desc.toLowerCase().includes('total')) continue;
          if (!qty && !price && !codigo) continue;

          items.push({
            codigo: codigo,
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

// Importador Excel para Personal
export const parsePersonalExcel = async (file) => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        let headerRow = -1;
        let colMap = { rut: -1, nombre: -1, cargo: -1, sueldo: -1 };

        const keywords = {
          rut: ['rut', 'r.u.t', 'id', 'documento', 'cedula', 'cédula'],
          nombre: ['nombre', 'trabajador', 'empleado', 'colaborador', 'apellidos'],
          cargo: ['cargo', 'puesto', 'rol', 'especialidad', 'funcion', 'función'],
          sueldo: ['sueldo', 'bruto', 'base', 'renta', 'salario', 'pago'],
        };

        for (let r = 0; r < Math.min(20, raw.length); r++) {
          const row = raw[r].map((c) => String(c).toLowerCase().trim());
          let matches = 0;
          const tryMap = { rut: -1, nombre: -1, cargo: -1, sueldo: -1 };

          for (const [key, kws] of Object.entries(keywords)) {
            for (let c = 0; c < row.length; c++) {
              if (kws.some((kw) => row[c].includes(kw))) {
                if (tryMap[key] === -1) { tryMap[key] = c; matches++; }
              }
            }
          }

          if (matches >= 2) {
            headerRow = r;
            colMap = tryMap;
            break;
          }
        }

        if (headerRow === -1) {
          colMap = { rut: 0, nombre: 1, sueldo: 2, cargo: 3 };
          headerRow = 0;
        }

        const items = [];
        for (let r = headerRow + 1; r < raw.length; r++) {
          const row = raw[r];
          const nombre = colMap.nombre !== -1 ? String(row[colMap.nombre] || '').trim() : '';
          const rut = colMap.rut !== -1 ? String(row[colMap.rut] || '').trim() : '';
          const sueldo = colMap.sueldo !== -1 ? parseFloat(row[colMap.sueldo]) : 0;
          const cargo = colMap.cargo !== -1 ? String(row[colMap.cargo] || '').trim() : '';

          if (!nombre && !rut) continue;

          items.push({
            rut: rut,
            nombre: nombre,
            cargo: cargo,
            sueldo_base_mensual: isNaN(sueldo) ? 0 : sueldo,
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

