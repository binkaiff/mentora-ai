-- Enable pg_cron in Supabase Dashboard > Database > Extensions first.
-- Run once. This generates IN-APP reminders, not email or background push.
select cron.schedule('mentora-assignment-reminders','*/15 * * * *',
  'select public.mentora_create_reminders()');
-- Inspect jobs: select * from cron.job;
-- If changing schedule, unschedule first: select cron.unschedule('mentora-assignment-reminders');
