-- 21/21: Bakım borcu temizliği (kod incelemesi).
-- (1) businesses.is_demo: paylaşılan demo işletmelerinin kimliği artık tek bir sütun. Koruma tetikleyicisi,
--     yayın engeli ve temizlik cron'ları slug listesi yerine bunu okur. Yeni demo işletmesi = tek UPDATE.
--     (Örnek veri tohumu hâlâ slug'a göre: içerik işletmeye özel olduğu için doğru yer orası.)
--     Sütun, authenticated rolünün ekleme/güncelleme sütun listesinde YOK; kullanıcı kendi işletmesini demo yapamaz.
-- (2) E-posta deneme sınırı tek yerde: Edge Function (MAX_ATTEMPTS) onu claim fonksiyonuna parametre verir.
--     Veritabanındaki sabit 5'ler kalktı.

alter table public.businesses add column is_demo boolean not null default false;
update public.businesses set is_demo = true where slug in ('demo-berber', 'demo-guzellik', 'demo-oto-yikama');

create or replace function private.protect_demo_rows()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_demo boolean;
begin
  if coalesce(current_setting('app.demo_reset', true), '') = 'on' then
    return old;
  end if;
  if tg_table_name = 'businesses' then
    v_demo := old.is_demo;
  elsif tg_table_name in ('services', 'resources') then
    select b.is_demo into v_demo from public.businesses b where b.id = old.business_id;
  elsif tg_table_name = 'service_variants' then
    select b.is_demo into v_demo
      from public.services s join public.businesses b on b.id = s.business_id
     where s.id = old.service_id;
  end if;
  if coalesce(v_demo, false) then
    raise exception 'demo_protected';
  end if;
  return old;
end;
$$;

create or replace function private.block_demo_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.published
     and not new.is_demo
     and exists (
       select 1 from public.business_members m
         join auth.users u on u.id = m.user_id
        where m.business_id = new.id and u.email = 'demo-isletme@randevu.test') then
    raise exception 'demo_publish_blocked';
  end if;
  return new;
end;
$$;

select cron.schedule(
  'demo-extra-businesses-purge',
  '*/15 * * * *',
  $cron$
    delete from public.businesses b
     using public.business_members m, auth.users u
     where m.business_id = b.id and u.id = m.user_id and u.email = 'demo-isletme@randevu.test'
       and not b.is_demo
       and b.created_at < now() - interval '30 minutes'
  $cron$
);

select cron.schedule(
  'demo-real-user-purge',
  '7 * * * *',
  $cron$
    delete from public.appointments a
     using public.customers c, public.businesses b
     where a.customer_id = c.id and b.id = a.business_id
       and b.is_demo
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and a.created_at < now() - interval '24 hours';
    delete from public.customers c
     using public.businesses b
     where b.id = c.business_id
       and b.is_demo
       and c.user_id is not null and coalesce(c.email, '') not like '%@randevu.test'
       and c.created_at < now() - interval '24 hours'
       and not exists (select 1 from public.appointments a where a.customer_id = c.id)
  $cron$
);

-- E-posta kuyruğu: deneme sınırı çağıranın (Edge Function) parametresi.
drop function public.claim_pending_emails(int);
create function public.claim_pending_emails(p_limit int, p_max_attempts int)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Sınırı aşıp takılı kalan 'sending' satırları kapanır (yeniden alınıp sonsuz döngüye girmesin)
  update public.email_outbox
     set status = 'failed', error = coalesce(error, 'stuck_after_max_attempts')
   where status = 'sending' and attempts >= p_max_attempts and claimed_at < now() - interval '5 minutes';

  return query
  update public.email_outbox o
     set status = 'sending', attempts = o.attempts + 1, claimed_at = now()
   where o.id in (
     select q.id from public.email_outbox q
      where q.attempts < p_max_attempts
        and ((q.status = 'pending' and q.send_after <= now())
          or (q.status = 'sending' and q.claimed_at < now() - interval '5 minutes'))
      order by q.send_after
      limit greatest(1, least(p_limit, 50))
      for update skip locked)
  returning o.*;
end;
$$;

revoke all on function public.claim_pending_emails(int, int) from public, anon, authenticated;
grant execute on function public.claim_pending_emails(int, int) to service_role;

-- Süpürme: bekleyen ya da takılı iş varsa gönderici çağrılır (sınır kararı göndericide).
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
       where (status = 'pending' and send_after <= now())
          or (status = 'sending' and claimed_at < now() - interval '5 minutes')
    )
  $cron$
);

-- Takılı satırları artık claim fonksiyonu kapatıyor; bakım işi yalnızca eski kayıtları temizler.
select cron.schedule(
  'email-outbox-maintenance',
  '23 * * * *',
  $cron$
    delete from public.email_outbox
     where status in ('sent', 'skipped', 'failed') and created_at < now() - interval '30 days'
  $cron$
);
