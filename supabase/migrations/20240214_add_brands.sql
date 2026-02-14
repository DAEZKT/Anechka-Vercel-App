-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add brand_id to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS brand_id UUID REFERENCES brands(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);

-- Optional: Populate brands from existing text column (if any)
-- This is unique strictly to migrate existing text brands to the new table
DO $$
BEGIN
    -- Insert distinct brands from products that don't exist in brands table
    INSERT INTO brands (name, slug)
    SELECT DISTINCT brand, LOWER(REPLACE(brand, ' ', '-')) 
    FROM products 
    WHERE brand IS NOT NULL AND brand != ''
    AND NOT EXISTS (SELECT 1 FROM brands WHERE brands.name = products.brand);

    -- Update products to link to the new brand_ids
    UPDATE products
    SET brand_id = brands.id
    FROM brands
    WHERE products.brand = brands.name
    AND products.brand_id IS NULL;
END $$;
