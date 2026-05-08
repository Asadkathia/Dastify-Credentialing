-- =============================================================================
-- Documents storage bucket + RLS
-- =============================================================================
-- Creates a private 'documents' bucket and policies on storage.objects that
-- mirror the public.documents table policies:
--   - Admins read/write/delete every object in the bucket
--   - Clients read objects in the bucket where the corresponding documents row
--     belongs to their client_id, is not internal, and isn't soft-deleted
--   - Nobody else gets anything (default deny via no policy match)
--
-- The link between a storage object and the documents row is the storage path:
-- documents.storage_path stores the same key used in storage.objects.name.
-- We encode `<client_id>/<owner_type>/<owner_id>/<uuid>-<filename>` so RLS can
-- extract the client_id from the path and join to the documents table.
--
-- File constraints:
--   - 50 MB max per file
--   - Allowed: PDFs, common image types, Word, plain text, CSV
--     (Excel exports go through our own .xlsx route, not user uploads.)
-- =============================================================================

-- Create the bucket (idempotent).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800,  -- 50 MB
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/csv'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── RLS policies on storage.objects (scoped to bucket_id = 'documents') ─────

-- Admins: full access in the bucket.
CREATE POLICY "documents_storage_admin_all"
  ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'documents'
    AND private.is_admin()
  )
  WITH CHECK (
    bucket_id = 'documents'
    AND private.is_admin()
  );

-- Clients: SELECT only when there's a matching documents row that they're
-- allowed to see (same predicate as documents_select).
CREATE POLICY "documents_storage_client_select"
  ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documents'
    AND EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.storage_path = storage.objects.name
        AND d.client_id = private.current_client_id()
        AND d.is_internal = false
        AND d.deleted_at IS NULL
    )
  );

-- Note: client INSERT/UPDATE/DELETE on storage are intentionally NOT granted.
-- Clients can only download (SELECT generates the signed URL); admins do all
-- uploads in v1. If we later add client-side uploads (e.g. uploading a CV),
-- add a scoped INSERT policy then.
