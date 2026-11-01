-- Only Web Push providers may be stored. api/_pushHosts.ts enforces the same list on the server.
-- NOT VALID keeps existing rows; api/push-reminders removes any that do not match.
alter table public.push_subscriptions
  add constraint push_subscriptions_endpoint_host check (
    endpoint ~ '^https://(fcm\.googleapis\.com|android\.googleapis\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com|[a-z0-9.-]+\.push\.services\.mozilla\.com)/'
  ) not valid;
