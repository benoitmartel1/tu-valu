-- Keep the original level and grading_snapshot intact. Compute the canonical
-- score from the scale captured at evaluation time, never today's skill scale.
begin;
create function tu_private.normalize_observation_score(level text, snapshot jsonb)
returns numeric language plpgsql immutable security invoker set search_path = '' as $$
declare
  labels jsonb := snapshot->'labels';
  mode text := snapshot->>'mode';
  label text;
  lower_bound numeric;
  upper_bound numeric;
  value numeric;
  position integer;
  label_count integer;
begin
  if level is null or btrim(level) = '' or level = 'abs'
     or mode is null or mode = 'category'
     or jsonb_typeof(labels) is distinct from 'array' then
    return null;
  end if;
  label_count := jsonb_array_length(labels);
  if label_count < 2 then return null; end if;
  if mode = 'letter' then
    select ordinality::integer - 1 into position
      from jsonb_array_elements_text(labels) with ordinality as entries(label, ordinality)
      where entries.label = level order by ordinality limit 1;
    return position::numeric * 9 / (label_count - 1);
  end if;
  if mode not in ('numeric', 'rubric') then return null; end if;
  -- Do not guess a numeric meaning for malformed historical labels.
  for label in select jsonb_array_elements_text(labels) loop
    if label is null or label !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$' then
      return null;
    end if;
    value := label::numeric;
    lower_bound := least(lower_bound, value);
    upper_bound := greatest(upper_bound, value);
  end loop;
  if level !~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)([eE][+-]?[0-9]+)?$'
     or lower_bound = upper_bound then return null; end if;
  value := level::numeric;
  if value < lower_bound or value > upper_bound then return null; end if;
  return (value - lower_bound) * 9 / (upper_bound - lower_bound);
exception when numeric_value_out_of_range then
  return null;
end $$;

alter table public.tu_session_events
  add column normalized_score numeric generated always as
    (tu_private.normalize_observation_score(level::text, grading_snapshot)) stored,
  add constraint tu_session_events_normalized_score_range
    check (normalized_score between 0 and 9);
comment on column public.tu_session_events.normalized_score is
  'Canonical decimal score from 0 to 9, derived from the original level and saved grading scale. NULL for absences, unordered categories, or unknown/invalid scales. Original input is preserved.';
commit;