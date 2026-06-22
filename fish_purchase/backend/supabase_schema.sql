-- Supabase Database Schema
-- Run this SQL in your Supabase SQL Editor to create the required tables
-- Access: https://app.supabase.com > Your Project > SQL Editor

-- Table: configs
-- Stores configuration snapshots to avoid duplication in calculation_records
-- Config is stored once and referenced by multiple records
CREATE TABLE IF NOT EXISTS configs (
    id BIGSERIAL PRIMARY KEY,
    market_handling_cost NUMERIC(10, 4) NOT NULL,
    fixed_cost NUMERIC(10, 4) NOT NULL,
    packaging_cost NUMERIC(10, 4) NOT NULL,
    delivery_cost NUMERIC(10, 4) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- Create a unique constraint on the config values to prevent duplicates
    UNIQUE(market_handling_cost, fixed_cost, packaging_cost, delivery_cost)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_configs_values 
    ON configs(market_handling_cost, fixed_cost, packaging_cost, delivery_cost);

-- Table: calculation_records
-- Stores calculation records with inputs and outputs
-- Config is referenced via config_id instead of storing duplicate JSON
CREATE TABLE IF NOT EXISTS calculation_records (
    id BIGSERIAL PRIMARY KEY,
    record_date TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    config_id BIGINT NOT NULL REFERENCES configs(id) ON DELETE RESTRICT,
    inputs JSONB NOT NULL,
    outputs JSONB NOT NULL
);

-- Index for faster date-based queries
CREATE INDEX IF NOT EXISTS idx_calculation_records_record_date 
    ON calculation_records(record_date);

-- Index for faster sorting by creation time
CREATE INDEX IF NOT EXISTS idx_calculation_records_created_at 
    ON calculation_records(created_at DESC);

-- Index for faster config lookups
CREATE INDEX IF NOT EXISTS idx_calculation_records_config_id 
    ON calculation_records(config_id);

-- Table: raw_fish_products
-- Stores raw fish product names
CREATE TABLE IF NOT EXISTS raw_fish_products (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for faster name-based queries
CREATE INDEX IF NOT EXISTS idx_raw_fish_products_name 
    ON raw_fish_products(name);

-- Enable Row Level Security (RLS) - adjust policies as needed
-- For now, we'll allow all operations (you can restrict this later)
ALTER TABLE configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE calculation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_fish_products ENABLE ROW LEVEL SECURITY;

-- Policy: Allow anonymous access (for development/testing)
-- IMPORTANT: For production, restrict these policies based on your security requirements
-- The anon key is used, so we need anonymous access policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON configs;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON calculation_records;
DROP POLICY IF EXISTS "Allow all operations for authenticated users" ON raw_fish_products;
DROP POLICY IF EXISTS "Allow anonymous access" ON configs;
DROP POLICY IF EXISTS "Allow anonymous access" ON calculation_records;
DROP POLICY IF EXISTS "Allow anonymous access" ON raw_fish_products;

-- Create anonymous access policies
CREATE POLICY "Allow anonymous access" ON configs
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access" ON calculation_records
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access" ON raw_fish_products
    FOR ALL USING (true) WITH CHECK (true);

-- Note: For production, you should:
-- 1. Use service role key on backend (not anon key)
-- 2. Or implement proper authentication
-- 3. Restrict policies based on user roles

