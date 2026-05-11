-- =============================================================================
-- Convert document_category enum → document_categories table
-- =============================================================================
-- Allows admins to add new document categories at runtime. The 11 enum values
-- become seed rows (with is_default=true) so existing UI keeps working. New
-- documents reference categories by FK. The old enum column on documents is
-- preserved as `legacy_category` for one release in case we need to recover.
-- =============================================================================

CREATE TABLE document_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 999,
  is_default boolean NOT NULL DEFAULT false,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Same auth policy shape as payers: every authenticated user can SELECT
-- (the dropdown needs to read this); only admins can INSERT/UPDATE/DELETE.
ALTER TABLE document_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "document_categories_select" ON document_categories
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "document_categories_admin_insert" ON document_categories
  FOR INSERT TO authenticated
  WITH CHECK (private.is_admin());

CREATE POLICY "document_categories_admin_update" ON document_categories
  FOR UPDATE TO authenticated
  USING (private.is_admin())
  WITH CHECK (private.is_admin());

CREATE POLICY "document_categories_admin_delete" ON document_categories
  FOR DELETE TO authenticated
  USING (private.is_admin());

-- Seed the 11 existing values (sort_order matches the order in the original enum).
INSERT INTO document_categories (name, label, sort_order, is_default) VALUES
  ('license',          'License',          10,  true),
  ('dea',              'DEA',              20,  true),
  ('cv',               'CV',               30,  true),
  ('malpractice',      'Malpractice',      40,  true),
  ('caqh',             'CAQH',             50,  true),
  ('payer_letter',     'Payer letter',     60,  true),
  ('contract',         'Contract',         70,  true),
  ('denial',           'Denial letter',    80,  true),
  ('info_request',     'Info request',     90,  true),
  ('internal_staging', 'Internal staging', 100, true),
  ('other',            'Other',            999, true);

-- Add category_id column on documents and backfill from the old enum value.
ALTER TABLE documents ADD COLUMN category_id uuid REFERENCES document_categories(id);

UPDATE documents
SET category_id = c.id
FROM document_categories c
WHERE c.name = documents.category::text;

-- Now make it NOT NULL and indexed (we know all rows are populated because
-- every old enum value has a matching seed row).
ALTER TABLE documents ALTER COLUMN category_id SET NOT NULL;
CREATE INDEX documents_category_id_idx ON documents(category_id);

-- Rename the old column to legacy_category. Keep it for one release window so
-- we can recover if anything goes wrong; subsequent migration will drop it.
ALTER TABLE documents RENAME COLUMN category TO legacy_category;
ALTER TABLE documents ALTER COLUMN legacy_category DROP NOT NULL;
