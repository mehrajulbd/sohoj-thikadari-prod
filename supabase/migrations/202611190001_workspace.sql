-- Apply to a fresh Supabase project. All writes pass through authorized transactional RPCs.
create table public.organizations (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id), name text not null,
 created_at timestamptz not null default now(), fiscal_month int not null default 7 check(fiscal_month between 1 and 12)
);
create table public.memberships (
 user_id uuid primary key references auth.users(id), org_id uuid not null references public.organizations(id),
 role text not null check(role in ('owner','staff')),staff_id uuid,active boolean not null default true,
 name text not null default '',email text not null
);
create unique index one_login_per_staff on public.memberships(staff_id) where staff_id is not null;
create table public.login_directory (
 user_id uuid primary key references auth.users(id),email text not null,phone text unique
);
create table public.login_attempts (bucket text primary key,attempts int not null default 0,expires_at timestamptz not null);
create function public.my_org() returns uuid language sql stable security definer set search_path=public as $$
 select org_id from memberships where user_id=auth.uid() and active
$$;
create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select coalesce((select role='owner' from memberships where user_id=auth.uid() and active),false)
$$;
create function public.my_staff() returns uuid language sql stable security definer set search_path=public as $$
 select staff_id from memberships where user_id=auth.uid() and active
$$;

do $$ declare entity text;begin
 foreach entity in array array['firms','staff','expense_heads','programs','dispatches','expenses','money_movements','bills','settlements','supplementary_receipts'] loop
 execute format('create table public.%I (id uuid primary key,org_id uuid not null references public.organizations(id),data jsonb not null default ''{}''::jsonb check(jsonb_typeof(data)=''object''),version integer not null default 1,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),updated_at timestamptz not null default now())',entity);
 execute format('create index on public.%I(org_id,created_at desc)',entity);
 execute format('alter table public.%I enable row level security',entity);
 execute format('grant select on public.%I to authenticated',entity);
 execute format('revoke insert,update,delete on public.%I from anon,authenticated',entity);
 end loop;
end $$;
alter table public.programs add column firm_id uuid generated always as ((data->>'firm_id')::uuid) stored references public.firms(id);
alter table public.dispatches add column program_id uuid generated always as ((data->>'program_id')::uuid) stored references public.programs(id);
alter table public.expenses add column program_id uuid generated always as (nullif(data->>'program_id','')::uuid) stored references public.programs(id);
alter table public.expenses add column firm_id uuid generated always as (nullif(data->>'firm_id','')::uuid) stored references public.firms(id);
alter table public.expenses add column staff_id uuid generated always as (nullif(data->>'staff_id','')::uuid) stored references public.staff(id);
alter table public.expenses add column head_id uuid generated always as ((data->>'head_id')::uuid) stored references public.expense_heads(id);
alter table public.bills add column firm_id uuid generated always as ((data->>'firm_id')::uuid) stored references public.firms(id);
alter table public.settlements add column bill_id uuid generated always as ((data->>'bill_id')::uuid) stored references public.bills(id);
create unique index one_settlement_per_bill on public.settlements(bill_id);
create index on public.expenses(org_id,staff_id);
create index on public.dispatches(org_id,program_id);
create index on public.programs(org_id,firm_id);
create table public.bill_allocations (program_id uuid primary key references programs(id),bill_id uuid not null references bills(id),org_id uuid not null references organizations(id));
create table public.audit_events (
 id bigint generated always as identity primary key,org_id uuid not null references organizations(id),actor_id uuid not null references auth.users(id),
 entity text not null,record_id uuid not null,action text not null,reason text not null default '',old_data jsonb,new_data jsonb,created_at timestamptz not null default now()
);
create table public.sync_operations (
 id uuid primary key,user_id uuid not null references auth.users(id),org_id uuid not null references organizations(id),entity text not null,record_id uuid not null,result jsonb not null,created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.login_directory enable row level security;
alter table public.login_attempts enable row level security;
alter table public.bill_allocations enable row level security;
alter table public.audit_events enable row level security;
alter table public.sync_operations enable row level security;
create policy org_read on organizations for select to authenticated using(id=my_org());
create policy membership_read on memberships for select to authenticated using(user_id=auth.uid() or (org_id=my_org() and is_owner()));
create policy allocation_read on bill_allocations for select to authenticated using(org_id=my_org() and is_owner());
create policy audit_read on audit_events for select to authenticated using(org_id=my_org() and is_owner());
create policy sync_read on sync_operations for select to authenticated using(user_id=auth.uid() and org_id=my_org());
grant select on organizations,memberships,audit_events,bill_allocations,sync_operations to authenticated;
revoke all on login_directory,login_attempts from anon,authenticated;

do $$ declare entity text;begin
 foreach entity in array array['firms','staff','expense_heads','programs','dispatches'] loop
 execute format('create policy org_read on public.%I for select to authenticated using(org_id=public.my_org())',entity);
 end loop;
 foreach entity in array array['bills','settlements','supplementary_receipts'] loop
 execute format('create policy owner_read on public.%I for select to authenticated using(org_id=public.my_org() and public.is_owner())',entity);
 end loop;
end $$;
create policy expense_read on expenses for select to authenticated using(org_id=my_org() and (is_owner() or staff_id=my_staff()));
create policy movement_read on money_movements for select to authenticated using(org_id=my_org() and (is_owner() or data->>'staff_id'=my_staff()::text or data->>'to_staff_id'=my_staff()::text));

create function public.get_workspace() returns jsonb language plpgsql security definer set search_path=public as $$
declare m memberships;u auth.users;o uuid;begin
 if auth.uid() is null then raise exception 'Sign in first';end if;
 perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
 select * into u from auth.users where id=auth.uid();
 select * into m from memberships where user_id=auth.uid();
 if found and not m.active then raise exception 'Your account is inactive. Contact the owner.';end if;
 if m.user_id is null then
  if u.raw_user_meta_data->>'invited_staff'='true' then raise exception 'Ask the owner to activate your invitation';end if;
  insert into organizations(owner_id,name) values(auth.uid(),coalesce(u.raw_user_meta_data->>'name',split_part(u.email,'@',1))) returning id into o;
  insert into memberships(user_id,org_id,role,name,email) values(auth.uid(),o,'owner',coalesce(u.raw_user_meta_data->>'name','Owner'),u.email) returning * into m;
  insert into expense_heads(id,org_id,data,created_by) select gen_random_uuid(),o,jsonb_build_object('name',n,'active',true),auth.uid() from unnest(array['ট্রাক ভাড়া','যাতায়াত','খাবার','লোড / আনলোড','অফিস খরচ']) n;
 end if;
 insert into login_directory(user_id,email,phone) values(u.id,u.email,nullif(regexp_replace(coalesce(u.raw_user_meta_data->>'phone',''),'[^0-9+]','','g'),'')) on conflict(user_id) do update set email=excluded.email;
 return jsonb_build_object('org_id',m.org_id,'user_id',m.user_id,'role',m.role,'staff_id',m.staff_id,'name',m.name,'email',m.email,'fiscal_month',(select fiscal_month from organizations where id=m.org_id));
end $$;

-- Server-only durable rate limit. Authentication API hashes the IP/identifier bucket.
create function public.consume_login_attempt(key text) returns boolean language plpgsql security definer set search_path=public as $$
declare n int;begin
 insert into login_attempts(bucket,attempts,expires_at) values(key,1,now()+interval '15 minutes')
 on conflict(bucket) do update set attempts=case when login_attempts.expires_at<now() then 1 else login_attempts.attempts+1 end,expires_at=case when login_attempts.expires_at<now() then now()+interval '15 minutes' else login_attempts.expires_at end returning attempts into n;
 delete from login_attempts where expires_at<now()-interval '1 day';return n<=12;
end $$;
revoke all on function public.consume_login_attempt(text) from public,anon,authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;

create function public.require_link(entity text,identifier text,organization uuid) returns void language plpgsql security definer set search_path=public as $$
declare ok boolean;begin
 if identifier is null or identifier='' then raise exception 'A related entry is missing';end if;
 if entity not in ('firms','programs','staff','expense_heads','bills') then raise exception 'Invalid relation';end if;
 execute format('select exists(select 1 from %I where id=$1::uuid and org_id=$2)',entity) into ok using identifier,organization;
 if not ok then raise exception 'Related entry is not in your organization';end if;
end $$;
revoke all on function public.require_link(text,text,uuid) from public,anon,authenticated;

-- Allocate rounded totals in cents without ever producing a negative remainder line.
create function public.allocate_money(items jsonb,total numeric) returns jsonb language plpgsql immutable set search_path=public as $$
declare denom numeric;used numeric:=0;part numeric;remaining numeric;item jsonb;intermediate jsonb:='[]';result jsonb:='[]';begin
 select coalesce(sum((value->>'weight')::numeric),0) into denom from jsonb_array_elements(items);
 if total<0 or exists(select 1 from jsonb_array_elements(items) where (value->>'weight')::numeric<0) then raise exception 'Negative allocation';end if;
 if denom=0 and total<>0 then raise exception 'Cannot allocate to zero weights';end if;
 for item in select value from jsonb_array_elements(items) loop
  part:=case when denom=0 then 0 else trunc(total*(item->>'weight')::numeric/denom,2) end;used:=used+part;
  intermediate:=intermediate||jsonb_build_array(item||jsonb_build_object('amount',part));
 end loop;
 remaining:=round(total-used,2);
 for item in select value from jsonb_array_elements(intermediate) loop
  part:=(item->>'amount')::numeric;
  if remaining>=0.01 and (item->>'weight')::numeric>0 then part:=part+0.01;remaining:=remaining-0.01;end if;
  result:=result||jsonb_build_array(jsonb_build_object('program_id',item->>'program_id','amount',part));
 end loop;
 return result;
end $$;
revoke all on function public.allocate_money(jsonb,numeric) from public,anon,authenticated;

create function public.apply_operation(operation_id uuid,entity text,record_id uuid,payload jsonb,expected_version integer default 0,correction_reason text default '') returns jsonb
language plpgsql security definer set search_path=public as $$
declare
 m memberships;oldrow jsonb;result jsonb;prior sync_operations;d jsonb:=payload;closed boolean;pid text;pr jsonb;ds jsonb;line jsonb;lines jsonb:='[]';rates jsonb;
 amount numeric:=0;program_amount numeric;rate numeric;base numeric;total_base numeric:=0;tax numeric:=0;tax_used numeric:=0;tax_part numeric;
 allocations jsonb:='[]';adjustments jsonb;adj jsonb;billdata jsonb;program_ids jsonb;idx int:=0;cnt int;net numeric;ref text;v int;
 allowed text[];k text;
begin
 select * into m from memberships where user_id=auth.uid() and active;
 if not found then raise exception 'Your session or membership is inactive';end if;
 if entity not in ('firms','staff','expense_heads','programs','dispatches','expenses','money_movements','bills','settlements','supplementary_receipts') then raise exception 'Unsupported entry';end if;
 select * into prior from sync_operations where id=operation_id;
 if found then
  if prior.user_id<>auth.uid() or prior.entity<>entity or prior.record_id<>record_id then raise exception 'Operation identifier is already used';end if;
  return prior.result;
 end if;
 -- Serialize edits and duplicate retries, including operations from several devices.
 perform pg_advisory_xact_lock(hashtext(operation_id::text));
 select * into prior from sync_operations where id=operation_id;
 if found then
  if prior.user_id<>auth.uid() or prior.entity<>entity or prior.record_id<>record_id then raise exception 'Operation identifier is already used';end if;
  return prior.result;
 end if;
 if m.role<>'owner' and entity not in ('dispatches','expenses','expense_heads') then raise exception 'Only the owner can do this';end if;
 execute format('select to_jsonb(r) from %I r where id=$1 for update',entity) into oldrow using record_id;
 if oldrow is not null and oldrow->>'org_id'<>m.org_id::text then raise exception 'Entry not found';end if;
 if oldrow is not null and (oldrow->>'version')::int<>expected_version then raise exception 'This entry changed on another device. Review the latest version.';end if;
 if oldrow is null and expected_version<>0 then raise exception 'Entry no longer exists';end if;
 if oldrow is not null and length(trim(correction_reason))<2 then raise exception 'Enter a reason for this correction';end if;
 if oldrow is not null and m.role<>'owner' and entity='expense_heads' then raise exception 'Only the owner can change expense heads';end if;
 if oldrow is not null and entity in ('supplementary_receipts','money_movements') then raise exception 'Use a compensating entry; posted money movements and receipts cannot be overwritten';end if;
 allowed:=case entity
 when 'firms' then array['name','proprietor','address','phone','email','reg_no','trade_license','active']
 when 'staff' then array['name','phone','email','active']
 when 'expense_heads' then array['name','active']
 when 'programs' then array['firm_id','number','date','commodity','sending','receiving','quantity','staff_id','closed']
 when 'dispatches' then array['program_id','invoice_no','truck_no','sending_date','sending_bags','sending_net','sending_gross','receiving_date','receiving_bags','receiving_gross_bags','receiving_net','receiving_gross','shortage']
 when 'expenses' then array['scope','firm_id','program_id','head_id','staff_id','date','amount','reason']
 when 'money_movements' then array['type','staff_id','to_staff_id','date','amount','reason']
 when 'bills' then array['firm_id','number','date','recipient','program_ids','rates','status','govt_number','govt_date']
 when 'settlements' then array['bill_id','date','amount','tax_mode','tax_value','adjustments','reason']
 when 'supplementary_receipts' then array['program_id','date','amount','reason','tax_amount'] end;
 for k in select jsonb_object_keys(d) loop if not k=any(allowed) then d:=d-k;end if;end loop;
 -- Reject non-finite or malformed numeric strings even when a client bypasses forms.
 for k in select jsonb_object_keys(d) loop
  if k in ('amount','quantity','sending_bags','sending_net','sending_gross','receiving_bags','receiving_gross_bags','receiving_net','receiving_gross','shortage','tax_value','tax_amount') and d->k<>'null'::jsonb then
   if (d->>k) !~ '^[+-]?[0-9]+([.][0-9]+)?$' then raise exception 'Enter a valid numeric amount or quantity';end if;
  end if;
 end loop;
 if entity in ('firms','staff','expense_heads') then
  if length(trim(coalesce(d->>'name','')))<2 then raise exception 'Enter a name';end if;
  d:=d||jsonb_build_object('active',coalesce((d->>'active')::boolean,true));
  if entity='staff' and oldrow is not null then d:=d||jsonb_build_object('login_user_id',oldrow->'data'->>'login_user_id');update memberships set active=(d->>'active')::boolean,name=d->>'name' where staff_id=record_id and org_id=m.org_id;end if;
 end if;
 if entity='programs' then
  perform require_link('firms',d->>'firm_id',m.org_id);
  if oldrow is not null and oldrow->'data'->>'firm_id'<>d->>'firm_id' and exists(select 1 from bill_allocations where program_id=record_id) then raise exception 'A billed program cannot move to another firm';end if;
  if coalesce(d->>'number','')='' or coalesce(d->>'sending','')='' or coalesce(d->>'receiving','')='' or coalesce(d->>'commodity','')='' or coalesce((d->>'quantity')::numeric,0)<=0 then raise exception 'Complete the program details and positive quantity';end if;
  if d->>'staff_id' is not null and d->>'staff_id'<>'' then perform require_link('staff',d->>'staff_id',m.org_id);end if;
  d:=d||jsonb_build_object('closed',coalesce((oldrow->'data'->>'closed')::boolean,false));
 end if;
 if entity='dispatches' then
  perform require_link('programs',d->>'program_id',m.org_id);
  select data into pr from programs where id=(d->>'program_id')::uuid for update;
  if oldrow is null and exists(select 1 from bill_allocations where program_id=(d->>'program_id')::uuid) then raise exception 'Cancel the unpaid bill before adding another truck. Closed programs permit corrections to existing dispatches only.';end if;
  if m.role<>'owner' and (pr->>'closed')::boolean then raise exception 'Only the owner can correct closed programs';end if;
  if oldrow is not null and oldrow->'data'->>'program_id'<>d->>'program_id' then raise exception 'A dispatch cannot move to another program';end if;
  if coalesce(d->>'invoice_no','')='' or coalesce(d->>'truck_no','')='' then raise exception 'Enter invoice and truck numbers';end if;
  if coalesce((d->>'sending_gross')::numeric,0)<=0 or coalesce((d->>'sending_net')::numeric,0)<=0 or coalesce((d->>'sending_bags')::int,0)<=0 then raise exception 'Enter positive dispatch quantities';end if;
  if (d->>'sending_net')::numeric>(d->>'sending_gross')::numeric then raise exception 'Net weight cannot exceed gross weight';end if;
  if nullif(d->>'receiving_date','') is not null then
   if coalesce((d->>'receiving_gross')::numeric,0)<=0 or coalesce((d->>'receiving_net')::numeric,0)<=0 or coalesce((d->>'receiving_bags')::int,0)<=0 or coalesce((d->>'receiving_gross_bags')::int,0)<=0 then raise exception 'Complete the receiving quantities';end if;
   if (d->>'receiving_net')::numeric>(d->>'receiving_gross')::numeric then raise exception 'Net weight cannot exceed gross weight';end if;
   if (d->>'receiving_date')::date<(d->>'sending_date')::date then raise exception 'Receipt cannot be before dispatch';end if;
  end if;
 end if;
 if entity='expenses' then
  if coalesce(d->>'scope','') not in ('program','firm','organization') then raise exception 'Choose expense scope';end if;
  perform require_link('expense_heads',d->>'head_id',m.org_id);
  if not exists(select 1 from expense_heads where id=(d->>'head_id')::uuid and (data->>'active')::boolean) then raise exception 'Choose an active expense head';end if;
  if nullif(d->>'staff_id','') is not null then perform require_link('staff',d->>'staff_id',m.org_id);end if;
  if m.role<>'owner' and (coalesce(d->>'staff_id','')<>m.staff_id::text or (oldrow is not null and coalesce(oldrow->'data'->>'staff_id','')<>m.staff_id::text)) then raise exception 'Staff can only enter their own expenses';end if;
  if m.role<>'owner' and oldrow is not null and exists(select 1 from programs where id=nullif(oldrow->'data'->>'program_id','')::uuid and coalesce((data->>'closed')::boolean,false)) then raise exception 'Only the owner can change closed programs';end if;
  if d->>'scope'='program' then
   perform require_link('programs',d->>'program_id',m.org_id);
   select data into pr from programs where id=(d->>'program_id')::uuid for update;
   if m.role<>'owner' and (pr->>'closed')::boolean then raise exception 'Only the owner can change closed programs';end if;
   d:=d||jsonb_build_object('firm_id',pr->>'firm_id');
  elsif d->>'scope'='firm' then perform require_link('firms',d->>'firm_id',m.org_id);d:=d-'program_id';
  else d:=d-'program_id'-'firm_id';end if;
 end if;
 if entity='money_movements' then
  perform require_link('staff',d->>'staff_id',m.org_id);
  if coalesce(d->>'type','') not in ('give','return','transfer','opening') then raise exception 'Choose a money movement';end if;
  if d->>'type'='transfer' then
   perform require_link('staff',d->>'to_staff_id',m.org_id);
   if d->>'staff_id'=d->>'to_staff_id' then raise exception 'Choose a different receiving staff member';end if;
  else d:=d-'to_staff_id';end if;
 end if;
 if entity in ('expenses','money_movements','supplementary_receipts') then
  if coalesce((d->>'amount')::numeric,0)=0 or (entity<>'money_movements' and (d->>'amount')::numeric<0) or (entity='money_movements' and d->>'type'<>'opening' and (d->>'amount')::numeric<0) then raise exception 'Enter a positive amount (opening balances can be negative)';end if;
  if length(trim(coalesce(d->>'reason','')))<2 then raise exception 'Enter a reason';end if;
  d:=d||jsonb_build_object('amount',round((d->>'amount')::numeric,2));
 end if;
 if entity='bills' then
  perform require_link('firms',d->>'firm_id',m.org_id);
  if coalesce(d->>'number','')='' or coalesce(d->>'recipient','')='' then raise exception 'Enter bill number and recipient';end if;
  if oldrow->'data'->>'status'='finalized' then
   -- Issued snapshots cannot change. Only government reference fields may be amended.
   d:=oldrow->'data'||jsonb_build_object('govt_number',coalesce(d->>'govt_number',''),'govt_date',coalesce(d->>'govt_date',''));
  elsif d->>'status'='finalized' then
   program_ids:=d->'program_ids';rates:=d->'rates';
   if jsonb_array_length(program_ids)<1 then raise exception 'Choose received programs';end if;
   if (select count(distinct value) from jsonb_array_elements_text(program_ids))<>jsonb_array_length(program_ids) then raise exception 'Duplicate program selected';end if;
   -- Lock in stable order to prevent competing bills from allocating the same program.
   perform 1 from programs where id in(select value::uuid from jsonb_array_elements_text(program_ids)) order by id for update;
   for pid in select value from jsonb_array_elements_text(program_ids) loop
    perform require_link('programs',pid,m.org_id);
    select data into pr from programs where id=pid::uuid;
    if pr->>'firm_id'<>d->>'firm_id' then raise exception 'All programs must belong to the same firm';end if;
    if exists(select 1 from bill_allocations where program_id=pid::uuid) then raise exception 'A selected program is already billed';end if;
    if not exists(select 1 from dispatches where program_id=pid::uuid) or exists(select 1 from dispatches where program_id=pid::uuid and nullif(data->>'receiving_date','') is null) then raise exception 'All dispatches need receiving information';end if;
    select (value->>'rate')::numeric into rate from jsonb_array_elements(rates) where value->>'program_id'=pid;
    if rate is null or rate<=0 or rate::text in ('NaN','Infinity','-Infinity') then raise exception 'Enter a positive per-tonne rate';end if;
    program_amount:=0;
    for ds in select data from dispatches where program_id=pid::uuid order by created_at loop
     base:=(ds->>'receiving_gross')::numeric*rate;program_amount:=program_amount+base;
     lines:=lines||jsonb_build_array(ds||jsonb_build_object('program_id',pid,'program_number',pr->>'number','program_date',pr->>'date','distance',(select coalesce((value->>'distance')::numeric,0) from jsonb_array_elements(rates) where value->>'program_id'=pid),'sending',pr->>'sending','receiving',pr->>'receiving','commodity',pr->>'commodity','rate',rate,'amount',base));
    end loop;
    amount:=amount+program_amount;allocations:=allocations||jsonb_build_array(jsonb_build_object('program_id',pid,'weight',program_amount));
   end loop;
   d:=d||jsonb_build_object('total',round(amount,2),'lines',lines,'program_totals',allocate_money(allocations,round(amount,2)),'firm_snapshot',jsonb_build_array((select data from firms where id=(d->>'firm_id')::uuid)));
  elsif coalesce(d->>'status','')<>'draft' then raise exception 'Invalid bill status';end if;
 end if;
 if entity='settlements' then
  if nullif(d->>'tax_value','') is null or nullif(d->>'amount','') is null then raise exception 'Enter tax and actual receipt amounts';end if;
  perform require_link('bills',d->>'bill_id',m.org_id);
  select data into billdata from bills where id=(d->>'bill_id')::uuid for update;
  if billdata->>'status'<>'finalized' then raise exception 'Finalize the bill first';end if;
  if exists(select 1 from settlements where bill_id=(d->>'bill_id')::uuid and id<>record_id) then raise exception 'Bill already received';end if;
  program_ids:=billdata->'program_ids';adjustments:=coalesce(d->'adjustments','[]'::jsonb);cnt:=jsonb_array_length(program_ids);
  if exists(select 1 from jsonb_array_elements(adjustments) a where not program_ids ? (a->>'program_id')) then raise exception 'Adjustment program is not in this bill';end if;
  if (select count(distinct value->>'program_id') from jsonb_array_elements(adjustments))<>jsonb_array_length(adjustments) then raise exception 'Duplicate adjustments';end if;
  for pid in select value from jsonb_array_elements_text(program_ids) loop
   select (value->>'amount')::numeric into base from jsonb_array_elements(billdata->'program_totals') where value->>'program_id'=pid;
   select value into adj from jsonb_array_elements(adjustments) where value->>'program_id'=pid;
   if coalesce(adj->>'extra','0') !~ '^[+]?[0-9]+([.][0-9]+)?$' or coalesce(adj->>'shortage','0') !~ '^[+]?[0-9]+([.][0-9]+)?$' or coalesce(adj->>'deduction','0') !~ '^[+]?[0-9]+([.][0-9]+)?$' then raise exception 'Enter positive numeric adjustments';end if;
   if coalesce((adj->>'extra')::numeric,0)<0 or coalesce((adj->>'shortage')::numeric,0)<0 or coalesce((adj->>'deduction')::numeric,0)<0 then raise exception 'Use positive adjustment amounts';end if;
   if (coalesce((adj->>'extra')::numeric,0)+coalesce((adj->>'shortage')::numeric,0)+coalesce((adj->>'deduction')::numeric,0))>0 and length(trim(coalesce(adj->>'reason','')))<2 then raise exception 'Enter a reason for program adjustments';end if;
   base:=round(base+coalesce((adj->>'extra')::numeric,0)-coalesce((adj->>'shortage')::numeric,0)-coalesce((adj->>'deduction')::numeric,0),2);
   if base<0 then raise exception 'Deductions exceed program amount';end if;
   total_base:=total_base+base;allocations:=allocations||jsonb_build_array(jsonb_build_object('program_id',pid,'base',base));
  end loop;
  if total_base<=0 then raise exception 'Adjusted amount must be positive';end if;
  if d->>'tax_mode'='percent' then tax:=round(total_base*(d->>'tax_value')::numeric/100,2);
  elsif d->>'tax_mode'='amount' then tax:=round((d->>'tax_value')::numeric,2);
  else raise exception 'Choose percentage or amount tax input';end if;
  if tax<0 or tax>total_base then raise exception 'Tax exceeds adjusted bill amount';end if;
  net:=round(total_base-tax,2);
  if abs(net-(d->>'amount')::numeric)>.001 then raise exception 'Actual receipt must match adjusted amount less tax';end if;
  select jsonb_agg(jsonb_build_object('program_id',value->>'program_id','weight',(value->>'base')::numeric)) into program_ids from jsonb_array_elements(allocations);
  rates:=allocate_money(program_ids,tax);lines:='[]';
  for line in select value from jsonb_array_elements(allocations) loop
   select (value->>'amount')::numeric into tax_part from jsonb_array_elements(rates) where value->>'program_id'=line->>'program_id';
   lines:=lines||jsonb_build_array(line||jsonb_build_object('tax',tax_part,'net',(line->>'base')::numeric-tax_part));
  end loop;
  d:=d||jsonb_build_object('allocations',lines,'tax',tax,'firm_id',billdata->>'firm_id','amount',net);
 end if;
 if entity='supplementary_receipts' then
  perform require_link('programs',d->>'program_id',m.org_id);
  select data into pr from programs where id=(d->>'program_id')::uuid;
  if not coalesce((pr->>'closed')::boolean,false) then raise exception 'Extra receipts are for closed programs';end if;
  if coalesce((d->>'tax_amount')::numeric,0)<0 then raise exception 'Tax cannot be negative';end if;
  d:=d||jsonb_build_object('firm_id',pr->>'firm_id');
 end if;
 -- Validate every business date by casting and rejecting missing required dates.
 if entity in ('programs','expenses','money_movements','bills','settlements','supplementary_receipts') then
  if nullif(d->>'date','') is null then raise exception 'Enter a date';end if;perform (d->>'date')::date;
 elsif entity='dispatches' then if nullif(d->>'sending_date','') is null then raise exception 'Enter dispatch date';end if;perform (d->>'sending_date')::date;end if;
 v:=coalesce((oldrow->>'version')::int,0)+1;
 execute format('insert into %I(id,org_id,data,version,created_by) values($1,$2,$3,$4,$5) on conflict(id) do update set data=excluded.data,version=excluded.version,updated_at=now() returning to_jsonb(%I.*)',entity,entity) into result using record_id,m.org_id,d,v,auth.uid();
 if entity='bills' and d->>'status'='finalized' and coalesce(oldrow->'data'->>'status','')<>'finalized' then
  insert into bill_allocations(program_id,bill_id,org_id) select value::uuid,record_id,m.org_id from jsonb_array_elements_text(d->'program_ids');
 end if;
 if entity='settlements' then
  for pid in select value from jsonb_array_elements_text(billdata->'program_ids') loop
   select data into pr from programs where id=pid::uuid;
   update programs set data=data||'{"closed":true}'::jsonb,version=version+1,updated_at=now() where id=pid::uuid;
   insert into audit_events(org_id,actor_id,entity,record_id,action,reason,old_data,new_data) values(m.org_id,auth.uid(),'programs',pid::uuid,'close','Bill receipt recorded',pr,pr||'{"closed":true}');
  end loop;
 end if;
 insert into audit_events(org_id,actor_id,entity,record_id,action,reason,old_data,new_data) values(m.org_id,auth.uid(),entity,record_id,case when oldrow is null then 'create' else 'correct' end,correction_reason,oldrow->'data',d);
 insert into sync_operations(id,user_id,org_id,entity,record_id,result) values(operation_id,auth.uid(),m.org_id,entity,record_id,result);
 return result;
end $$;
revoke all on function public.my_org(),public.is_owner(),public.my_staff(),public.get_workspace(),public.apply_operation(uuid,text,uuid,jsonb,integer,text) from public,anon;
grant execute on function public.my_org(),public.is_owner(),public.my_staff(),public.get_workspace(),public.apply_operation(uuid,text,uuid,jsonb,integer,text) to authenticated;


-- Cancelling an unpaid issued bill retains its snapshot and makes its whole programs billable again.
create function public.cancel_bill(bill_id uuid,reason text) returns void language plpgsql security definer set search_path=public as $$
declare b bills;begin
 if not is_owner() then raise exception 'Owner access required';end if;
 if length(trim(reason))<2 then raise exception 'Enter a cancellation reason';end if;
 select * into b from bills where id=bill_id and org_id=my_org() for update;
 if not found then raise exception 'Bill not found';end if;
 if exists(select 1 from settlements s where s.bill_id=b.id) then raise exception 'Paid bills cannot be cancelled. Correct the receipt with a reason instead.';end if;
 if b.data->>'status'<>'finalized' then raise exception 'Only issued unpaid bills can be cancelled';end if;
 delete from bill_allocations a where a.bill_id=b.id;
 update bills set data=data||'{"status":"cancelled"}',version=version+1,updated_at=now() where id=b.id;
 insert into audit_events(org_id,actor_id,entity,record_id,action,reason,old_data,new_data) values(b.org_id,auth.uid(),'bills',b.id,'cancel',reason,b.data,b.data||'{"status":"cancelled"}');
end $$;
revoke all on function public.cancel_bill(uuid,text) from public,anon;
grant execute on function public.cancel_bill(uuid,text) to authenticated;

-- Money corrections use a compensating entry and retain the original movement.
alter table public.money_movements add column reverses_id uuid references public.money_movements(id);
create unique index one_reversal_per_movement on public.money_movements(reverses_id) where reverses_id is not null;
create function public.reverse_money(movement_id uuid,reason text,business_date date) returns void language plpgsql security definer set search_path=public as $$
declare r money_movements;new_id uuid:=gen_random_uuid();p jsonb;begin
 if not is_owner() then raise exception 'Owner access required';end if;
 if length(trim(reason))<2 then raise exception 'Enter a correction reason';end if;
 if business_date is null then raise exception 'Enter a date';end if;
 select * into r from money_movements where id=movement_id and org_id=my_org() for update;
 if not found then raise exception 'Movement not found';end if;
 if r.reverses_id is not null or exists(select 1 from money_movements where reverses_id=r.id) then raise exception 'This movement is already a reversal or reversed';end if;
 p:=r.data||jsonb_build_object('date',business_date,'reason',reason,'reverses',r.id);
 if r.data->>'type'='transfer' then p:=p||jsonb_build_object('staff_id',r.data->>'to_staff_id','to_staff_id',r.data->>'staff_id');
 elsif r.data->>'type'='opening' then p:=p||jsonb_build_object('amount',-(r.data->>'amount')::numeric);
 else p:=p||jsonb_build_object('type',case when r.data->>'type'='give' then 'return' else 'give' end);end if;
 insert into money_movements(id,org_id,data,created_by,reverses_id) values(new_id,r.org_id,p,auth.uid(),r.id);
 insert into audit_events(org_id,actor_id,entity,record_id,action,reason,old_data,new_data) values(r.org_id,auth.uid(),'money_movements',new_id,'reverse',reason,r.data,p);
end $$;
revoke all on function public.reverse_money(uuid,text,date) from public,anon;
grant execute on function public.reverse_money(uuid,text,date) to authenticated;
grant all on all tables in schema public to service_role;
grant usage,select on all sequences in schema public to service_role;

create function public.set_fiscal_month(month integer) returns void language plpgsql security definer set search_path=public as $$
declare previous int;begin
 if not is_owner() then raise exception 'Owner access required';end if;
 if month<1 or month>12 then raise exception 'Choose a month from 1 to 12';end if;
 select fiscal_month into previous from organizations where id=my_org();
 update organizations set fiscal_month=month where id=my_org();
 insert into audit_events(org_id,actor_id,entity,record_id,action,reason,old_data,new_data) values(my_org(),auth.uid(),'organizations',my_org(),'settings','Financial year preference',jsonb_build_object('fiscal_month',previous),jsonb_build_object('fiscal_month',month));
end $$;
revoke all on function public.set_fiscal_month(integer) from public,anon;
grant execute on function public.set_fiscal_month(integer) to authenticated;
