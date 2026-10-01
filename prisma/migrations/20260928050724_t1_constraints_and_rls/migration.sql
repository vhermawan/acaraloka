alter table "public"."ticket_types"
  add constraint "ticket_types_reserved_count_within_quota"
  check ("reserved_count" >= 0 and "reserved_count" <= "quota");

create unique index "registrations_active_per_event_user"
  on "public"."registrations" ("event_id", "user_id")
  where "status" = 'CONFIRMED';

do $$
declare
  t record;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'public' and tablename <> '_prisma_migrations'
  loop
    execute format('alter table "public".%I enable row level security', t.tablename);
  end loop;
end $$;
