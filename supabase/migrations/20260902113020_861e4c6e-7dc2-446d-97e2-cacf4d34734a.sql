-- Defense-in-depth: explicit policies on storage.objects for the private
-- projector-media bucket. Direct client access (anon/authenticated) is denied;
-- all legitimate access goes through server functions that validate the
-- projector token and hand out short-lived signed URLs.

DROP POLICY IF EXISTS "projector_media_no_direct_client_access" ON storage.objects;
CREATE POLICY "projector_media_no_direct_client_access"
ON storage.objects
AS RESTRICTIVE
FOR ALL
TO anon, authenticated
USING (bucket_id <> 'projector-media')
WITH CHECK (bucket_id <> 'projector-media');

DROP POLICY IF EXISTS "projector_media_service_role_full_access" ON storage.objects;
CREATE POLICY "projector_media_service_role_full_access"
ON storage.objects
FOR ALL
TO service_role
USING (bucket_id = 'projector-media')
WITH CHECK (bucket_id = 'projector-media');