-- Explicit synthetic LOCAL settings, not owner-approved commercial defaults.
-- This file is applied only by the guarded local bootstrap, never by migration/seed.
insert into public.policy_versions(effective_from,minimum_minutes,start_increment_minutes,duration_increment_minutes,
 guest_lead_minutes,guest_cutoff_inclusive,payment_window_minutes,payment_cutoff_minutes,no_refund_within_minutes,
 booking_horizon_days,max_duration_minutes,provisional,change_note)
select clock_timestamp(),60,60,60,60,true,120,60,1440,30,240,true,'Synthetic local guest testing only';
insert into private.guest_booking_policies(effective_from,purpose,quote_ttl_seconds,window_seconds,request_limit,intent_request_limit,
 max_quotes,max_pending_requests,max_active_holds,max_players,minimum_payment_seconds,retention_seconds,contact_kind,public_terms)
values(clock_timestamp(),'synthetic_local_only',120,60,200,40,10,10,5,12,60,86400,'synthetic_email',
 '{"notice":"Synthetic local testing only. Unpaid hold, no payment collection or confirmed reservation.","privacy":"Use invented names and example.invalid email addresses only. No notifications or identity verification.","cancellation":"Staff review required. Partial refund policy remains undecided; no refunds implemented.","hours":"Provisional Asia/Manila hours; not owner-confirmed."}');
