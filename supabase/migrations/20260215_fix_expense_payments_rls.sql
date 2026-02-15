-- Enable RLS on expense_payments if not already enabled (idempotent)
ALTER TABLE expense_payments ENABLE ROW LEVEL SECURITY;

-- Policy to allow authenticated users to INSERT payments
-- We check that the user_id in the new row matches the authenticated user's ID to ensure integrity
CREATE POLICY "Enable insert for authenticated users" ON "expense_payments"
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy to allow authenticated users to VIEW payments
-- Users should be able to see payments they made, OR all payments if they are staff. 
-- For simplicity in this POS context where users share data, we might allow viewing all.
-- But usually it's better to stick to standard permissions.
-- Given the context of a small business POS, likely all authenticated users can view all business records.
CREATE POLICY "Enable select for authenticated users" ON "expense_payments"
FOR SELECT TO authenticated
USING (true);

-- Policy to allow authenticated users to UPDATE/DELETE (if needed for corrections)
CREATE POLICY "Enable update for authenticated users" ON "expense_payments"
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Enable delete for authenticated users" ON "expense_payments"
FOR DELETE TO authenticated
USING (true);
