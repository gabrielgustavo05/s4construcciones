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
  asistencias.reduce((acc, a) => acc + parseNum(a.total_pago), 0);

export const calcCostoReal = ({ compras = [], cuentas_obra = [], asistencia = [], subcontratos = [], gastoEspejo = 0 } = {}) => {
  const comprasManualesNeto = calcCompras(compras);
  const totalComprasManuales = Math.abs(comprasManualesNeto);
  
  const sumaSaldos = cuentas_obra.reduce((acc, cta) => acc + (cta.movimientos_contables || []).reduce((sum, m) => sum + parseNum(m.saldo), 0), 0);
  const totalCuentasObra = Math.abs(sumaSaldos);
  
  // Sumar ambos: compras manuales y saldos contables (si el usuario usa ambos o migra)
  const totalCompras = totalCuentasObra + totalComprasManuales;
  
  const totalManoObra = calcAsistencia(asistencia);
  const totalSubcontratos = subcontratos.reduce((acc, s) => acc + parseNum(s.monto_contrato), 0);
  const total = totalCompras + totalManoObra + totalSubcontratos + parseNum(gastoEspejo);
  return { totalCompras, totalManoObra, totalSubcontratos, gastoEspejo: parseNum(gastoEspejo), total };
};

export const calcDesviacion = (presupuesto, costoReal) => {
  const pres = parseNum(presupuesto);
  const costo = parseNum(costoReal);
  const diferencia = pres - costo;
  const porcentaje = pres ? Math.round((costo / pres) * 100) : 0;
  const sobrecostoPct = pres && costo > pres ? Math.round(((costo - pres) / pres) * 100) : 0;
  return { diferencia, porcentaje, sobrecostoPct, enRiesgo: porcentaje >= 85, sobreCosto: costo > pres };
};

// Color semáforo según variación financiera
export const semaforoColor = (presupuesto, gasto) => {
  if (!presupuesto) return 'var(--text3)';
  const p = (gasto / presupuesto) * 100;
  if (p > 100) return 'var(--red)';
  if (p > 85) return 'var(--orange)';
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
    'En estudio': 'b-p', 'En cotizacion': 'b-y', 'Lista para enviar': 'b-g',
    Enviada: 'b-b', Adjudicada: 'b-g', Perdida: 'b-r', Cerrada: 'b-gray',
    'Pendiente de enviar': 'b-r', 'Enviada a cotizar': 'b-y',
    'Cotizacion recibida': 'b-g', 'No aplica': 'b-gray',
  };
  return map[estado] || 'b-gray';
};

// Limpiador de números Robusto e Inteligente
export const cleanNum = (val) => {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let s = String(val).trim();
  s = s.replace(/[^0-9.,-]/g, '');
  if (!s || s === '-' || s === '.' || s === ',') return 0;

  const isNegative = s.startsWith('-');
  s = s.replace(/-/g, '');

  const normalizeSingleSeparator = (value, separator) => {
    const parts = value.split(separator);
    if (parts.length > 2) {
      const last = parts[parts.length - 1];
      return last.length === 3 ? parts.join('') : `${parts.slice(0, -1).join('')}.${last}`;
    }
    const [before, after = ''] = parts;
    if (!after) return before;
    if (after.length === 3 && before.length <= 3) return `${before}${after}`;
    return `${before}.${after}`;
  };

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const decimalPart = s.slice(Math.max(lastDot, lastComma) + 1);
    if (decimalPart.length === 3) {
      s = s.replace(/[.,]/g, '');
    } else if (decimalSeparator === ',') {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (lastComma !== -1) {
    s = normalizeSingleSeparator(s, ',');
  } else if (lastDot !== -1) {
    s = normalizeSingleSeparator(s, '.');
  }

  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return isNegative ? -n : n;
};

export const parseNum = cleanNum; // Alias para compatibilidad

// =============================================================================
// IMPORTADOR EXCEL INTELIGENTE — v3.0
// Estrategia en 3 fases para cualquier formato de itemizado:
//   Fase 1 → Detección por keywords (scored, con anti-colisión)
//   Fase 2 → Análisis estadístico de valores (para columnas sin encabezado)
//   Fase 3 → Cross-validación: Cantidad × Precio ≈ Total (confirmación matemática)
// =============================================================================
export const parseExcel = async (file) => {
  const XLSX = await import('xlsx');
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

        if (!raw || raw.length < 2) { resolve([]); return; }

        // ── Normalizar celda de encabezado ──────────────────────────────────
        const normHeader = (c) =>
          String(c).toLowerCase()
            .replace(/\n|\r/g, ' ')
            .replace(/\s+/g, ' ')
            .replace(/[()[\]$*°%]/g, '')
            .trim();

        // ── Keywords (de MÁS a MENOS específicas) ──────────────────────────
        const KW = {
          num: [
            'n°', 'nro', 'nro.', 'num', 'num.', 'item', 'ítem', 'ítems',
            'cod', 'código', 'codigo', 'cod.', '#', 'pos', 'id', 'ref',
          ],
          desc: [
            'descripcion', 'descripción', 'descripcion del item',
            'partida', 'nombre', 'detalle', 'concepto', 'glosa', 'actividad',
            'especificacion', 'especificación', 'trabajo', 'labor',
          ],
          unit: [
            'unidad de medida', 'unidad', 'und', 'u.m.', 'u.m', 'unid', 'um', 'uni', 'un',
            'medida',
          ],
          qty: [
            'cantidad total', 'cant total', 'cantidad', 'cant.', 'cant',
            'qty', 'volumen', 'vol', 'metrado', 'metraje',
          ],
          // Precio unitario — ESPECÍFICOS primero para no capturar "Precio Total"
          price: [
            'precio unitario', 'precio unit.', 'precio unit',
            'p. unitario', 'p.unitario', 'p. unit.', 'p. unit', 'p.unit.', 'p.unit',
            'valor unitario', 'valor unit.', 'valor unit',
            'costo unitario', 'costo unit.', 'costo unit',
            'monto unitario', 'monto unit', 'precio neto unit', 'valor neto unit',
            'precio general', 'valor general', 'v. general',
            'p.u.', 'p.u', 'v.u.', 'v.u', 'p/u', 'pu', 'vu',
            'unitario', 'precio neto', 'valor neto',
          ],
          total: [
            'precio total', 'valor total', 'monto total',
            'total partida', 'total item', 'total ítem', 'total ítems',
            'importe total', 'total neto', 'total bruto',
            'importe', 'subtotal', 'total',
          ],
        };

        // ────────────────────────────────────────────────────────────────────
        // FASE 1 — Detección de encabezados por keywords (con scoring)
        // Busca el mejor row, no solo el primero con 3 matches
        // ────────────────────────────────────────────────────────────────────
        const scoreHeaderRow = (rawRow) => {
          const cells = rawRow.map(normHeader);
          const map = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };
          let score = 0;
          const used = new Set();

          // Dos pasadas: exacta (peso 2) y parcial (peso 1), con anti-colisión
          for (const pass of ['exact', 'partial']) {
            for (const [key, kws] of Object.entries(KW)) {
              if (map[key] !== -1) continue;
              for (let c = 0; c < cells.length; c++) {
                if (used.has(c) || !cells[c]) continue;
                const hit = pass === 'exact'
                  ? kws.some((kw) => cells[c] === kw)
                  : kws.some((kw) => cells[c].includes(kw));
                if (hit) {
                  map[key] = c;
                  used.add(c);
                  score += pass === 'exact' ? 2 : 1;
                  break;
                }
              }
            }
          }
          return { map, score, found: Object.values(map).filter((v) => v !== -1).length };
        };

        let headerRow = -1;
        let colMap = { num: -1, desc: -1, unit: -1, qty: -1, price: -1, total: -1 };
        let bestScore = 0;

        for (let r = 0; r < Math.min(35, raw.length); r++) {
          const { map, score, found } = scoreHeaderRow(raw[r]);
          // Aceptar si tiene al menos precio+descripción, O 3+ columnas distintas
          const hasPriceAndDesc = map.price !== -1 && map.desc !== -1;
          if ((hasPriceAndDesc || found >= 3) && score > bestScore) {
            bestScore = score;
            headerRow = r;
            colMap = { ...map };
          }
        }

        // Fallback posicional si no se detectó ninguna fila de encabezados
        if (headerRow === -1) {
          headerRow = 0;
          colMap = { num: 0, desc: 1, unit: 2, qty: 3, price: 4, total: 5 };
        }

        // ────────────────────────────────────────────────────────────────────
        // FASE 2 — Análisis estadístico de valores (para columnas sin header)
        // ────────────────────────────────────────────────────────────────────
        const UNIT_VALS = new Set([
          'm2', 'm3', 'm', 'ml', 'gl', 'glb', 'gb', 'gi', 'un', 'un.',
          'kg', 'ton', 'lt', 'lts', 'hr', 'hrs', 'día', 'días', 'sem',
          'mes', 'pza', 'jgo', 'set', 'kit', 'lm', 'cm', 'mm', 'pul',
          'pa', 'pt', 'kva', 'kw', 'hp', 'rpm', 'mt', 'mts', 'fo', 'ga',
        ]);

        const dataStart = headerRow + 1;
        const sampleRows = raw
          .slice(dataStart, Math.min(dataStart + 25, raw.length))
          .filter((row) => row.some((c) => String(c).trim() !== ''));

        if (sampleRows.length > 0) {
          const numCols = Math.max(...sampleRows.map((r) => r.length));

          // Estadísticas por columna
          const stats = Array.from({ length: numCols }, (_, c) => {
            const vals = sampleRows.map((r) => r[c]);
            const nonEmpty = vals.filter((v) => String(v).trim() !== '');
            const nums = nonEmpty.map((v) => parseNum(v)).filter((n) => n > 0);
            const texts = nonEmpty.filter((v) => isNaN(Number(String(v).replace(/[.,]/g, ''))) || parseNum(v) === 0)
              .map((v) => String(v).trim());
            const unitHits = texts.filter((v) => UNIT_VALS.has(v.toLowerCase())).length;

            return {
              c,
              fillRate: nonEmpty.length / Math.max(sampleRows.length, 1),
              numericRate: nums.length / Math.max(nonEmpty.length, 1),
              avgNum: nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0,
              avgTextLen: texts.length ? texts.reduce((s, v) => s + v.length, 0) / texts.length : 0,
              unitRate: unitHits / Math.max(nonEmpty.length, 1),
              nums,
            };
          });

          const usedByKeyword = new Set(Object.values(colMap).filter((v) => v !== -1));

          // Detectar columna UNIDAD por valores (GL, M2, etc.) si no hay header
          if (colMap.unit === -1) {
            const best = stats
              .filter((s) => !usedByKeyword.has(s.c) && s.unitRate > 0.3)
              .sort((a, b) => b.unitRate - a.unitRate)[0];
            if (best) { colMap.unit = best.c; usedByKeyword.add(best.c); }
          }

          // Detectar columna DESCRIPCIÓN por longitud de texto si no hay header
          if (colMap.desc === -1) {
            const best = stats
              .filter((s) => !usedByKeyword.has(s.c) && s.numericRate < 0.3 && s.avgTextLen > 10)
              .sort((a, b) => b.avgTextLen - a.avgTextLen)[0];
            if (best) { colMap.desc = best.c; usedByKeyword.add(best.c); }
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // FASE 3 — Cross-validación: Cantidad × Precio ≈ Total
        // Busca la tripleta de columnas numéricas donde se cumple la ecuación
        // para confirmar o reemplazar las columnas detectadas
        // ────────────────────────────────────────────────────────────────────
        if (sampleRows.length >= 3) {
          const numCols = Math.max(...sampleRows.map((r) => r.length));

          // Candidatos numéricos con más del 30% de filas con valor
          const numCandidates = Array.from({ length: numCols }, (_, c) => {
            const vals = sampleRows.map((r) => parseNum(r[c])).filter((n) => n > 0);
            return { c, count: vals.length, avg: vals.length ? vals.reduce((s, n) => s + n, 0) / vals.length : 0 };
          }).filter((s) => s.count / sampleRows.length > 0.3);

          let bestMatchRate = 0.6; // umbral mínimo
          let bestTriple = null;

          for (const qCol of numCandidates) {
            for (const pCol of numCandidates) {
              if (pCol.c === qCol.c) continue;
              for (const tCol of numCandidates) {
                if (tCol.c === pCol.c || tCol.c === qCol.c) continue;
                let matches = 0, checked = 0;
                for (const row of sampleRows) {
                  const q = parseNum(row[qCol.c]);
                  const p = parseNum(row[pCol.c]);
                  const t = parseNum(row[tCol.c]);
                  if (q > 0 && p > 0 && t > 0) {
                    checked++;
                    // Tolerancia del 2% para redondeos de IVA o decimales
                    if (Math.abs(q * p - t) / t < 0.02) matches++;
                  }
                }
                const rate = checked >= 2 ? matches / checked : 0;
                if (rate > bestMatchRate) {
                  bestMatchRate = rate;
                  // qty = la de menor promedio, price = la de mayor promedio
                  const sorted = [qCol, pCol].sort((a, b) => a.avg - b.avg);
                  bestTriple = { qty: sorted[0].c, price: sorted[1].c, total: tCol.c };
                }
              }
            }
          }

          if (bestTriple) {
            // Solo reemplazar si la cross-validación encontró algo más sólido
            if (colMap.qty === -1 || colMap.price === -1 || colMap.total === -1) {
              if (colMap.qty === -1) colMap.qty = bestTriple.qty;
              if (colMap.price === -1) colMap.price = bestTriple.price;
              if (colMap.total === -1) colMap.total = bestTriple.total;
            } else if (bestMatchRate > 0.85) {
              // Alta confianza → reemplazar incluso si ya había detección por keyword
              colMap.qty   = bestTriple.qty;
              colMap.price = bestTriple.price;
              colMap.total = bestTriple.total;
            }
          }
        }

        // ────────────────────────────────────────────────────────────────────
        // EXTRACCIÓN DE DATOS
        // ────────────────────────────────────────────────────────────────────
        const items = [];
        for (let r = headerRow + 1; r < raw.length; r++) {
          const row = raw[r];
          const desc   = colMap.desc !== -1 ? String(row[colMap.desc] || '').trim() : '';
          const qty    = colMap.qty  !== -1 ? parseNum(row[colMap.qty])  : 0;
          const codigo = colMap.num  !== -1 ? String(row[colMap.num] || '').trim() : '';

          // Saltar filas vacías
          if (!desc) continue;
          // Saltar filas de totales / subtotales
          if (/^(total\b|subtotal\b|suma\b|resumen\b|gran total)/i.test(desc)) continue;
          // Saltar filas de sección (código sin precio ni cantidad)
          if (!qty && colMap.price !== -1 && parseNum(row[colMap.price]) === 0
              && colMap.total !== -1 && parseNum(row[colMap.total]) === 0) continue;

          // ── Precio unitario con fallbacks ─────────────────────────────────
          let price = 0;

          // A: columna precio detectada
          if (colMap.price !== -1) price = parseNum(row[colMap.price]);

          // B: derivar de total ÷ cantidad
          if (price === 0 && colMap.total !== -1 && qty > 0) {
            const t = parseNum(row[colMap.total]);
            if (t > 0) price = t / qty;
          }

          // C: item lump-sum (qty = 0 o 1, usar total directo)
          if (price === 0 && colMap.total !== -1) {
            price = parseNum(row[colMap.total]);
          }

          // Saltar filas sin ningún valor monetario
          if (price === 0 && qty === 0) continue;

          // ── Resolver unidad ───────────────────────────────────────────────
          const unidad = colMap.unit !== -1
            ? (String(row[colMap.unit] || '').trim() || 'UN')
            : 'UN';

          items.push({
            codigo,
            descripcion: desc,
            unidad,
            cantidad: qty > 0 ? qty : 1,
            precio_unitario: Math.round(price),
          });
        }

        // ── Información de diagnóstico para el UI ─────────────────────────────
        const toColLetter = (idx) => {
          if (idx === -1) return '(no detectada)';
          const L = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
          if (idx < 26) return L[idx];
          return L[Math.floor(idx / 26) - 1] + L[idx % 26];
        };
        const colNames = Object.fromEntries(
          Object.entries(colMap).map(([k, v]) => [k, toColLetter(v)])
        );

        resolve({
          items,
          debug: {
            headerRow,
            colMap,
            colNames,
            crossValidated: !!(bestTriple && bestMatchRate > 0.85),
            priceFromFallback: colMap.price === -1 && colMap.total !== -1,
          },
        });
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
          const rut    = colMap.rut    !== -1 ? String(row[colMap.rut]    || '').trim() : '';
          const sueldo = colMap.sueldo !== -1 ? parseFloat(row[colMap.sueldo]) : 0;
          const cargo  = colMap.cargo  !== -1 ? String(row[colMap.cargo]  || '').trim() : '';

          if (!nombre && !rut) continue;

          items.push({
            rut,
            nombre,
            cargo,
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
