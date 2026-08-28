alter table public.resumes
  add column if not exists processing_status text not null default 'uploaded',
  add column if not exists processing_error text,
  add column if not exists parsed_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.resumes'::regclass
      and conname = 'resumes_processing_status_check'
  ) then
    alter table public.resumes add constraint resumes_processing_status_check
      check (processing_status in (
        'uploaded', 'text_extracted', 'parsing', 'parsed', 'parsing_failed'
      ));
  end if;
end
$$;

update public.resumes
set processing_status = 'text_extracted'
where extracted_text is not null
  and processing_status = 'uploaded';
