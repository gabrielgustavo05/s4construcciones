import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { calcCompras, calcCostoReal, calcDesviacion, calcPresupuesto } from '../src/lib/helpers.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const sidebar = readFileSync(new URL('../src/components/Sidebar.jsx', import.meta.url), 'utf8');
const dashboard = readFileSync(new URL('../src/pages/Dashboard.jsx', import.meta.url), 'utf8');
const logistica = readFileSync(new URL('../src/pages/Logistica.jsx', import.meta.url), 'utf8');

const appRoutes = new Set(
  [...app.matchAll(/<Route path="([^"]+)"/g)]
    .map((match) => match[1])
    .filter((route) => !route.includes('*'))
    .map((route) => (route.startsWith('/') ? route : `/${route}`))
);

for (const [, navPath] of sidebar.matchAll(/to: '([^']+)'/g)) {
  assert.ok(appRoutes.has(navPath), `Sidebar apunta a una ruta inexistente: ${navPath}`);
}

assert.ok(
  logistica.includes(".from('compras')") && logistica.includes('precio_unitario: montoTotal'),
  'Logistica debe crear una compra real para impactar costo de obra y dashboard'
);
assert.ok(
  dashboard.includes("table: 'compras'") && dashboard.includes("table: 'asistencia'"),
  'Dashboard debe escuchar cambios de costos reales en realtime'
);

const compras = [
  { cantidad: 1, precio_unitario: 1190000 },
  { cantidad: 1, precio_unitario: 595000 },
  { cantidad: 1, precio_unitario: 100000 },
];

const totalCompras = calcCompras(compras);
assert.equal(totalCompras, 1885000, 'El total de compras base debe incluir todas las lineas cargadas');

const costoReal = calcCostoReal({ compras }).total;
assert.equal(costoReal, 1885000, 'El costo real debe sumar las compras cuando no hay otros costos');

const desviacion = calcDesviacion(10000000, costoReal);
assert.equal(desviacion.diferencia, 8115000, 'Saldo disponible incorrecto para presupuesto de 10.000.000');
assert.equal(desviacion.porcentaje, 19, 'Porcentaje usado esperado redondeado: 19%');

const presupuesto = calcPresupuesto([{ cantidad: 1, precio_unitario: 10000000 }], 0, 0);
assert.equal(presupuesto.neto, 10000000, 'Presupuesto neto base incorrecto');
assert.equal(presupuesto.iva, 1900000, 'IVA de presupuesto incorrecto');
assert.equal(presupuesto.total, 11900000, 'Presupuesto total bruto incorrecto');

console.log('QA smoke OK: rutas principales y calculos financieros base validados.');
