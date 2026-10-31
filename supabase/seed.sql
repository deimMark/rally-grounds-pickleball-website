-- Provisional synthetic club configuration. No Auth credentials or customer/payment data.
insert into public.courts(id,number,layout_row,layout_column) values
 ('00000000-0000-4000-8000-000000000001',1,3,3),
 ('00000000-0000-4000-8000-000000000002',2,2,3),
 ('00000000-0000-4000-8000-000000000003',3,1,1),
 ('00000000-0000-4000-8000-000000000004',4,1,2),
 ('00000000-0000-4000-8000-000000000005',5,1,3);
insert into public.club_settings_versions(effective_from,name,timezone,branding,change_note) values
 ('2020-01-01T00:00:00Z','Rally Grounds','Asia/Manila','{"navy":"#102B50","blue":"#1E5A99","gold":"#D7AD6B","ivory":"#F8F5ED"}','Synthetic initial club');
insert into public.policy_versions(effective_from,minimum_minutes,start_increment_minutes,duration_increment_minutes,guest_lead_minutes,payment_window_minutes,no_refund_within_minutes,change_note)
 values('2020-01-01T00:00:00Z',60,60,60,60,120,1440,'Provisional hourly configuration; undecided fields intentionally null');
insert into public.court_config_versions(court_id,effective_from,enabled,rate_centavos,opening_minute,closing_minute,change_note)
 select id,'2020-01-01T00:00:00Z',true,60000,480,1380,'Provisional daily hours and initial rental price' from public.courts;
