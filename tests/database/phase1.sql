-- Run only on a disposable database initialized by run-phase1.sh.
\set owner '10000000-0000-0000-0000-000000000001'
\set stranger '10000000-0000-0000-0000-000000000002'
\set vet_user '10000000-0000-0000-0000-000000000003'
\set admin '10000000-0000-0000-0000-000000000004'
\set second_vet_user '10000000-0000-0000-0000-000000000005'
\set vet '20000000-0000-0000-0000-000000000001'
\set second_vet '20000000-0000-0000-0000-000000000002'
\set pet '30000000-0000-0000-0000-000000000001'
\set other_pet '30000000-0000-0000-0000-000000000002'
\set reminder '40000000-0000-0000-0000-000000000001'

create function pg_temp.check_that(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
  if p_condition is not true then raise exception 'Failed: %', p_label; end if;
  raise notice 'Passed: %', p_label;
end;
$$;

create function pg_temp.reject(p_sql text, p_state text, p_label text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlstate <> p_state then raise; end if;
    raise notice 'Passed: %', p_label;
    return;
  end;
  raise exception 'Expected SQLSTATE %: %', p_state, p_label;
end;
$$;

select pg_temp.check_that(not exists (select 1 from public.vet_profiles where verified),
  'legacy approval flags are invalidated');
insert into auth.users (id) values (:'owner'), (:'stranger'), (:'vet_user'), (:'admin'), (:'second_vet_user');
update public.profiles set full_name = 'Public name', phone = 'Private phone' where id = :'owner';
insert into public.user_roles (user_id, role)
values (:'owner', 'pet_parent'), (:'vet_user', 'vet'), (:'admin', 'admin'), (:'second_vet_user', 'vet');
insert into public.vet_profiles (id, user_id, name)
values (:'vet', :'vet_user', 'Assigned Vet'), (:'second_vet', :'second_vet_user', 'Second Vet');
insert into public.pets (id, owner_id, name) values (:'pet', :'owner', 'Pat'), (:'other_pet', :'stranger', 'Other');
insert into public.vet_availability (vet_id, weekday, start_minute, end_minute)
select :'vet', weekday, offset_mins, 720
from generate_series(0, 6) weekday cross join (values (600), (615)) times(offset_mins);

set role anon;
select pg_temp.reject('select phone from public.profiles', '42501', 'anonymous cannot query private profiles');
select pg_temp.check_that((select full_name = 'Public name' from public.profile_directory where id = :'owner'),
  'anonymous can read the directory projection');
select pg_temp.reject('select phone from public.profile_directory', '42703', 'directory excludes phone');
select pg_temp.reject('select public.process_appointment_reminders()', '42501', 'anonymous cannot run reminders');
select pg_temp.reject('select * from public.claim_pending_push_notifications()', '42501', 'anonymous cannot claim push data');
select pg_temp.reject('select public.book_appointment(null,null,null,null,null)', '42501', 'anonymous cannot book');
reset role;

set role authenticated;
set request.jwt.claim.sub = :'owner';
select pg_temp.check_that(
  (select phone = 'Private phone' from public.profiles where id = :'owner')
  and not exists (select 1 from public.profiles where id = :'stranger'),
  'owner can read their own private profile only');
select pg_temp.reject('insert into public.appointments default values', '42501', 'direct appointment insert denied');
select pg_temp.reject('update public.appointments set status = ''completed''', '42501', 'direct appointment update denied');
select pg_temp.reject('select public.process_appointment_reminders()', '42501', 'owner cannot run reminders');
select pg_temp.reject('select public.request_vet_license_review(''TEST-12'')', '42501', 'non-vet cannot request approval');
select pg_temp.reject(format('select public.book_appointment(%L,%L,now()+interval ''1 day'',''video'',''Symptoms'')',
  :'vet', :'pet'), '55001', 'booking requires approved vet');

set request.jwt.claim.sub = :'vet_user';
select pg_temp.reject(format('update public.vet_profiles set verified=true where id=%L', :'vet'),
  '42501', 'vet cannot set verified directly');
select pg_temp.reject(format('select public.approve_vet(%L,true)', :'vet'),
  '42501', 'vet cannot call admin approval');
select public.request_vet_license_review('  TEST-12  ');
select pg_temp.check_that(
  (select license_number='TEST-12' and status='pending' from public.vet_license_requests where vet_id=:'vet')
  and (select not verified from public.vet_profiles where id=:'vet'), 'submission is private and does not approve');
select pg_temp.reject('select public.request_vet_license_review(''OTHER-12'')',
  '55000', 'vet cannot replace credentials during review');
select pg_temp.reject('select * from public.claim_pending_push_notifications()', '42501', 'vet cannot claim push data');

set request.jwt.claim.sub = :'second_vet_user';
select public.request_vet_license_review('TEST-34');
select pg_temp.check_that(not exists (select 1 from public.vet_license_requests where vet_id=:'vet'),
  'another vet cannot read the pending license');

set request.jwt.claim.sub = :'admin';
select pg_temp.check_that((select phone='Private phone' from public.profiles where id=:'owner'),
  'admin retains authenticated profile access');
select pg_temp.reject('select public.process_appointment_reminders()', '42501', 'admin JWT is not a worker');
select pg_temp.check_that((select license_number='TEST-12' from public.vet_license_requests where vet_id=:'vet'),
  'admin sees submitted license');
select (public.approve_vet(:'vet', true)->>'verified')::boolean as approved \gset
select pg_temp.check_that(:'approved'::boolean, 'admin approval updates vet flag');
select public.approve_vet(:'second_vet', true) is not null as second_approved \gset
select pg_temp.check_that(
  (select status='approved' and reviewed_by=:'admin' from public.vet_license_requests where vet_id=:'vet'),
  'approval records administrator identity');

set request.jwt.claim.sub = :'owner';
select (current_date + 1 + time '10:00') at time zone 'UTC' as slot \gset
select pg_temp.reject(format('select public.book_appointment(%L,%L,%L,''video'',''Symptoms'')',
  :'vet', :'other_pet', :'slot'), '42501', 'cannot book another owner''s pet');
select pg_temp.reject(format('select public.book_appointment(%L,%L,now(),''video'',''Symptoms'')',
  :'vet', :'pet'), '22008', '15-minute lower bound');
select pg_temp.reject(format('select public.book_appointment(%L,%L,current_date+interval ''40 days'',''video'',''Symptoms'')',
  :'vet', :'pet'), '22008', 'upper booking bound');
select pg_temp.reject(format('select public.book_appointment(%L,%L,%L::timestamptz+interval ''1 minute'',''video'',''Symptoms'')',
  :'vet', :'pet', :'slot'), '22008', 'must select a published slot start');
select pg_temp.check_that(exists (
  select from jsonb_array_elements(public.get_vet_schedule(:'vet', 4)) days
  cross join lateral jsonb_array_elements(days->'slots') slots
  where (slots->>'startTime')::timestamptz = :'slot'::timestamptz
), 'schedule advertises the same slot the booking RPC accepts');
select public.book_appointment(:'vet', :'pet', :'slot', 'video', 'Booking fixture')->>'appointment_id' as appt \gset
select pg_temp.check_that(exists (
  select from public.appointments where id=:'appt' and ends_at-starts_at=interval '30 minutes'
), 'booking derives duration from vet profile');
select pg_temp.check_that(exists (
  select from public.notifications where type='appointment_confirmed' and body like '%Assigned Vet%'
), 'booking trigger enqueues notification using veterinarian name');
select pg_temp.reject(format('select public.book_appointment(%L,%L,%L::timestamptz+interval ''15 minutes'',''video'',''Symptoms'')',
  :'vet', :'pet', :'slot'), '23505', 'a different published start cannot overlap');
select pg_temp.reject(format('select public.complete_appointment(%L)', :'appt'),
  '42501', 'pet owner cannot complete a visit');

set request.jwt.claim.sub = :'stranger';
select pg_temp.check_that(not exists (select from public.appointments where id=:'appt'), 'unrelated user cannot read appointment');
select pg_temp.reject(format('select public.cancel_appointment(%L)', :'appt'), '42501', 'unrelated user cannot cancel');

set request.jwt.claim.sub = :'vet_user';
select pg_temp.check_that(public.notify_doctor_entered_consultation(:'appt'), 'assigned vet can enqueue doctor-entry notification');
select pg_temp.check_that(not public.notify_doctor_entered_consultation(:'appt'), 'doctor-entry enqueue is idempotent');
select public.get_or_create_appointment_conversation(:'appt')->>'id' as conversation \gset
select pg_temp.check_that((public.send_direct_message(:'conversation', 'Follow-up message')).body = 'Follow-up message',
  'notification-enabled message RPC works with the actual message schema');
select pg_temp.check_that(public.complete_appointment(:'appt')->>'status'='completed', 'assigned approved vet completes visit');
select pg_temp.check_that((public.create_prescription(:'appt', 'Fixture', null, 0,
  '[{"medication_name":"Fixture","dosage":"Fixture","frequency":"Fixture","duration":"Fixture"}]'::jsonb))->>'prescription_id' is not null,
  'assigned approved vet can issue a prescription');

set request.jwt.claim.sub = :'second_vet_user';
select pg_temp.reject(format('select public.create_prescription(%L,%L,null,0,%L::jsonb)', :'appt', 'Fixture', '[]'),
  '42501', 'unrelated approved vet cannot prescribe for this appointment');

reset role;
insert into public.appointments (id, vet_id, pet_parent_id, pet_id, starts_at, ends_at)
values (:'reminder', :'vet', :'owner', :'pet', now()+interval '15 minutes', now()+interval '45 minutes');
set role service_role;
set request.jwt.claim.sub = '';
select pg_temp.check_that(public.process_appointment_reminders() = 2, 'worker enqueues exactly two reminders and receives only a count');
select pg_temp.check_that(public.process_appointment_reminders() = 0, 'worker cannot enqueue duplicate reminders');
select pg_temp.check_that((select count(*)=2 from public.notifications where type='appointment_reminder'),
  'expected reminder rows exist');
select pg_temp.check_that((select count(*) > 0 from public.claim_pending_push_notifications(100)),
  'worker can lease push records');
select pg_temp.check_that((select count(*) = 0 from public.claim_pending_push_notifications(100)),
  'leased records cannot be claimed twice');
select pg_temp.reject(format('select public.approve_vet(%L,true)', :'vet'),
  '42501', 'worker cannot approve veterinarians');
reset role;
