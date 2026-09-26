-- Review branch only: additive migration; existing observations are not rewritten.
begin;
alter table public.tu_classes add column school_grade text;
alter table public.tu_classes add column school_year text;
alter table public.tu_students add column record_number text;
alter table public.tu_students add column ability_level smallint check (ability_level between 1 and 5);
create unique index tu_students_record_number_unique on public.tu_students (lower(btrim(record_number))) where nullif(btrim(record_number), '') is not null;
alter table public.tu_evaluations add column archived_at timestamptz;
alter table public.tu_evaluations add column school_term smallint check (school_term between 1 and 3);
alter table public.tu_evaluations add column sort_order integer not null default 0;
alter table public.tu_skills add column grading_mode text not null default 'numeric' check (grading_mode in ('numeric', 'letter', 'category', 'rubric'));
alter table public.tu_skills add column criteria text[] not null default array['Respect', 'Esprit sportif', 'Effort'];
alter table public.tu_skills add column max_observations integer check (max_observations > 0);
alter table public.tu_session_events add column grading_snapshot jsonb;
alter table public.tu_session_events add column observer_name text;
alter table public.tu_session_events add column comment text;
alter table public.tu_session_events add column criterion text;
-- Existing records with a known author can display that account's current name.
update public.tu_session_events e set observer_name = coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), nullif(u.raw_user_meta_data->>'name', ''), u.email)
from auth.users u where u.id = e.user_id;
alter table public.tu_teams add column batch_id uuid;
-- Historical teams cannot be reliably assigned to a batch from timestamps alone.
-- Keep them individually selectable; all new sets receive an explicit batch ID.
create index tu_teams_batch_idx on public.tu_teams(batch_id);
create index if not exists tu_events_student_skill_idx on public.tu_session_events(student_id, skill_id);

create table public.tu_student_classes (
  student_id uuid not null references public.tu_students(id) on delete cascade,
  class_id uuid not null references public.tu_classes(id) on delete cascade,
  student_number text,
  primary key (student_id, class_id)
);
create index tu_student_classes_class_idx on public.tu_student_classes(class_id);
insert into public.tu_student_classes(student_id, class_id, student_number)
select id, class_id, student_number from public.tu_students where class_id is not null;
alter table public.tu_student_classes enable row level security;
revoke all on public.tu_student_classes from anon, authenticated;
grant select, insert, update, delete on public.tu_student_classes to authenticated;
-- Membership access follows access to BOTH existing parent records, through their RLS.
create policy membership_parent_access on public.tu_student_classes for all to authenticated
using (exists (select 1 from public.tu_students s where s.id = student_id)
   and exists (select 1 from public.tu_classes c where c.id = class_id))
with check (exists (select 1 from public.tu_students s where s.id = student_id)
   and exists (select 1 from public.tu_classes c where c.id = class_id));

-- Deleting a group must no longer cascade to a permanent student and their history.
do $$ declare fk record; begin
  for fk in select conname from pg_constraint where conrelid = 'public.tu_students'::regclass
    and confrelid = 'public.tu_classes'::regclass and contype = 'f'
  loop execute format('alter table public.tu_students drop constraint %I', fk.conname); end loop;
end $$;
alter table public.tu_students alter column class_id drop not null;
alter table public.tu_students add constraint tu_students_primary_class_fk foreign key (class_id) references public.tu_classes(id) on delete set null;

-- Preserve historical observations when removing a group.
do $$ declare target text; fk record; begin
  foreach target in array array['tu_sessions', 'tu_session_events'] loop
    for fk in select conname from pg_constraint where conrelid = ('public.' || target)::regclass and confrelid = 'public.tu_classes'::regclass and contype = 'f'
    loop execute format('alter table public.%I drop constraint %I', target, fk.conname); end loop;
    execute format('alter table public.%I alter column class_id drop not null', target);
    execute format('alter table public.%I add constraint %I foreign key (class_id) references public.tu_classes(id) on delete set null', target, target || '_class_history_fk');
  end loop;
end $$;

create schema if not exists tu_private;
revoke all on schema tu_private from public;
create function tu_private.student_membership() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.class_id is not null then
    insert into public.tu_student_classes(student_id, class_id, student_number) values (new.id, new.class_id, new.student_number) on conflict do nothing;
  end if;
  return new;
end $$;
create trigger tu_student_membership after insert or update of class_id on public.tu_students
for each row execute function tu_private.student_membership();

create function tu_private.prepare_observation() returns trigger language plpgsql set search_path = '' as $$
declare sk public.tu_skills; observations integer; existing integer; begin
  -- A row lock serializes simultaneous drops for a student, including multiple devices.
  perform 1 from public.tu_students where id = new.student_id for update;
  select * into strict sk from public.tu_skills where id = new.skill_id;
  if not exists (select 1 from public.tu_student_classes where student_id = new.student_id and class_id = new.class_id) then
    raise exception 'Cet élève ne fait pas partie du groupe choisi.';
  end if;
  if exists (select 1 from public.tu_evaluations where id = sk.evaluation_id and archived_at is not null) then
    raise exception 'Cette activité est archivée.';
  end if;
  new.evaluation_id := sk.evaluation_id;
  if auth.uid() is not null then new.user_id := auth.uid(); end if;
  new.observer_name := coalesce(nullif(auth.jwt()->'user_metadata'->>'full_name', ''), nullif(auth.jwt()->'user_metadata'->>'name', ''), auth.jwt()->>'email');
  new.grading_snapshot := jsonb_build_object('mode', sk.grading_mode, 'labels', to_jsonb(sk.scale), 'criteria', to_jsonb(sk.criteria));
  if new.level::text = 'abs' then
    select count(*) into existing from public.tu_session_events
      where student_id = new.student_id and skill_id = new.skill_id and level::text = 'abs'
      and created_at >= date_trunc('day', coalesce(new.created_at, now()) at time zone 'America/Toronto') at time zone 'America/Toronto'
      and created_at < (date_trunc('day', coalesce(new.created_at, now()) at time zone 'America/Toronto') + interval '1 day') at time zone 'America/Toronto';
    if existing > 0 then raise exception 'Absence déjà enregistrée pour cette habileté aujourd’hui.'; end if;
  else
    if sk.grading_mode = 'rubric' and (new.criterion is null or not new.criterion = any(sk.criteria)) then raise exception 'Choisissez un critère de la grille.'; end if;
    if not exists (select 1 from jsonb_array_elements_text(to_jsonb(sk.scale)) label where label = new.level::text) then
      raise exception 'Cette cote ne fait pas partie du barème.';
    end if;
    if sk.max_observations is not null then
      select count(*) into observations from public.tu_session_events where student_id = new.student_id and skill_id = new.skill_id and level::text <> 'abs';
      if observations >= sk.max_observations then raise exception 'Le nombre maximal de traces est atteint.'; end if;
    end if;
  end if;
  return new;
end $$;
create trigger tu_prepare_observation before insert on public.tu_session_events for each row execute function tu_private.prepare_observation();

update public.tu_session_events e set grading_snapshot = jsonb_build_object('mode', 'numeric', 'labels', to_jsonb(s.scale))
from public.tu_skills s where s.id = e.skill_id and e.grading_snapshot is null;
create function tu_private.protect_grading_history() returns trigger language plpgsql set search_path = '' as $$
begin
  if (new.grading_mode <> old.grading_mode or (old.grading_mode = 'letter' and new.scale is distinct from old.scale))
     and exists (select 1 from public.tu_session_events where skill_id = old.id and level::text <> 'abs') then
    raise exception 'Dupliquez cette habileté pour changer son barème sans modifier l’historique.';
  end if;
  return new;
end $$;
create trigger tu_protect_grading_history before update on public.tu_skills for each row execute function tu_private.protect_grading_history();

-- Invoker functions keep existing table RLS in force and make multi-row actions atomic.
create function public.tu_duplicate_record(kind text, source_id uuid, include_members boolean default false)
returns uuid language plpgsql security invoker set search_path = '' as $$
declare copy_id uuid; begin
  if kind = 'class' then
    insert into public.tu_classes(name, school_grade, school_year, user_id)
      select name || ' (copie)', school_grade, school_year, auth.uid() from public.tu_classes where id = source_id returning id into copy_id;
    if include_members then
      insert into public.tu_student_classes(student_id, class_id, student_number) select student_id, copy_id, student_number from public.tu_student_classes where class_id = source_id;
    end if;
  elsif kind = 'evaluation' then
    insert into public.tu_evaluations(title, school_term, sort_order, user_id)
      select title || ' (copie)', school_term, sort_order + 1, auth.uid() from public.tu_evaluations where id = source_id returning id into copy_id;
    insert into public.tu_skills(name, scale, icon, evaluation_id, grading_mode, criteria, max_observations, user_id)
      select name, scale, icon, copy_id, grading_mode, criteria, max_observations, auth.uid() from public.tu_skills where evaluation_id = source_id;
  elsif kind = 'skill' then
    insert into public.tu_skills(name, scale, icon, evaluation_id, grading_mode, criteria, max_observations, user_id)
      select name || ' (copie)', scale, icon, evaluation_id, grading_mode, criteria, max_observations, auth.uid() from public.tu_skills where id = source_id returning id into copy_id;
  else raise exception 'Type de copie inconnu.';
  end if;
  if copy_id is null then raise exception 'Élément introuvable ou inaccessible.'; end if;
  return copy_id;
end $$;
revoke all on function public.tu_duplicate_record(text, uuid, boolean) from public, anon;
grant execute on function public.tu_duplicate_record(text, uuid, boolean) to authenticated;

create function public.tu_save_teams(teams jsonb) returns uuid language plpgsql security invoker set search_path = '' as $$
declare batch uuid := gen_random_uuid(); item jsonb; team uuid; begin
  if jsonb_array_length(teams) < 1 then raise exception 'Aucune équipe.'; end if;
  for item in select * from jsonb_array_elements(teams) loop
    insert into public.tu_teams(name, color, user_id, batch_id) values (item->>'name', item->>'color', auth.uid(), batch) returning id into team;
    insert into public.tu_student_teams(student_id, team_id) select value::uuid, team from jsonb_array_elements_text(item->'student_ids');
  end loop;
  return batch;
end $$;
revoke all on function public.tu_save_teams(jsonb) from public, anon;
grant execute on function public.tu_save_teams(jsonb) to authenticated;

create function public.tu_assign_team(student uuid, team uuid, batch uuid) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if team is not null and not exists (select 1 from public.tu_teams where id = team and batch_id is not distinct from batch) then raise exception 'Équipe inaccessible.'; end if;
  delete from public.tu_student_teams where student_id = student and team_id in (select id from public.tu_teams where batch_id is not distinct from batch);
  if team is not null then insert into public.tu_student_teams(student_id, team_id) values (student, team); end if;
end $$;
revoke all on function public.tu_assign_team(uuid, uuid, uuid) from public, anon;
grant execute on function public.tu_assign_team(uuid, uuid, uuid) to authenticated;

create function public.tu_reorder_evaluations(ids uuid[]) returns void language plpgsql security invoker set search_path = '' as $$
begin
  update public.tu_evaluations e set sort_order = ordered.position::integer
    from unnest(ids) with ordinality as ordered(id, position) where e.id = ordered.id;
end $$;
revoke all on function public.tu_reorder_evaluations(uuid[]) from public, anon;
grant execute on function public.tu_reorder_evaluations(uuid[]) to authenticated;

create function public.tu_import_students(rows jsonb) returns table(id uuid, class_id uuid, student_number text)
language plpgsql security invoker set search_path = '' as $$
declare item jsonb; student uuid; record_id text; target_class uuid; begin
  for item in select * from jsonb_array_elements(rows) loop
    record_id := nullif(btrim(item->>'record_number'), '');
    target_class := (item->>'class_id')::uuid;
    student := null;
    if record_id is not null then
      perform pg_advisory_xact_lock(hashtext(lower(record_id)));
      select s.id into student from public.tu_students s where lower(btrim(s.record_number)) = lower(record_id);
    end if;
    if student is null then
      insert into public.tu_students(firstname, lastname, gender, birth_date, student_number, record_number, class_id, user_id)
      values (item->>'firstname', item->>'lastname', item->>'gender', nullif(item->>'birth_date', '')::date,
        nullif(item->>'student_number', ''), record_id, target_class, auth.uid()) returning tu_students.id into student;
    else
      insert into public.tu_student_classes(student_id, class_id, student_number) values (student, target_class, nullif(item->>'student_number', '')) on conflict on constraint tu_student_classes_pkey do update set student_number = coalesce(excluded.student_number, tu_student_classes.student_number);
    end if;
    return query select s.id, target_class, s.student_number::text from public.tu_students s where s.id = student;
  end loop;
end $$;
revoke all on function public.tu_import_students(jsonb) from public, anon;
grant execute on function public.tu_import_students(jsonb) to authenticated;
commit;
