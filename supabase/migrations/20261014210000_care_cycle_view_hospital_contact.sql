-- My Care, part 8: the cycle carries its hospital's phone and logo, so the
-- patient's next-visit card can show "Call hospital" and the logo before
-- the nurse has saved a follow-up. Same body as part 5 plus two keys.

create or replace function public.care_cycle_view(p_cycle_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with cy as (
    select c.*, h.name as hospital_name, h.phone as hospital_phone, h.logo_url as hospital_logo_url, pr.title_en, pr.title_te, pr.length_days, sn.display_name as started_by_name
    from public.care_cycles c
    join public.hospitals h on h.id = c.hospital_id
    join public.care_cycle_protocols pr on pr.code = c.protocol_code
    left join public.care_nurses sn on sn.id = c.started_by_nurse_id
    where c.id = p_cycle_id
  ),
  base as (
    select s.*, r.planned_date, r.status, r.done_on, r.nurse_name, (cy.anchor_date + s.day - 1) as base_date
    from cy
    join public.care_cycle_protocol_steps s on s.protocol_code = cy.protocol_code and s.is_active
    left join public.care_cycle_step_records r on r.cycle_id = cy.id and r.step_id = s.id
  ),
  steps as (
    select b.*,
      coalesce(
        b.planned_date,
        (select coalesce(l.planned_date, l.base_date) + b.linked_offset_days from base l where l.code = b.linked_step_code),
        b.base_date
      ) as eff_date,
      (select l.id from base l where l.code = b.linked_step_code) as linked_step_id
    from base b
  )
  select jsonb_build_object(
    'id', cy.id,
    'kind', 'cycle',
    'protocol', cy.protocol_code,
    'titleEn', cy.title_en,
    'titleTe', cy.title_te,
    'lengthDays', cy.length_days,
    'personName', cy.person_name,
    'partnerName', cy.partner_name,
    'anchorDate', cy.anchor_date,
    'status', cy.status,
    'hospitalId', cy.hospital_id,
    'hospitalName', cy.hospital_name,
    'hospitalPhone', cy.hospital_phone,
    'hospitalLogoUrl', cy.hospital_logo_url,
    'doctorName', cy.doctor_name,
    'startedByNurse', cy.started_by_name,
    'createdAt', cy.created_at,
    'steps', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'code', s.code,
        'day', s.day,
        'labelEn', s.label_en,
        'labelTe', s.label_te,
        'who', s.who,
        'noteEn', s.note_en,
        'noteTe', s.note_te,
        'baseDate', s.base_date,
        'date', s.eff_date,
        'planned', s.planned_date is not null,
        'linkedStepId', s.linked_step_id,
        'linkedOffsetDays', s.linked_offset_days,
        'status', s.status,
        'doneOn', s.done_on,
        'nurseName', s.nurse_name
      ) order by s.eff_date, s.sort_order)
      from steps s
    ), '[]'::jsonb)
  )
  from cy;
$$;
