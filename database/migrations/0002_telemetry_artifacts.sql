-- FastF1 output metadata. The Parquet/JSON files remain on the shared telemetry volume.
create table if not exists telemetry_artifacts(
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions on delete cascade,
  driver_id uuid references drivers,
  storage_path text not null,
  format text default 'parquet',
  rows_count bigint,
  checksum text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  unique(storage_path)
);

create index if not exists telemetry_artifacts_session_driver_idx on telemetry_artifacts(session_id,driver_id);
