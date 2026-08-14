revoke all on function public.patient_medicine_sync_secret_is_valid(text)
  from public, anon, authenticated;
revoke all on function public.resolve_patient_custom_medicine_hospital(uuid)
  from public, anon, authenticated;
revoke all on function public.claim_patient_custom_medicine_sync(uuid, text)
  from public, anon, authenticated;
revoke all on function public.complete_patient_custom_medicine_sync(
  uuid,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.fail_patient_custom_medicine_sync(
  uuid,
  text,
  text
) from public, anon, authenticated;
revoke all on function public.request_patient_custom_medicine_sync(uuid)
  from public, anon, authenticated;
revoke all on function public.enqueue_patient_custom_medicine_sync()
  from public, anon, authenticated;
revoke all on function public.enqueue_pending_patient_medicine_syncs(integer)
  from public, anon, authenticated;

grant execute on function public.claim_patient_custom_medicine_sync(uuid, text)
  to service_role;
grant execute on function public.complete_patient_custom_medicine_sync(
  uuid,
  text,
  text
) to service_role;
grant execute on function public.fail_patient_custom_medicine_sync(
  uuid,
  text,
  text
) to service_role;
