-- Allow authenticated listing owners to delete finalized media from the public
-- product-images bucket during profile-based listing edits.
--
-- Why DELETE only?
-- - The existing create-listing flow uploads temporary files before a real listing id
--   exists, using a path like {phone_or_prefix}/temp_xxx/{filename}.
-- - Tightening INSERT around auth.uid() or listing ownership would break that flow.
-- - Finalized listing media is stored under {prefix}/{listing_id}/{filename}, so the
--   second folder segment can safely map back to public.listings.id for deletes.

drop policy if exists "product_images_delete_owned_listing_media" on storage.objects;

create policy "product_images_delete_owned_listing_media"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and exists (
    select 1
    from public.listings as l
    where l.id::text = (storage.foldername(name))[2]
      and l.user_id = auth.uid()
  )
);