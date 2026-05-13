import { parseNum } from './helpers';

// Variantes aceptadas de cada columna (case-insensitive)
const COLUMNA_ALIASES = {
  clasificacion:     ['clasificacion', 'clasificación', 'clasif'],
  cuenta:            ['cuenta', 'cta', 'cuenta contable'],
  fecha:             ['fecha', 'date', 'fec'],
  tipo_v:            ['tipo v', 'tipov', 'tipo_v', 'tipo'],
  numero_comprobante:['nº comp.', 'n° comp.', 'num comp', 'comprobante'],
  glosa:             ['glosa', 'descripcion', 'descripción', 'detalle'],
  numero_documento:  ['nº docto.', 'n° docto.', 'num docto', 'n docto'],
  tipo_documento:    ['tipo docto.', 'tipo doc', 'tipodoc'],
  rut_proveedor:     ['rut', 'r.u.t', 'rut proveedor'],
  nombre_proveedor:  ['nombre', 'proveedor', 'razon social'],
  centro_costo:      ['c.c.', 'cc', 'centro costo', 'centro de costo'],
  debe:              ['debe', 'cargo', 'debito'],
  haber:             ['haber', 'abono', 'credito'],
  saldo:             ['saldo', 'saldo acumulado'],
};

const normHeader = (c) => String(c).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

function detectarColumna(key, headers) {
  const aliases = COLUMNA_ALIASES[key] || [];
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (aliases.some((a) => h.includes(a))) return i;
  }
  return -1;
}

export function convertirFechaTsv(valor) {
  if (!valor) return null;
  const s = String(valor).trim();
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    const [, d, mo, y] = m1;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  return null;
}

export function generarHashTsv(row) {
  const raw = [row.fecha, row.tipo_documento, row.numero_documento, row.rut_proveedor, row.cuenta, row.centro_costo, row.debe, row.haber, row.glosa].join('|');
  let h = 5381;
  for (let i = 0; i < raw.length; i++) h = ((h << 5) + h + raw.charCodeAt(i)) >>> 0;
  return `${h.toString(16)}-${btoa(unescape(encodeURIComponent(raw.slice(0, 40)))).replace(/[^a-zA-Z0-9]/g, '').slice(0, 15)}`;
}

export function parseTsvData(tsvText, aliasesMap) {
  const lines = tsvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return { error: 'No hay datos suficientes o el formato es incorrecto.' };

  // Intentar detectar encabezados en las primeras 5 líneas
  let headerRowIdx = -1;
  let colMap = {};
  for (let r = 0; r < Math.min(5, lines.length); r++) {
    const cells = lines[r].split('\t');
    let hits = 0;
    const tempMap = {};
    for (const key of Object.keys(COLUMNA_ALIASES)) {
      const idx = detectarColumna(key, cells);
      if (idx !== -1) { tempMap[key] = idx; hits++; }
    }
    if (hits >= 6) {
      headerRowIdx = r;
      colMap = tempMap;
      break;
    }
  }

  if (headerRowIdx === -1) {
    return { error: 'No se detectaron las columnas requeridas. Asegúrate de copiar la fila de títulos.' };
  }

  const movimientos = [];
  const ccUnicos = new Set();

  for (let r = headerRowIdx + 1; r < lines.length; r++) {
    const cells = lines[r].split('\t');
    if (cells.length < 3) continue;

    const cc = colMap.centro_costo !== undefined ? String(cells[colMap.centro_costo] || '').trim() : '';
    const debe = parseNum(cells[colMap.debe]);
    const haber = parseNum(cells[colMap.haber]);
    if (debe === 0 && haber === 0 && !cc) continue;

    if (cc && cc.toUpperCase() !== 'PEND ASIGNACION') ccUnicos.add(cc);

    const ccUp = cc.toUpperCase();
    const obraId = aliasesMap[ccUp] || null;

    const mov = {
      obra_id: obraId,
      centro_costo: cc,
      clasificacion: String(cells[colMap.clasificacion] || '').trim(),
      cuenta: String(cells[colMap.cuenta] || '').trim(),
      fecha: convertirFechaTsv(cells[colMap.fecha]),
      tipo_v: String(cells[colMap.tipo_v] || '').trim(),
      numero_comprobante: String(cells[colMap.numero_comprobante] || '').trim(),
      glosa: String(cells[colMap.glosa] || '').trim(),
      numero_documento: String(cells[colMap.numero_documento] || '').trim(),
      tipo_documento: String(cells[colMap.tipo_documento] || '').trim(),
      rut_proveedor: String(cells[colMap.rut_proveedor] || '').trim(),
      nombre_proveedor: String(cells[colMap.nombre_proveedor] || '').trim(),
      debe,
      haber,
      saldo: parseNum(cells[colMap.saldo]),
    };
    mov.hash_unico = generarHashTsv(mov);
    movimientos.push(mov);
  }

  return { movimientos, ccUnicos: Array.from(ccUnicos).sort() };
}
