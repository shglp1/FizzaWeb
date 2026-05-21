create extension if not exists "uuid-ossp";
create type user_role as enum ('parent','rider','driver','admin');
create type subscription_status as enum ('pending','active','expired','cancelled');
create type trip_status as enum ('scheduled','driver_assigned','on_the_way','picked_up','completed','cancelled');
create type payment_status as enum ('pending','paid','failed','refunded');
create type safety_status as enum ('pending','approved','resolved','rejected');

create table profiles(id uuid primary key references auth.users(id) on delete cascade, role user_role not null default 'parent', full_name text not null, phone text, avatar_url text, created_at timestamptz default now(), updated_at timestamptz default now());
create table riders(id uuid primary key default uuid_generate_v4(), parent_id uuid not null references profiles(id), name text not null, relationship text not null, school text, grade text, phone text, special_needs boolean default false, notes text, is_active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table subscription_packages(id uuid primary key default uuid_generate_v4(), name text not null, billing_cycle text not null, price_sar numeric(10,2) not null check(price_sar>=0), description text, is_active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table add_ons(id uuid primary key default uuid_generate_v4(), name text not null, price_sar numeric(10,2) not null check(price_sar>=0), is_active boolean default true, created_at timestamptz default now(), updated_at timestamptz default now());
create table user_subscriptions(id uuid primary key default uuid_generate_v4(), user_id uuid not null references profiles(id), rider_id uuid references riders(id), package_id uuid references subscription_packages(id), subscription_type text not null check(subscription_type in ('school','university')), pickup_location text not null, dropoff_location text not null, pickup_time time not null, return_time time not null, female_driver_preference boolean default false, auto_renewal boolean default true, payment_status payment_status default 'pending', status subscription_status default 'pending', starts_on date, ends_on date, created_at timestamptz default now(), updated_at timestamptz default now());
create table subscription_schedules(id uuid primary key default uuid_generate_v4(), subscription_id uuid not null references user_subscriptions(id) on delete cascade, weekday smallint not null check(weekday between 0 and 6), is_off_day boolean default false, created_at timestamptz default now());
create table vehicles(id uuid primary key default uuid_generate_v4(), model text not null, plate_number text not null unique, color text, capacity int, created_at timestamptz default now(), updated_at timestamptz default now());
create table drivers(id uuid primary key default uuid_generate_v4(), profile_id uuid references profiles(id), vehicle_id uuid references vehicles(id), availability boolean default true, rating numeric(2,1) default 5.0, is_suspended boolean default false, suspension_reason text, created_at timestamptz default now(), updated_at timestamptz default now());
create table trips(id uuid primary key default uuid_generate_v4(), subscription_id uuid references user_subscriptions(id), rider_id uuid references riders(id), driver_id uuid references drivers(id), vehicle_id uuid references vehicles(id), scheduled_date date not null, scheduled_pickup_time timestamptz, scheduled_dropoff_time timestamptz, actual_pickup_time timestamptz, actual_dropoff_time timestamptz, pickup_location text not null, dropoff_location text not null, status trip_status default 'scheduled', cancelled_by uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table driver_locations(id bigserial primary key, driver_id uuid not null references drivers(id), trip_id uuid references trips(id), lat double precision not null, lng double precision not null, recorded_at timestamptz default now());
create table wallets(id uuid primary key default uuid_generate_v4(), user_id uuid not null unique references profiles(id), balance_sar numeric(10,2) not null default 0 check(balance_sar>=0), created_at timestamptz default now(), updated_at timestamptz default now());
create table wallet_transactions(id uuid primary key default uuid_generate_v4(), wallet_id uuid not null references wallets(id), trip_id uuid references trips(id), amount_sar numeric(10,2) not null, tx_type text not null check(tx_type in ('top_up','debit','refund','adjustment')), created_at timestamptz default now());
create table payments(id uuid primary key default uuid_generate_v4(), user_id uuid not null references profiles(id), subscription_id uuid references user_subscriptions(id), amount_sar numeric(10,2) not null, status payment_status default 'pending', gateway text default 'myfatoorah', external_ref text, created_at timestamptz default now());
create table loyalty_accounts(id uuid primary key default uuid_generate_v4(), user_id uuid unique references profiles(id), points_balance int default 0 check(points_balance>=0), created_at timestamptz default now(), updated_at timestamptz default now());
create table loyalty_transactions(id uuid primary key default uuid_generate_v4(), account_id uuid references loyalty_accounts(id), points int not null, reason text, created_at timestamptz default now());
create table safety_reports(id uuid primary key default uuid_generate_v4(), user_id uuid references profiles(id), trip_id uuid references trips(id), category text not null, description text not null, status safety_status default 'pending', reviewed_by uuid references profiles(id), created_at timestamptz default now(), updated_at timestamptz default now());
create table safety_report_attachments(id uuid primary key default uuid_generate_v4(), report_id uuid references safety_reports(id) on delete cascade, file_path text not null, created_at timestamptz default now());
create table notifications(id uuid primary key default uuid_generate_v4(), user_id uuid references profiles(id), title text not null, message text not null, type text not null, is_read boolean default false, created_at timestamptz default now());
create table system_configurations(key text primary key, value jsonb not null, updated_at timestamptz default now());
create table trip_generation_logs(id uuid primary key default uuid_generate_v4(), run_date date not null, generated_count int not null default 0, failed_count int not null default 0, notes text, created_at timestamptz default now());

-- indexes
create index idx_riders_parent_id on riders(parent_id);
create index idx_riders_created_at on riders(created_at desc);
create index idx_user_subscriptions_user_id on user_subscriptions(user_id);
create index idx_user_subscriptions_rider_id on user_subscriptions(rider_id);
create index idx_user_subscriptions_status on user_subscriptions(status);
create index idx_trips_subscription_id on trips(subscription_id);
create index idx_trips_rider_id on trips(rider_id);
create index idx_trips_driver_id on trips(driver_id);
create index idx_trips_status on trips(status);
create index idx_trips_scheduled_pickup on trips(scheduled_pickup_time);
create index idx_trips_created_at on trips(created_at desc);
create index idx_driver_locations_driver_trip_recorded on driver_locations(driver_id, trip_id, recorded_at desc);
create index idx_wallets_user_id on wallets(user_id);
create index idx_wallet_tx_trip_id on wallet_transactions(trip_id);
create index idx_wallet_tx_created_at on wallet_transactions(created_at desc);
create index idx_payments_user_id on payments(user_id);
create index idx_payments_subscription_id on payments(subscription_id);
create index idx_payments_status on payments(status);
create index idx_notifications_user_read on notifications(user_id, is_read);
create index idx_notifications_created_at on notifications(created_at desc);
create index idx_safety_reports_user_id on safety_reports(user_id);
create index idx_safety_reports_trip_id on safety_reports(trip_id);
create index idx_safety_reports_status on safety_reports(status);

alter table profiles enable row level security; alter table riders enable row level security; alter table user_subscriptions enable row level security; alter table trips enable row level security; alter table wallets enable row level security; alter table notifications enable row level security; alter table safety_reports enable row level security; alter table payments enable row level security;

create policy "profiles self read" on profiles for select using (auth.uid() = id);
create policy "profiles self update" on profiles for update using (auth.uid() = id);
create policy "profiles admin read" on profiles for select using (exists (select 1 from profiles p where p.id = auth.uid() and p.role='admin'));

create policy "riders parent crud" on riders for all using (auth.uid() = parent_id) with check (auth.uid() = parent_id);
create policy "subscriptions owner crud" on user_subscriptions for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "trips owner read" on trips for select using (exists(select 1 from riders r where r.id = trips.rider_id and r.parent_id = auth.uid()));
create policy "trips admin read" on trips for select using (exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));
create policy "wallet owner" on wallets for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "notifications owner" on notifications for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "safety owner crud" on safety_reports for all using (auth.uid()=user_id) with check (auth.uid()=user_id);
create policy "safety admin review" on safety_reports for update using (exists(select 1 from profiles p where p.id=auth.uid() and p.role='admin'));
create policy "payments owner read" on payments for select using (auth.uid()=user_id);

insert into subscription_packages(name,billing_cycle,price_sar,description) values ('Monthly','monthly',850,'School days round trips'),('Quarterly','quarterly',2400,'Best for single semester'),('Annual','annual',9200,'Full academic year');
insert into add_ons(name,price_sar) values ('Extra Stop',120),('Late Pickup Buffer',90),('Priority Support',60);
