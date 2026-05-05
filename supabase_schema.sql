-- Habilitar extensión pgcrypto para UUIDs si no está activa
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de Obras
CREATE TABLE obras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    estado TEXT DEFAULT 'En Progreso',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Presupuesto
CREATE TABLE presupuesto_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    unidad TEXT NOT NULL,
    cantidad NUMERIC NOT NULL DEFAULT 0,
    precio_unitario NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de Compras
CREATE TABLE compras (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id UUID NOT NULL REFERENCES obras(id) ON DELETE CASCADE,
    descripcion TEXT NOT NULL,
    unidad TEXT NOT NULL,
    cantidad NUMERIC NOT NULL DEFAULT 0,
    precio_unitario NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración de Seguridad (Row Level Security)

-- Obras
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver sus propias obras" ON obras FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden insertar sus propias obras" ON obras FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden actualizar sus propias obras" ON obras FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Usuarios pueden eliminar sus propias obras" ON obras FOR DELETE USING (auth.uid() = user_id);

-- Presupuesto
ALTER TABLE presupuesto_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver items de sus obras" ON presupuesto_items FOR SELECT USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden insertar items de sus obras" ON presupuesto_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden actualizar items de sus obras" ON presupuesto_items FOR UPDATE USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden eliminar items de sus obras" ON presupuesto_items FOR DELETE USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = presupuesto_items.obra_id AND obras.user_id = auth.uid())
);

-- Compras
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios pueden ver compras de sus obras" ON compras FOR SELECT USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden insertar compras de sus obras" ON compras FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden actualizar compras de sus obras" ON compras FOR UPDATE USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid())
);
CREATE POLICY "Usuarios pueden eliminar compras de sus obras" ON compras FOR DELETE USING (
    EXISTS (SELECT 1 FROM obras WHERE obras.id = compras.obra_id AND obras.user_id = auth.uid())
);
