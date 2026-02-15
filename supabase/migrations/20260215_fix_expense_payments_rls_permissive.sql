-- Drop existing policies to start fresh and avoid conflicts
-- We use "IF EXISTS" to prevent errors if they don't exist yet
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON "expense_payments";
DROP POLICY IF EXISTS "Enable select for authenticated users" ON "expense_payments";
DROP POLICY IF EXISTS "Enable update for authenticated users" ON "expense_payments";
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON "expense_payments";
DROP POLICY IF EXISTS "Permitir insertar pagos propios" ON "expense_payments";
DROP POLICY IF EXISTS "Permitir ver todos los pagos" ON "expense_payments";
DROP POLICY IF EXISTS "Permitir editar pagos" ON "expense_payments";
DROP POLICY IF EXISTS "Permitir eliminar pagos" ON "expense_payments";

-- Ensure RLS is enabled
ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;

-- Create BROAD permission policies for authenticated users
-- This allows any logged-in user to Insert, Select, Update, and Delete rows in this table.
-- This is appropriate for a small business internal tool where all staff are trusted.

CREATE POLICY "Allow all actions for authenticated users" ON "expense_payments"
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
