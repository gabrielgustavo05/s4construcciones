# Constructora S4

Dashboard web para control operativo y financiero de obras: presupuestos, compras, mano de obra, subcontratos, estados de pago, flujo de caja, alertas y logistica.

## Stack

- React + Vite
- Supabase Auth, Database y Storage
- Vercel
- Chart.js

## Configuracion local

1. Instalar dependencias:

```bash
npm install
```

2. Crear `.env.local` usando `.env.example`:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

3. Ejecutar desarrollo:

```bash
npm run dev
```

## Deploy en Vercel

Configurar estas variables en el proyecto de Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

El archivo `vercel.json` incluye rewrite a `index.html` para soportar rutas de React Router.

## Seguridad Supabase

El frontend usa la anon key publica de Supabase. La seguridad real debe estar en Row Level Security.

Antes de produccion:

- Revisar y aplicar `supabase_hardening.sql` en Supabase SQL Editor.
- No usar `rls_todos_usuarios.sql` en produccion; abre las tablas a cualquier usuario autenticado.
- Confirmar que los perfiles tengan roles correctos: `Administrador`, `Gerencia` o usuario operativo.
- Validar politicas en staging antes de cambiar una base con datos reales.

## Scripts

```bash
npm run dev
npm run build
npm run lint
npm run preview
```
