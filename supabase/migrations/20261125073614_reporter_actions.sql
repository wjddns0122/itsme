-- FL-034: actions people take on their own report page (P-04). Called by server code with the
-- service role after it has looked the report up by its access token, so the functions take the
-- report id and never trust anything else from the browser.

-- [아니에요]: hide one suggested candidate. Hidden candidates are never recreated (docs/05 §6).
create or replace function dismiss_candidate_by_reporter(p_report_id uuid, p_candidate_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_facility uuid;
begin
  update match_candidates
  set status = 'dismissed',
      breakdown = breakdown || jsonb_build_object('dismiss_reason', 'user_dismissed')
  where id = p_candidate_id and lost_report_id = p_report_id and status = 'suggested'
  returning facility_id into v_facility;

  if v_facility is null then
    return false;
  end if;

  insert into item_events (facility_id, lost_report_id, type, payload)
  values (v_facility, p_report_id, 'candidate_dismissed', jsonb_build_object('candidate_id', p_candidate_id, 'by', 'reporter'));
  return true;
end;
$$;

-- [신고 취소]: close the report and dismiss its open candidates in one transaction. A found item that
-- was waiting on this report's claim goes back to stored unless another claim is still active.
create or replace function cancel_lost_report(p_report_id uuid)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_facility uuid;
  v_items uuid[];
begin
  update lost_reports
  set status = 'closed', closed_at = now()
  where id = p_report_id and status in ('open', 'claimed')
  returning facility_id into v_facility;

  if v_facility is null then
    return false;
  end if;

  select coalesce(array_agg(found_item_id), '{}') into v_items
  from match_candidates
  where lost_report_id = p_report_id and status in ('claimed', 'needs_proof');

  update match_candidates
  set status = 'dismissed',
      breakdown = breakdown || jsonb_build_object('dismiss_reason', 'report_closed')
  where lost_report_id = p_report_id and status in ('suggested', 'claimed', 'needs_proof');

  update found_items fi
  set status = 'stored'
  where fi.id = any (v_items)
    and fi.status = 'claimed'
    and not exists (
      select 1 from match_candidates mc
      where mc.found_item_id = fi.id and mc.status in ('claimed', 'needs_proof', 'approved')
    );

  insert into item_events (facility_id, lost_report_id, type, payload)
  values (v_facility, p_report_id, 'report_cancelled', jsonb_build_object('by', 'reporter'));
  return true;
end;
$$;

revoke all on function dismiss_candidate_by_reporter(uuid, uuid) from public, anon, authenticated;
revoke all on function cancel_lost_report(uuid) from public, anon, authenticated;
grant execute on function dismiss_candidate_by_reporter(uuid, uuid) to service_role;
grant execute on function cancel_lost_report(uuid) to service_role;
