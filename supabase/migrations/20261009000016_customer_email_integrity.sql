-- 16/16: Hesaplı müşterinin e-postası her zaman hesabın (doğrulanmış) e-postasıdır.
--
-- Açık: create_appointment RPC'si ve customers_update politikası, müşterinin e-postasını istemciden gelen
-- değerle yazıyordu. Web API'si (src/app/api/appointments) oturum e-postasını zorluyordu ama RPC PostgREST
-- üzerinden doğrudan çağrılabildiği için geçerli hesabı olan herkes başkasının adresine "randevun onaylandı"
-- e-postası tetikleyebiliyordu (e-posta bombalama / taciz). Düzeltme köktedir: hangi yoldan gelirse gelsin
-- (RPC, doğrudan güncelleme) user_id dolu satırın e-postası auth.users'tan yazılır.
-- Hesapsız (user_id boş) müşteriler panelden elle girilir; onlara dokunulmaz.

create function private.force_customer_auth_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    select lower(trim(u.email)) into new.email from auth.users u where u.id = new.user_id;
  end if;
  return new;
end;
$$;

revoke execute on function private.force_customer_auth_email() from public;

create trigger customers_force_auth_email
  before insert or update of email, user_id on public.customers
  for each row execute function private.force_customer_auth_email();

-- Mevcut satırları düzelt
update public.customers c
   set email = lower(trim(u.email))
  from auth.users u
 where u.id = c.user_id and c.email is distinct from lower(trim(u.email));
