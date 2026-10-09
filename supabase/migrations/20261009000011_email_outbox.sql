-- 11/11: Randevu e-postaları (onay, iptal, değişiklik, 24 saat hatırlatma).
--
-- Akış: appointments tetikleyicisi -> email_outbox kaydı -> Edge Function `send-emails` kuyruğu boşaltır
-- ve Resend'e gönderir. Müşteri sitesi, panel ve elle randevu aynı tetikleyiciden geçtiği için hepsi e-posta üretir.
-- Anahtar (RESEND_API_KEY) tanımlı değilse kayıtlar 'skipped' olur; sonradan anahtar eklenince eski e-postalar
-- toplu gitmez.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('received', 'booked', 'confirmed', 'cancelled', 'rescheduled', 'reminder')),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  to_email text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts int not null default 0,
  send_after timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz,
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);

create index email_outbox_queue_idx on public.email_outbox (send_after) where status in ('pending', 'sending');
create index email_outbox_appointment_idx on public.email_outbox (appointment_id);
-- Aynı randevuya iki hatırlatma gitmesin
create unique index email_outbox_reminder_once on public.email_outbox (appointment_id) where kind = 'reminder';

-- Yalnızca sunucu (service_role) okur ve yazar; tarayıcı istemcileri hiçbir şey göremez.
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Tetikleyici: randevu olaylarını kuyruğa yazar
-- ---------------------------------------------------------------------------
create or replace function private.enqueue_appointment_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_kind text;
  v_payload jsonb := '{}'::jsonb;
begin
  select lower(trim(c.email)) into v_email from public.customers c where c.id = new.customer_id;
  -- E-postası olmayan (telefonla gelen) ve örnek (@randevu.test) müşterilere e-posta gitmez.
  if v_email is null or v_email = '' or v_email like '%@randevu.test' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status = 'confirmed' then v_kind := 'booked';
    elsif new.status = 'pending' then v_kind := 'received';
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' and old.status = 'pending' then
      v_kind := 'confirmed';
    elsif new.status = 'cancelled' and old.status in ('pending', 'confirmed') then
      v_kind := 'cancelled';
      v_payload := jsonb_build_object('cancelled_by', new.cancelled_by);
    end if;
  elsif new.status in ('pending', 'confirmed')
        and (new.starts_at is distinct from old.starts_at or new.resource_id is distinct from old.resource_id) then
    v_kind := 'rescheduled';
    v_payload := jsonb_build_object('previous_starts_at', old.starts_at);
  end if;

  if v_kind is not null then
    insert into public.email_outbox (kind, appointment_id, to_email, payload)
    values (v_kind, new.id, v_email, v_payload);
  end if;
  return new;
end;
$$;

revoke execute on function private.enqueue_appointment_email() from public;

create trigger appointments_enqueue_email
  after insert or update on public.appointments
  for each row execute function private.enqueue_appointment_email();

-- ---------------------------------------------------------------------------
-- Gönderimi hemen başlat (kuyruğa kayıt düşünce Edge Function'ı çağırır).
-- Hata olursa randevu işlemi asla bozulmaz; cron süpürmesi yeniden dener.
-- ---------------------------------------------------------------------------
create or replace function private.kick_email_sender()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  begin
    perform net.http_post(
      url := 'https://lgdqwwhivfviwozhimxa.supabase.co/functions/v1/send-emails',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  exception when others then
    null;
  end;
  return null;
end;
$$;

revoke execute on function private.kick_email_sender() from public;

create trigger email_outbox_kick
  after insert on public.email_outbox
  for each statement execute function private.kick_email_sender();

-- ---------------------------------------------------------------------------
-- Kuyruktan iş alma (Edge Function service_role ile çağırır). Çökmüş işler 5 dakika sonra geri alınır.
-- ---------------------------------------------------------------------------
create or replace function public.claim_pending_emails(p_limit int default 20)
returns setof public.email_outbox
language sql
security definer
set search_path = ''
as $$
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select q.id from public.email_outbox q
      where q.attempts < 5
        and ((q.status = 'pending' and q.send_after <= now())
          or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
      order by q.send_after
      limit greatest(1, least(p_limit, 50))
      for update skip locked)
  returning o.*;
$$;

revoke all on function public.claim_pending_emails(int) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(int) to service_role;

-- ---------------------------------------------------------------------------
-- Zamanlanmış işler
-- ---------------------------------------------------------------------------
-- Her 10 dakikada: 23-24 saat sonraki onaylı randevular için hatırlatma kuyruğa yazılır.
select cron.schedule(
  'email-reminders-enqueue',
  '*/10 * * * *',
  $cron$
    insert into public.email_outbox (kind, appointment_id, to_email)
    select 'reminder', a.id, lower(trim(c.email))
      from public.appointments a
      join public.customers c on c.id = a.customer_id
     where a.status = 'confirmed'
       and a.starts_at >  now() + interval '23 hours'
       and a.starts_at <= now() + interval '24 hours'
       and c.email is not null and trim(c.email) <> ''
       and lower(c.email) not like '%@randevu.test'
    on conflict do nothing
  $cron$
);

-- Her dakika: bekleyen iş varsa gönderici çağrılır (yeniden deneme ve kaçan tetiklemeler için).
select cron.schedule(
  'email-sender-sweep',
  '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://lgdqwwhivfviwozhimxa.supabase.co/functions/v1/send-emails',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    )
    where exists (
      select 1 from public.email_outbox
       where attempts < 5
         and ((status = 'pending' and send_after <= now())
           or (status = 'sending' and claimed_at < now() - interval '5 minutes'))
    )
  $cron$
);
