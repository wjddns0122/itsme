-- Ownership check (docs/02-user-flows.md §5, §6, §9-3; docs/05-ai-matching.md §9-4).
-- Each action changes candidate, found item and report together, so each is one function.

-- P-05 [확인 요청하기]. Called by the server with the service role after it matched the report's
-- access token. Returns a code instead of raising so the page can show the right message.
create or replace function submit_claim(p_report_id uuid, p_candidate_id uuid, p_answers jsonb, p_photo_path text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_report lost_reports%rowtype;
  v_cand match_candidates%rowtype;
  v_item_status found_status;
begin
  select * into v_report from lost_reports where id = p_report_id for update;
  if not found then
    return 'not_found';
  end if;
  select * into v_cand from match_candidates where id = p_candidate_id and lost_report_id = p_report_id for update;
  if not found then
    return 'not_found';
  end if;

  if v_report.status not in ('open', 'claimed') or v_cand.status in ('approved', 'dismissed') then
    return 'not_available';
  end if;
  -- One active request per report (claimed or waiting for proof).
  if exists (select 1 from match_candidates where lost_report_id = p_report_id and status in ('claimed', 'needs_proof')) then
    return 'active_exists';
  end if;
  -- At most two requests for the same pair; a rejected pair cannot be asked again.
  if v_cand.status <> 'suggested' or v_cand.claim_attempt >= 2 then
    return 'limit';
  end if;
  select status into v_item_status from found_items where id = v_cand.found_item_id for update;
  if v_item_status not in ('stored', 'claimed') then
    return 'not_available';
  end if;

  update match_candidates
  set status = 'claimed', claim_answers = p_answers, claim_photo_path = p_photo_path,
      claim_attempt = claim_attempt + 1, claimed_at = now(),
      ai_verdict = null, proof_request = null, proof_reply = null, proof_photo_path = null
  where id = p_candidate_id;
  update found_items set status = 'claimed' where id = v_cand.found_item_id and status = 'stored';
  update lost_reports set status = 'claimed' where id = p_report_id;

  insert into item_events (facility_id, found_item_id, lost_report_id, type, payload)
  values (v_report.facility_id, v_cand.found_item_id, p_report_id, 'claimed',
          jsonb_build_object('candidate_id', p_candidate_id, 'attempt', v_cand.claim_attempt + 1));
  return 'ok';
end;
$$;

-- P-04 추가 증빙 제출: only while the admin is waiting for proof. Back to 'claimed' for review.
create or replace function submit_proof(p_report_id uuid, p_candidate_id uuid, p_reply text, p_photo_path text)
returns text
language plpgsql
set search_path = public
as $$
declare
  v_cand match_candidates%rowtype;
begin
  select * into v_cand from match_candidates where id = p_candidate_id and lost_report_id = p_report_id for update;
  if not found then
    return 'not_found';
  end if;
  if v_cand.status <> 'needs_proof' then
    return 'not_available';
  end if;

  update match_candidates
  set status = 'claimed', proof_reply = p_reply, proof_photo_path = p_photo_path, ai_verdict = null
  where id = p_candidate_id;

  insert into item_events (facility_id, found_item_id, lost_report_id, type, payload)
  values (v_cand.facility_id, v_cand.found_item_id, p_report_id, 'proof_submitted', jsonb_build_object('candidate_id', p_candidate_id));
  return 'ok';
end;
$$;

-- A-06 승인 / 추가 증빙 요청 / 보류 / 거절. Security invoker: RLS keeps the admin inside their facility.
-- p_message is the pickup guide (approve) or the proof request (request_proof); p_note stays internal.
create or replace function review_claim(p_candidate_id uuid, p_action text, p_message text default null, p_note text default null)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_cand match_candidates%rowtype;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_message text := nullif(trim(coalesce(p_message, '')), '');
begin
  select * into v_cand from match_candidates where id = p_candidate_id for update;
  if not found then
    raise exception 'candidate % not found', p_candidate_id;
  end if;

  if p_action = 'approve' then
    if v_cand.status <> 'claimed' then
      raise exception 'candidate % is not waiting for review', p_candidate_id;
    end if;
    update match_candidates
    set status = 'approved', pickup_message = v_message, review_note = coalesce(v_note, review_note),
        reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_candidate_id;

  elsif p_action = 'request_proof' then
    if v_cand.status <> 'claimed' then
      raise exception 'candidate % is not waiting for review', p_candidate_id;
    end if;
    if v_message is null then
      raise exception 'a proof request needs a message';
    end if;
    update match_candidates
    set status = 'needs_proof', proof_request = v_message, proof_reply = null, proof_photo_path = null,
        review_note = coalesce(v_note, review_note), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_candidate_id;

  elsif p_action = 'hold' then
    if v_cand.status not in ('claimed', 'needs_proof') then
      raise exception 'candidate % is not under review', p_candidate_id;
    end if;
    update match_candidates set review_note = v_note, reviewed_by = auth.uid(), reviewed_at = now() where id = p_candidate_id;

  elsif p_action = 'reject' then
    if v_cand.status not in ('claimed', 'needs_proof') then
      raise exception 'candidate % is not under review', p_candidate_id;
    end if;
    update match_candidates
    set status = 'rejected', review_note = coalesce(v_note, review_note), reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_candidate_id;
    -- Back to stored only when nobody else is still asking for this item.
    update found_items set status = 'stored'
    where id = v_cand.found_item_id and status = 'claimed'
      and not exists (select 1 from match_candidates
                      where found_item_id = v_cand.found_item_id and id <> p_candidate_id
                        and status in ('claimed', 'needs_proof', 'approved'));
    update lost_reports set status = 'open' where id = v_cand.lost_report_id and status = 'claimed';

  else
    raise exception 'unknown review action %', p_action;
  end if;

  insert into item_events (facility_id, found_item_id, lost_report_id, actor, type, payload)
  values (v_cand.facility_id, v_cand.found_item_id, v_cand.lost_report_id, auth.uid(),
          case p_action when 'approve' then 'approved' when 'request_proof' then 'proof_requested'
                        when 'hold' then 'held' else 'rejected' end,
          jsonb_build_object('candidate_id', p_candidate_id) || case when v_note is not null then jsonb_build_object('note', v_note) else '{}'::jsonb end);
end;
$$;

revoke all on function submit_claim(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function submit_proof(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function review_claim(uuid, text, text, text) from public, anon;
grant execute on function submit_claim(uuid, uuid, jsonb, text) to service_role;
grant execute on function submit_proof(uuid, uuid, text, text) to service_role;
grant execute on function review_claim(uuid, text, text, text) to authenticated, service_role;
