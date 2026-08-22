create extension if not exists pgcrypto;
create type ingestion_status as enum ('scheduled','awaiting_data','provisional','telemetry_processing','validating','complete');
create type provider_name as enum ('jolpica','openf1','fastf1','rss');

create table seasons(id uuid primary key default gen_random_uuid(),year int unique not null,current boolean default false);
create table circuits(id uuid primary key default gen_random_uuid(),slug text unique not null,name text not null,country text,locality text,length_km numeric,corners int,metadata jsonb default '{}');
create table rounds(id uuid primary key default gen_random_uuid(),season_id uuid not null references seasons on delete cascade,round int not null,circuit_id uuid references circuits,name text not null,race_start timestamptz,status ingestion_status default 'scheduled',updated_at timestamptz default now(),unique(season_id,round));
create table sessions(id uuid primary key default gen_random_uuid(),round_id uuid not null references rounds on delete cascade,code text not null,name text not null,start_time timestamptz,status ingestion_status default 'scheduled',completed_at timestamptz,unique(round_id,code));
create table teams(id uuid primary key default gen_random_uuid(),ref text unique,name text not null,nationality text);
create table drivers(id uuid primary key default gen_random_uuid(),ref text unique,code text,given_name text,family_name text,nationality text);
create table session_entries(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,driver_id uuid references drivers,team_id uuid references teams,grid int,finish int,status text,points numeric,unique(session_id,driver_id));
create table laps(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,driver_id uuid not null references drivers,lap_number int not null,lap_time_ms int,sectors_ms int[],compound text,tyre_life int,is_pit_in boolean default false,is_pit_out boolean default false,track_status text,validated boolean default false,unique(session_id,driver_id,lap_number));
create table stints(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,driver_id uuid references drivers,stint_number int,compound text,lap_start int,lap_end int,tyre_age_start int,unique(session_id,driver_id,stint_number));
create table pit_stops(id uuid primary key default gen_random_uuid(),session_id uuid not null references sessions on delete cascade,driver_id uuid references drivers,lap int,duration_ms int,provider provider_name,unique(session_id,driver_id,lap,provider));
create table weather_samples(id uuid primary key default gen_random_uuid(),session_id uuid references sessions on delete cascade,sampled_at timestamptz,air_temp numeric,track_temp numeric,humidity numeric,rainfall boolean,wind_speed numeric,unique(session_id,sampled_at));
create table race_control_events(id uuid primary key default gen_random_uuid(),session_id uuid references sessions on delete cascade,occurred_at timestamptz,category text,flag text,lap int,message text,provider provider_name,unique(session_id,occurred_at,category,message));
create table provider_mappings(id uuid primary key default gen_random_uuid(),entity_type text not null,entity_id uuid not null,provider provider_name not null,provider_id text not null,override_data jsonb default '{}',unique(entity_type,provider,provider_id));
create table provider_conflicts(id uuid primary key default gen_random_uuid(),session_id uuid references sessions on delete cascade,field text not null,values jsonb not null,resolution jsonb,status text default 'open',created_at timestamptz default now(),resolved_at timestamptz);
create table metric_snapshots(id uuid primary key default gen_random_uuid(),session_id uuid references sessions on delete cascade,metric_key text not null,version text not null,value jsonb not null,validated boolean default false,source_ids uuid[] default '{}',created_at timestamptz default now(),unique(session_id,metric_key,version));
create table ingestion_runs(id uuid primary key default gen_random_uuid(),provider provider_name not null,season int,round int,session_code text,status ingestion_status not null,attempt int default 1,started_at timestamptz default now(),finished_at timestamptz,error text,stats jsonb default '{}');

create table rss_sources(id uuid primary key default gen_random_uuid(),name text not null,feed_url text unique not null,homepage_url text,terms_url text,enabled boolean default true,last_fetched_at timestamptz);
create table news_items(id uuid primary key default gen_random_uuid(),source_id uuid not null references rss_sources on delete cascade,guid text not null,title text not null,description text,url text not null,published_at timestamptz,round_id uuid references rounds on delete set null,session_id uuid references sessions on delete set null,fetched_at timestamptz default now(),unique(source_id,guid));

create index laps_session_driver_idx on laps(session_id,driver_id);
create index metrics_session_valid_idx on metric_snapshots(session_id,validated);
create index news_published_idx on news_items(published_at desc);
create index runs_lookup_idx on ingestion_runs(season,round,session_code,started_at desc);
