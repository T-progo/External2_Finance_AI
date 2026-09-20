-- Migration: Add additional fields to profiles and clientes tables
-- These fields are used when creating users/clients with data from external API

-- Add fields to profiles table (for all users, but mainly used for clientes)
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS codigo TEXT,
ADD COLUMN IF NOT EXISTS tipo_empresa TEXT,
ADD COLUMN IF NOT EXISTS provincia TEXT,
ADD COLUMN IF NOT EXISTS nombre_fiscal TEXT,
ADD COLUMN IF NOT EXISTS cif TEXT;

-- Add fields to clientes table (more appropriate location for client-specific data)
ALTER TABLE clientes 
ADD COLUMN IF NOT EXISTS codigo TEXT,
ADD COLUMN IF NOT EXISTS tipo_empresa TEXT,
ADD COLUMN IF NOT EXISTS provincia TEXT,
ADD COLUMN IF NOT EXISTS nombre_fiscal TEXT,
ADD COLUMN IF NOT EXISTS cif TEXT;

-- Add index on codigo for faster lookups
CREATE INDEX IF NOT EXISTS idx_clientes_codigo ON clientes(codigo);
CREATE INDEX IF NOT EXISTS idx_profiles_codigo ON profiles(codigo);
