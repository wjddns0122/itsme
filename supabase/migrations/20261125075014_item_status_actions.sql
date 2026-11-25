-- FL-043: police transfer and disposal (A-05 [경찰 이관] [폐기 처리]). Security invoker, so the
-- admin's RLS applies: they can only change items of their own facility. One transaction:
-- the item, its open candidates, reports that were waiting on this item, and the audit event.
create or replace function set_found_item_status(p_item_id uuid, p_status found_status, p_note text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_item found_items%rowtype;
  v_reports uuid[];
begin
  if p_status not in ('transferred', 'disposed') then
    raise exception 'only transferred or disposed can be set here, got %', p_status;
  end if;

  select * into v_item from found_items where id = p_item_id for update;
  if not found then
    raise exception 'found item % not found', p_item_id;
  end if;
  if v_item.status not in ('stored', 'claimed') then
    raise exception 'found item % cannot change from status %', p_item_id, v_item.status;
  end if;

  select coalesce(array_agg(lost_report_id), '{}') into v_reports
  from match_candidates
  where found_item_id = p_item_id and status in ('claimed', 'needs_proof');

  update found_items set status = p_status where id = p_item_id;

  update match_candidates
  set status = 'dismissed',
      breakdown = breakdown || jsonb_build_object('dismiss_reason', 'item_' || p_status::text)
  where found_item_id = p_item_id and status in ('suggested', 'claimed', 'needs_proof');

  -- A report whose claim was on this item goes back to searching unless another claim is active.
  update lost_reports lr
  set status = 'open'
  where lr.id = any (v_reports)
    and lr.status = 'claimed'
    and not exists (
      select 1 from match_candidates mc
      where mc.lost_report_id = lr.id and mc.status in ('claimed', 'needs_proof', 'approved')
    );

  insert into item_events (facility_id, found_item_id, actor, type, payload)
  values (v_item.facility_id, p_item_id, auth.uid(), p_status::text,
          jsonb_build_object('note', p_note, 'from', v_item.status::text));
end;
$$;

revoke all on function set_found_item_status(uuid, found_status, text) from public, anon;
grant execute on function set_found_item_status(uuid, found_status, text) to authenticated, service_role;
