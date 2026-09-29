-- Atomic Sketch Challan write RPC used only by service-role Edge Functions.
-- WRITTEN 2026-09-23. REVISED 2026-09-28 to mirror the app's rules (apps/sketch-challan/lib/domain/actions.ts):
--   * intake is the live NAV Excel refresh (excel_upsert); there is no PDF upload any more
--   * the Sketching Manager edits and allots only before allotment; after that he asks Admin (request_update)
--   * Admin approves requests (never their own), adds parts and hands tasks over
--   * the part holder (a sketcher, or the manager on a part he took) starts and submits; the manager approves or sends back
--   * nothing happens to tasks while a challan is on hold, completed or cancelled
-- NOT APPLIED. Requires 001 and 002.

-- Only active employees who hold the Sketcher or Sketching Manager role can be given a part.
create function private.sketch_challan_can_hold_task(p_employee_id uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from employees where id = p_employee_id and status = 'active')
    and (private.sketch_challan_has_role(p_employee_id, 'sketcher')
      or private.sketch_challan_has_role(p_employee_id, 'sketching_manager'));
$$;

-- Everyone currently holding an app role, through either role path (used for notifications).
create function private.sketch_challan_role_holders(p_role_key text)
returns setof uuid language sql stable security definer set search_path = public, pg_temp as $$
  select e.id from employees e
    join sketch_challan_role_bindings b on b.role_id = e.primary_role_id
    where b.role_key = p_role_key and e.status = 'active'
  union
  select er.employee_id from employee_roles er
    join sketch_challan_role_bindings b on b.role_id = er.role_id
    join employees e on e.id = er.employee_id and e.status = 'active'
    where b.role_key = p_role_key and current_date between er.valid_from and coalesce(er.valid_to, 'infinity'::date);
$$;

-- The challan form fields a manager edit or change request may carry (camelCase, as the app sends them):
-- FIELD_LABELS in apps/sketch-challan/lib/domain/types.ts minus sketcherRemark (the holder's own `remark` action).
create function private.sketch_challan_check_detail_keys(p_fields jsonb)
returns void language plpgsql immutable set search_path = public, pg_temp as $$
declare v_key text;
begin
  if jsonb_typeof(p_fields) is distinct from 'object' then raise exception 'changes must be an object'; end if;
  for v_key in select jsonb_object_keys(p_fields) loop
    if v_key <> all (array[
      'challanDate', 'draftsman', 'sketchCategory', 'sizeType', 'developer', 'orderCount', 'design', 'ground',
      'border', 'matchingCode', 'substituteDesign', 'quality', 'shape', 'mapWidthFt', 'mapLengthFt', 'areaSqFt',
      'quantity', 'description', 'managerRemark1', 'managerRemark2', 'dueDate', 'priority'
    ]) then
      raise exception 'unsupported challan field: %', v_key;
    end if;
  end loop;
end;
$$;

-- Casts that return null instead of failing, so one odd NAV cell never rolls back a whole refresh.
create function private.sketch_challan_try_date(p_value text)
returns date language plpgsql immutable set search_path = public, pg_temp as $$
begin
  return nullif(btrim(p_value), '')::date;
exception when others then
  return null;
end;
$$;

create function private.sketch_challan_try_numeric(p_value text)
returns numeric language plpgsql immutable set search_path = public, pg_temp as $$
begin
  return nullif(btrim(p_value), '')::numeric;
exception when others then
  return null;
end;
$$;

-- Excel intake only: drops values that don't fit their column (bad dates, non-numbers, unknown categories) and
-- rounds whole-number fields, instead of letting a cast abort the refresh. The category list mirrors 001.
create function private.sketch_challan_clean_intake(p_fields jsonb)
returns jsonb language plpgsql immutable set search_path = public, pg_temp as $$
declare v_key text; v_value text; v_out jsonb := p_fields; v_num numeric;
begin
  for v_key, v_value in select key, value from jsonb_each_text(p_fields) loop
    if coalesce(btrim(v_value), '') = '' then continue; end if;
    if v_key in ('challanDate', 'dueDate') and private.sketch_challan_try_date(v_value) is null then
      v_out := v_out - v_key;
    elsif v_key in ('orderCount', 'quantity', 'mapWidthFt', 'mapLengthFt', 'areaSqFt') then
      v_num := private.sketch_challan_try_numeric(v_value);
      if v_num is null or v_num < 0 then
        v_out := v_out - v_key;
      elsif v_key in ('orderCount', 'quantity') then
        v_out := jsonb_set(v_out, array[v_key], to_jsonb(greatest(round(v_num), 1)::integer));
      end if;
    elsif v_key = 'sketchCategory' and v_value not in (
      'Copy Paste', 'Copy Paste Setting', 'Side Setting Repeat', 'Side Setting Develop',
      'Scale Easy', 'Scale Medium', 'Scale Hard',
      'Border Copy paste, Bicha copy paste setting', 'Border setting, Bicha setting',
      'Border Copy paste, Bicha Scale', 'Border Scale, Bicha Copy paste',
      'Design + Texcure+ Colouring', 'Length Adjustment', 'Wirth Adjustment',
      'Unfinishing', 'Layout accordingly Swatch file create') then
      v_out := v_out - v_key;
    end if;
  end loop;
  return v_out;
end;
$$;

-- A version snapshot is the challan row plus its item lines (quality, shape, sizes, quantity live on the items).
create function private.sketch_challan_snapshot(p_challan_id uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(c) || jsonb_build_object('items', coalesce(
    (select jsonb_agg(to_jsonb(i) order by i.line_no) from sketch_challan_items i where i.challan_id = c.id), '[]'::jsonb))
  from sketch_challans c where c.id = p_challan_id;
$$;

-- Writes form fields to the challan and its line-1 item. Only keys present are written, so a blank value is a
-- deliberate clear. p_intake additionally allows the Excel-only fields (Map No, order size, map size note).
create function private.sketch_challan_write_fields(p_challan_id uuid, p_fields jsonb, p_intake boolean)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare v_detail jsonb;
begin
  if p_intake then p_fields := private.sketch_challan_clean_intake(p_fields); end if;
  v_detail := p_fields - array['mapNo', 'orderSize', 'mapSizeNote'];
  perform private.sketch_challan_check_detail_keys(v_detail);
  if not p_intake and v_detail <> p_fields then raise exception 'Map No and sizes come only from the Excel'; end if;
  update sketch_challans set
    challan_date = case when p_fields ? 'challanDate' then nullif(p_fields->>'challanDate', '')::date else challan_date end,
    draftsman = case when p_fields ? 'draftsman' then coalesce(p_fields->>'draftsman', '') else draftsman end,
    sketch_category = case when p_fields ? 'sketchCategory' then coalesce(p_fields->>'sketchCategory', '') else sketch_category end,
    size_type = case when p_fields ? 'sizeType' then coalesce(p_fields->>'sizeType', '') else size_type end,
    developer = case when p_fields ? 'developer' then coalesce(p_fields->>'developer', '') else developer end,
    order_count = case when p_fields ? 'orderCount' then greatest(coalesce((p_fields->>'orderCount')::integer, 1), 1) else order_count end,
    design = case when p_fields ? 'design' then coalesce(p_fields->>'design', '') else design end,
    ground = case when p_fields ? 'ground' then coalesce(p_fields->>'ground', '') else ground end,
    border = case when p_fields ? 'border' then coalesce(p_fields->>'border', '') else border end,
    matching_code = case when p_fields ? 'matchingCode' then coalesce(p_fields->>'matchingCode', '') else matching_code end,
    substitute_design = case when p_fields ? 'substituteDesign' then coalesce(p_fields->>'substituteDesign', '') else substitute_design end,
    description = case when p_fields ? 'description' then coalesce(p_fields->>'description', '') else description end,
    design_remarks = case when p_fields ? 'managerRemark1' then coalesce(p_fields->>'managerRemark1', '') else design_remarks end,
    substitute_remarks = case when p_fields ? 'managerRemark2' then coalesce(p_fields->>'managerRemark2', '') else substitute_remarks end,
    due_date = case when p_fields ? 'dueDate' then nullif(p_fields->>'dueDate', '')::date else due_date end,
    original_due_date = case when p_fields ? 'dueDate' and original_due_date is null then nullif(p_fields->>'dueDate', '')::date else original_due_date end,
    priority = case when p_fields ? 'priority' then (p_fields->>'priority')::sketch_challan_priority else priority end,
    map_no = case when p_fields ? 'mapNo' then coalesce(p_fields->>'mapNo', '') else map_no end,
    order_size = case when p_fields ? 'orderSize' then coalesce(p_fields->>'orderSize', '') else order_size end,
    map_size_note = case when p_fields ? 'mapSizeNote' then coalesce(p_fields->>'mapSizeNote', '') else map_size_note end,
    updated_at = now()
  where id = p_challan_id;
  if p_fields ?| array['quality', 'shape', 'mapWidthFt', 'mapLengthFt', 'areaSqFt', 'quantity'] then
    insert into sketch_challan_items (challan_id, line_no) values (p_challan_id, 1) on conflict (challan_id, line_no) do nothing;
    update sketch_challan_items set
      quality = case when p_fields ? 'quality' then coalesce(p_fields->>'quality', '') else quality end,
      shape = case when p_fields ? 'shape' then coalesce(p_fields->>'shape', '') else shape end,
      map_width_ft = case when p_fields ? 'mapWidthFt' then coalesce((p_fields->>'mapWidthFt')::numeric, 0) else map_width_ft end,
      map_length_ft = case when p_fields ? 'mapLengthFt' then coalesce((p_fields->>'mapLengthFt')::numeric, 0) else map_length_ft end,
      area_sq_ft = case when p_fields ? 'areaSqFt' then coalesce((p_fields->>'areaSqFt')::numeric, 0) else area_sq_ft end,
      quantity = case when p_fields ? 'quantity' then greatest(coalesce((p_fields->>'quantity')::integer, 1), 1) else quantity end,
      updated_at = now()
    where challan_id = p_challan_id and line_no = 1;
  end if;
end;
$$;

-- Checks a handover { taskId, sketcherId, effectiveOn, reason, excludedDates } without applying it, so Admin is
-- never handed an impossible request (lib/domain/approval.ts does the same).
create function private.sketch_challan_check_handover(p_challan_id uuid, p_handover jsonb)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_task sketch_challan_tasks%rowtype;
  v_new uuid := (p_handover->>'sketcherId')::uuid;
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_effective_on date := coalesce(nullif(p_handover->>'effectiveOn', '')::date, (now() at time zone 'Asia/Kolkata')::date);
  v_excluded date[];
begin
  if coalesce(btrim(p_handover->>'reason'), '') = '' then raise exception 'a handover reason is required'; end if;
  if v_effective_on > v_today then raise exception 'a handover cannot be dated in the future'; end if;
  select * into v_task from sketch_challan_tasks where id = (p_handover->>'taskId')::uuid and challan_id = p_challan_id;
  if not found then raise exception 'task not found on challan'; end if;
  if v_task.status = 'completed' then raise exception 'a completed task cannot be handed over'; end if;
  if v_new is null or v_new = v_task.current_sketcher_id then raise exception 'choose a different sketcher'; end if;
  if not private.sketch_challan_can_hold_task(v_new) then raise exception 'that employee cannot be given sketch work'; end if;
  select coalesce(array_agg(value::date), '{}'::date[]) into v_excluded
    from jsonb_array_elements_text(coalesce(p_handover->'excludedDates', '[]'::jsonb));
  if exists (select 1 from sketch_challan_task_assignments
    where task_id = v_task.id and unassigned_at is null
      and (v_effective_on < assigned_on
        or (work_started_on is not null and v_effective_on < work_started_on)
        or exists (select 1 from unnest(v_excluded) d
          where work_started_on is null or d < work_started_on or d >= v_effective_on))) then
    raise exception 'invalid workday or leave dates for this handover';
  end if;
end;
$$;

-- Applies a checked handover: the outgoing assignment keeps its workday credit, the new holder starts at zero.
create function private.sketch_challan_transfer(p_actor_id uuid, p_actor_label text, p_challan_id uuid, p_handover jsonb)
returns uuid language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_task sketch_challan_tasks%rowtype;
  v_new uuid := (p_handover->>'sketcherId')::uuid;
  v_effective_on date := coalesce(nullif(p_handover->>'effectiveOn', '')::date, (now() at time zone 'Asia/Kolkata')::date);
  v_excluded date[];
begin
  perform private.sketch_challan_check_handover(p_challan_id, p_handover);
  select * into v_task from sketch_challan_tasks where id = (p_handover->>'taskId')::uuid for update;
  select coalesce(array_agg(value::date), '{}'::date[]) into v_excluded
    from jsonb_array_elements_text(coalesce(p_handover->'excludedDates', '[]'::jsonb));
  update sketch_challan_task_assignments set unassigned_at = now(), work_ended_on = v_effective_on,
    excluded_work_dates = v_excluded, transfer_reason = btrim(p_handover->>'reason')
    where task_id = v_task.id and unassigned_at is null;
  insert into sketch_challan_task_assignments (task_id, sketcher_id, assigned_by, assigned_on)
    values (v_task.id, v_new, p_actor_id, v_effective_on);
  update sketch_challan_tasks set current_sketcher_id = v_new, assigned_by = p_actor_id, assigned_at = now(),
    status = 'assigned', started_at = null, submitted_at = null, completed_at = null, updated_at = now()
    where id = v_task.id;
  insert into sketch_challan_activity (challan_id, task_id, activity_type, actor_employee_id, actor_label, message, metadata)
    values (p_challan_id, v_task.id, 'task_transferred', p_actor_id, p_actor_label,
      v_task.assigned_part || ' handed over. Reason: ' || btrim(p_handover->>'reason'),
      jsonb_build_object('fromSketcherId', v_task.current_sketcher_id, 'toSketcherId', v_new,
        'effectiveOn', v_effective_on, 'excludedDates', to_jsonb(v_excluded)));
  insert into sketch_challan_notifications (recipient_employee_id, challan_id, task_id, notification_type, title, message, dedupe_key)
    values (v_new, p_challan_id, v_task.id, 'transfer', 'A sketch part was handed to you', v_task.assigned_part,
      'sketch-transfer:' || v_task.id || ':' || v_new || ':' || extract(epoch from now())::bigint)
    on conflict (dedupe_key) do nothing;
  return v_task.id;
end;
$$;

create function private.sketch_challan_actor_can(p_actor_id uuid, p_action text, p_payload jsonb)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_challan_id uuid := nullif(p_payload->>'challanId', '')::uuid;
  v_allotted boolean;
  v_current sketch_challan_status;
begin
  if not exists (select 1 from employees where id = p_actor_id and status = 'active') then
    return false;
  end if;
  v_allotted := exists (select 1 from sketch_challan_tasks where challan_id = v_challan_id);
  if p_action = 'excel_upsert' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.refresh');
  elsif p_action = 'update' then
    -- Direct edits only before allotment; after that the Sketching Manager asks Admin (request_update).
    return private.employee_has_permission(p_actor_id, 'sketch_challan.edit') and not v_allotted;
  elsif p_action = 'remark' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.task.act')
      and exists (select 1 from sketch_challan_tasks where challan_id = v_challan_id and current_sketcher_id = p_actor_id);
  elsif p_action = 'request_update' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.edit')
      and private.sketch_challan_has_role(p_actor_id, 'sketching_manager') and v_allotted;
  elsif p_action = 'review_update' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.change.approve');
  elsif p_action = 'task_create' then
    -- The manager allots a new challan; once allotted, extra parts are Admin's call.
    return private.employee_has_permission(p_actor_id, 'sketch_challan.tasks.manage') and (
      (private.sketch_challan_has_role(p_actor_id, 'sketching_manager') and not v_allotted)
      or (private.sketch_challan_has_role(p_actor_id, 'admin') and v_allotted));
  elsif p_action = 'task_transfer' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.tasks.manage')
      and private.sketch_challan_has_role(p_actor_id, 'admin');
  elsif p_action = 'task_status' then
    return private.employee_has_permission(p_actor_id, 'sketch_challan.task.act')
      and exists (select 1 from sketch_challan_tasks
        where id = nullif(p_payload->>'taskId', '')::uuid and challan_id = v_challan_id and current_sketcher_id = p_actor_id);
  elsif p_action = 'task_review' then
    return private.sketch_challan_has_role(p_actor_id, 'sketching_manager');
  elsif p_action = 'status' then
    select status into v_current from sketch_challans where id = v_challan_id;
    -- Hold and resume need hold.manage; complete, cancel and reopen need complete.manage.
    if p_payload->>'status' = 'on_hold' or (p_payload->>'status' = 'active' and v_current = 'on_hold') then
      return private.employee_has_permission(p_actor_id, 'sketch_challan.hold.manage');
    end if;
    return private.employee_has_permission(p_actor_id, 'sketch_challan.complete.manage');
  end if;
  return false;
end;
$$;

create function public.sketch_challan_apply_action(
  p_actor_id uuid,
  p_actor_label text,
  p_action text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_challan_id uuid;
  v_task_id uuid;
  v_now timestamptz := now();
  v_today date := (now() at time zone 'Asia/Kolkata')::date;
  v_version bigint;
  v_status sketch_challan_status;
  v_hold_started timestamptz;
  v_hold_days integer;
  v_fields jsonb;
  v_request_id uuid;
  v_request sketch_challan_change_requests%rowtype;
  v_task sketch_challan_tasks%rowtype;
  v_row jsonb;
  v_part jsonb;
  v_po text;
  v_target text;
  v_approved boolean;
  v_note text;
  v_created integer := 0;
  v_updated integer := 0;
  v_cancelled integer := 0;
  v_remark1 text;
  v_substitute text;
  v_handover jsonb := case when jsonb_typeof(p_payload->'handover') = 'object' then p_payload->'handover' end;
begin
  if p_actor_id is null or coalesce(btrim(p_actor_label), '') = '' then
    raise exception 'actor context is required';
  end if;
  -- Lock the challan first, so the allotment and status that actor_can checks can't change underneath it.
  if p_action <> 'excel_upsert' then
    v_challan_id := nullif(p_payload->>'challanId', '')::uuid;
    select status, hold_started_at into v_status, v_hold_started from sketch_challans where id = v_challan_id for update;
    if not found then
      raise exception 'challan not found';
    end if;
  end if;
  if not private.sketch_challan_actor_can(p_actor_id, p_action, p_payload) then
    raise exception 'actor is not authorized for sketch challan action %', p_action using errcode = '42501';
  end if;

  -- Live Excel refresh. The app merges the NAV reports with the stored challans (lib/importExcel.ts
  -- mergeExcelRows: only filled cells count, manager-owned fields stay) and sends per challan only the fields
  -- to write, the report fields it supplied (excelFields), the raw row (source) and an optional history line.
  if p_action = 'excel_upsert' then
    if jsonb_typeof(p_payload->'rows') is distinct from 'array' then raise exception 'rows must be an array'; end if;
    -- One lock per refresh, not per row: thousands of advisory locks can exhaust the shared lock table.
    perform pg_advisory_xact_lock(hashtext('sketch-challan:excel-refresh'));
    for v_row in select value from jsonb_array_elements(p_payload->'rows') loop
      v_po := btrim(coalesce(v_row->>'productionOrderNo', ''));
      if v_po = '' then raise exception 'every Excel row needs a production order number'; end if;
      -- Only what a NAV report can supply: never priority or the manager's second remark.
      v_fields := coalesce(v_row->'fields', '{}'::jsonb) - array['productionOrderNo', 'priority', 'managerRemark2'];
      select id, design_remarks, substitute_design into v_challan_id, v_remark1, v_substitute
        from sketch_challans where production_order_no = v_po for update;
      -- Manager-owned once set (lib/importExcel.ts MANAGER_OWNED): the Excel only fills them while blank.
      if coalesce(v_remark1, '') <> '' then v_fields := v_fields - 'managerRemark1'; end if;
      if coalesce(v_substitute, '') <> '' then v_fields := v_fields - 'substituteDesign'; end if;
      if v_challan_id is null then
        insert into sketch_challans (source_type, created_by_employee_id, source_actor_label, production_order_no)
          values ('excel', p_actor_id, p_actor_label, v_po)
          returning id into v_challan_id;
        insert into sketch_challan_items (challan_id, line_no) values (v_challan_id, 1);
        insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message)
          values (v_challan_id, 'created', p_actor_id, p_actor_label, 'New challan received from the NAV Excel.');
        v_created := v_created + 1;
      else
        v_updated := v_updated + 1;
        if coalesce(btrim(v_row->>'message'), '') <> '' then
          insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message, metadata)
            values (v_challan_id, 'excel_refreshed', p_actor_id, p_actor_label, 'Live Excel refresh: ' || left(btrim(v_row->>'message'), 400), v_fields);
        end if;
      end if;
      perform private.sketch_challan_write_fields(v_challan_id, v_fields, true);
      update sketch_challans set
        excel_fields = case when v_row ? 'excelFields' then array(select jsonb_array_elements_text(v_row->'excelFields')) else excel_fields end,
        original_source_payload = case when v_row ? 'source' then v_row->'source' else original_source_payload end
        where id = v_challan_id;
      select coalesce(max(version_no), 0) + 1 into v_version from sketch_challan_versions where challan_id = v_challan_id;
      insert into sketch_challan_versions (challan_id, version_no, actor_employee_id, actor_label, origin, snapshot, changes)
        values (v_challan_id, v_version, p_actor_id, p_actor_label, 'excel_upsert', private.sketch_challan_snapshot(v_challan_id), v_fields);
    end loop;
    -- Unallotted challans that left every report are cancelled (the app drops them from its list); allotted ones stay.
    for v_po in select btrim(value) from jsonb_array_elements_text(coalesce(p_payload->'droppedPos', '[]'::jsonb)) loop
      update sketch_challans c set status = 'cancelled', cancelled_at = v_now, cancelled_by = p_actor_id,
        cancellation_reason = 'No longer in the NAV reports', hold_started_at = null, updated_at = v_now
        where c.production_order_no = v_po and c.status in ('active', 'on_hold')
          and not exists (select 1 from sketch_challan_tasks t where t.challan_id = c.id)
        returning c.id into v_challan_id;
      if found then
        v_cancelled := v_cancelled + 1;
        insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message)
          values (v_challan_id, 'cancelled', p_actor_id, p_actor_label, 'Cancelled: no longer in the NAV reports.');
      end if;
    end loop;
    return jsonb_build_object('created', v_created, 'updated', v_updated, 'cancelled', v_cancelled);
  end if;
  if p_action in ('task_create', 'task_status', 'task_review', 'task_transfer', 'remark') and v_status <> 'active' then
    raise exception 'this challan is %; resume or reopen it first', v_status;
  end if;

  if p_action = 'update' then
    v_fields := coalesce(p_payload->'changes', '{}'::jsonb);
    if v_fields = '{}'::jsonb then raise exception 'nothing to update'; end if;
    perform private.sketch_challan_write_fields(v_challan_id, v_fields, false);
    insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message, metadata)
      values (v_challan_id, 'details_updated', p_actor_id, p_actor_label,
        coalesce(nullif(left(btrim(coalesce(p_payload->>'message', '')), 200), ''), 'Challan details updated.'), v_fields);

  elsif p_action = 'remark' then
    update sketch_challans set sketcher_remark = left(coalesce(p_payload->>'sketcherRemark', ''), 2000), updated_at = v_now
      where id = v_challan_id;
    insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message)
      values (v_challan_id, 'remark_updated', p_actor_id, p_actor_label, 'Sketcher remark changed.');

  elsif p_action = 'request_update' then
    v_fields := coalesce(p_payload->'changes', '{}'::jsonb);
    perform private.sketch_challan_check_detail_keys(v_fields);
    if coalesce(btrim(p_payload->>'reason'), '') = '' then raise exception 'enter a reason for the requested change'; end if;
    if v_handover is not null then
      if v_status <> 'active' then raise exception 'resume the challan before asking for a handover'; end if;
      perform private.sketch_challan_check_handover(v_challan_id, v_handover);
    end if;
    insert into sketch_challan_change_requests (challan_id, requested_by, reason, proposed_changes, handover)
      values (v_challan_id, p_actor_id, btrim(p_payload->>'reason'), v_fields, v_handover)
      returning id into v_request_id;
    insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message, metadata)
      values (v_challan_id, 'change_requested', p_actor_id, p_actor_label,
        case when v_handover is not null then 'Sketching Manager requested admin approval to hand over a part.'
          else 'Sketching Manager requested admin approval for a challan detail change.' end,
        jsonb_build_object('requestId', v_request_id, 'changes', v_fields, 'handover', v_handover));
    insert into sketch_challan_notifications (recipient_employee_id, challan_id, notification_type, title, message, dedupe_key)
      select holder, v_challan_id, 'challan_update', 'Challan change needs approval', btrim(p_payload->>'reason'),
        'sketch-change-request:' || v_request_id || ':' || holder
      from private.sketch_challan_role_holders('admin') holder
      on conflict (dedupe_key) do nothing;
    return jsonb_build_object('challanId', v_challan_id, 'requestId', v_request_id);

  elsif p_action = 'review_update' then
    select * into v_request from sketch_challan_change_requests
      where id = nullif(p_payload->>'requestId', '')::uuid and challan_id = v_challan_id and status = 'pending'
      for update;
    if not found then raise exception 'pending change request not found'; end if;
    if v_request.requested_by = p_actor_id then
      raise exception 'someone else must review your own request' using errcode = '42501';
    end if;
    v_approved := coalesce((p_payload->>'approved')::boolean, false);
    v_note := nullif(btrim(coalesce(p_payload->>'note', '')), '');
    if not v_approved and v_note is null then raise exception 'enter a reason for rejecting this request'; end if;
    if v_approved and v_request.handover is not null and v_status <> 'active' then
      raise exception 'resume the challan before approving a handover';
    end if;
    update sketch_challan_change_requests set
      status = case when v_approved then 'approved'::sketch_challan_change_request_status else 'rejected'::sketch_challan_change_request_status end,
      reviewed_by = p_actor_id, reviewed_at = v_now, review_note = v_note, updated_at = v_now
      where id = v_request.id;
    if v_approved then
      perform private.sketch_challan_write_fields(v_challan_id, v_request.proposed_changes, false);
      if v_request.handover is not null then
        perform private.sketch_challan_transfer(p_actor_id, p_actor_label, v_challan_id, v_request.handover);
      end if;
    end if;
    insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message, metadata)
      values (v_challan_id,
        case when v_approved then 'change_approved'::sketch_challan_activity_type else 'change_rejected'::sketch_challan_activity_type end,
        p_actor_id, p_actor_label,
        'Admin ' || case when v_approved then 'approved and applied' else 'rejected' end || ' the challan detail request'
          || coalesce(': ' || v_note, '.'),
        jsonb_build_object('requestId', v_request.id));
    insert into sketch_challan_notifications (recipient_employee_id, challan_id, notification_type, title, message, dedupe_key)
      values (v_request.requested_by, v_challan_id, 'challan_update',
        case when v_approved then 'Challan change approved' else 'Challan change rejected' end,
        coalesce(v_note, 'Admin approved and applied the requested change.'), 'sketch-change-reviewed:' || v_request.id)
      on conflict (dedupe_key) do nothing;

  elsif p_action = 'task_create' then
    if jsonb_typeof(p_payload->'parts') is distinct from 'array' or jsonb_array_length(p_payload->'parts') = 0 then
      raise exception 'add at least one part';
    end if;
    for v_part in select value from jsonb_array_elements(p_payload->'parts') loop
      if coalesce(btrim(v_part->>'assignedPart'), '') = '' then raise exception 'choose a part'; end if;
      if not private.sketch_challan_can_hold_task(nullif(v_part->>'sketcherId', '')::uuid) then
        raise exception 'that employee cannot be given sketch work';
      end if;
      -- The same person and the same open part twice is a mistake; a finished part may be given again as rework.
      if exists (select 1 from sketch_challan_tasks
        where challan_id = v_challan_id and status <> 'completed'
          and current_sketcher_id = (v_part->>'sketcherId')::uuid and assigned_part = btrim(v_part->>'assignedPart')) then
        raise exception 'that sketcher already has % on this challan', btrim(v_part->>'assignedPart');
      end if;
      insert into sketch_challan_tasks (challan_id, title, assigned_part, current_sketcher_id, assigned_by)
        values (v_challan_id, coalesce(nullif(btrim(v_part->>'title'), ''), btrim(v_part->>'assignedPart')),
          btrim(v_part->>'assignedPart'), (v_part->>'sketcherId')::uuid, p_actor_id)
        returning id into v_task_id;
      insert into sketch_challan_task_assignments (task_id, sketcher_id, assigned_by)
        values (v_task_id, (v_part->>'sketcherId')::uuid, p_actor_id);
      insert into sketch_challan_activity (challan_id, task_id, activity_type, actor_employee_id, actor_label, message)
        values (v_challan_id, v_task_id, 'task_assigned', p_actor_id, p_actor_label, 'Assigned ' || btrim(v_part->>'assignedPart') || '.');
      insert into sketch_challan_notifications (recipient_employee_id, challan_id, task_id, notification_type, title, message, dedupe_key)
        values ((v_part->>'sketcherId')::uuid, v_challan_id, v_task_id, 'assignment', 'New sketch part', btrim(v_part->>'assignedPart'),
          'sketch-assigned:' || v_task_id)
        on conflict (dedupe_key) do nothing;
    end loop;

  elsif p_action = 'task_status' then
    v_target := p_payload->>'status';
    if v_target is null or v_target not in ('in_progress', 'submitted') then
      raise exception 'a part can only be started or submitted; the Sketching Manager approves it';
    end if;
    select * into v_task from sketch_challan_tasks
      where id = nullif(p_payload->>'taskId', '')::uuid and challan_id = v_challan_id for update;
    if not found or v_task.current_sketcher_id <> p_actor_id then
      raise exception 'only the current holder can do that' using errcode = '42501';
    end if;
    if v_task.status in ('submitted', 'completed') then raise exception 'this part is already done'; end if;
    if v_target = 'in_progress' and v_task.status = 'in_progress' then raise exception 'this part is already started'; end if;
    update sketch_challan_tasks set status = v_target::sketch_challan_task_status,
      started_at = coalesce(started_at, v_now),
      submitted_at = case when v_target = 'submitted' then v_now else submitted_at end,
      updated_at = v_now
      where id = v_task.id;
    -- Credit starts at Start and pauses at submission (lib/domain/actions.ts).
    update sketch_challan_task_assignments set
      work_started_on = coalesce(work_started_on, v_today),
      work_ended_on = case when v_target = 'submitted' then v_today + 1 else work_ended_on end
      where task_id = v_task.id and unassigned_at is null;
    insert into sketch_challan_activity (challan_id, task_id, activity_type, actor_employee_id, actor_label, message)
      values (v_challan_id, v_task.id,
        case when v_target = 'submitted' then 'task_submitted'::sketch_challan_activity_type else 'task_started'::sketch_challan_activity_type end,
        p_actor_id, p_actor_label,
        p_actor_label || case when v_target = 'submitted' then ' submitted ' else ' started ' end || v_task.assigned_part || '.');
    if v_target = 'submitted' then
      insert into sketch_challan_notifications (recipient_employee_id, challan_id, task_id, notification_type, title, message, dedupe_key)
        select holder, v_challan_id, v_task.id, 'task_update', 'Sketch part ready for checking', v_task.assigned_part,
          'sketch-submitted:' || v_task.id || ':' || holder || ':' || extract(epoch from v_now)::bigint
        from private.sketch_challan_role_holders('sketching_manager') holder
        where holder <> p_actor_id
        on conflict (dedupe_key) do nothing;
    end if;

  elsif p_action = 'task_review' then
    select * into v_task from sketch_challan_tasks
      where id = nullif(p_payload->>'taskId', '')::uuid and challan_id = v_challan_id for update;
    if not found then raise exception 'task not found on challan'; end if;
    if v_task.status <> 'submitted' then raise exception 'this part is not waiting for approval'; end if;
    v_approved := coalesce((p_payload->>'approved')::boolean, false);
    v_note := nullif(btrim(coalesce(p_payload->>'note', '')), '');
    if not v_approved and v_note is null then raise exception 'say what needs fixing before sending it back'; end if;
    if v_approved then
      update sketch_challan_tasks set status = 'completed', completed_at = v_now, updated_at = v_now where id = v_task.id;
    else
      update sketch_challan_tasks set status = 'assigned', submitted_at = null, updated_at = v_now where id = v_task.id;
      -- Sent back: credit keeps running from the original start until the next submission.
      update sketch_challan_task_assignments set work_ended_on = null where task_id = v_task.id and unassigned_at is null;
    end if;
    insert into sketch_challan_activity (challan_id, task_id, activity_type, actor_employee_id, actor_label, message, metadata)
      values (v_challan_id, v_task.id,
        case when v_approved then 'task_completed'::sketch_challan_activity_type else 'task_sent_back'::sketch_challan_activity_type end,
        p_actor_id, p_actor_label,
        case when v_approved then 'Sketching Manager approved ' || v_task.assigned_part || '.'
          else 'Sketching Manager sent ' || v_task.assigned_part || ' back: ' || v_note end,
        jsonb_build_object('note', v_note));
    insert into sketch_challan_notifications (recipient_employee_id, challan_id, task_id, notification_type, title, message, dedupe_key)
      values (v_task.current_sketcher_id, v_challan_id, v_task.id, 'task_update',
        case when v_approved then 'Sketch part approved' else 'Sketch part sent back' end,
        coalesce(v_note, v_task.assigned_part), 'sketch-reviewed:' || v_task.id || ':' || extract(epoch from v_now)::bigint)
      on conflict (dedupe_key) do nothing;

  elsif p_action = 'task_transfer' then
    v_task_id := private.sketch_challan_transfer(p_actor_id, p_actor_label, v_challan_id, p_payload);

  elsif p_action = 'status' then
    v_target := p_payload->>'status';
    if v_target = 'on_hold' and v_status = 'active' then
      if coalesce(btrim(p_payload->>'reason'), '') = '' then raise exception 'a hold reason is required'; end if;
      update sketch_challans set status = 'on_hold', hold_started_at = v_now, updated_at = v_now where id = v_challan_id;
    elsif v_target = 'active' and v_status = 'on_hold' then
      v_hold_days := greatest(1, ceil(extract(epoch from (v_now - v_hold_started)) / 86400.0)::integer);
      update sketch_challans set status = 'active', hold_started_at = null,
        accumulated_hold_minutes = accumulated_hold_minutes + ceil(extract(epoch from (v_now - v_hold_started)) / 60.0)::integer,
        due_date = coalesce(nullif(p_payload->>'dueDateOverride', '')::date, due_date + v_hold_days),
        due_date_override_reason = case when nullif(p_payload->>'dueDateOverride', '') is not null then p_payload->>'reason' else due_date_override_reason end,
        updated_at = v_now where id = v_challan_id;
    elsif v_target = 'completed' and v_status in ('active', 'on_hold') then
      if not exists (select 1 from sketch_challan_tasks where challan_id = v_challan_id)
         or exists (select 1 from sketch_challan_tasks where challan_id = v_challan_id and status <> 'completed') then
        raise exception 'approve every part before completing the challan';
      end if;
      update sketch_challans set status = 'completed', completed_at = v_now, completed_by = p_actor_id,
        accumulated_hold_minutes = accumulated_hold_minutes
          + case when v_hold_started is null then 0 else ceil(extract(epoch from (v_now - v_hold_started)) / 60.0)::integer end,
        hold_started_at = null, updated_at = v_now where id = v_challan_id;
    elsif v_target = 'cancelled' and v_status in ('active', 'on_hold') then
      if coalesce(btrim(p_payload->>'reason'), '') = '' then raise exception 'a cancellation reason is required'; end if;
      update sketch_challans set status = 'cancelled', cancelled_at = v_now, cancelled_by = p_actor_id,
        cancellation_reason = p_payload->>'reason',
        accumulated_hold_minutes = accumulated_hold_minutes
          + case when v_hold_started is null then 0 else ceil(extract(epoch from (v_now - v_hold_started)) / 60.0)::integer end,
        hold_started_at = null, updated_at = v_now where id = v_challan_id;
    elsif v_target = 'active' and v_status in ('completed', 'cancelled') then
      if coalesce(btrim(p_payload->>'reason'), '') = '' then raise exception 'a reopen reason is required'; end if;
      update sketch_challans set status = 'active', completed_at = null, completed_by = null, cancelled_at = null,
        cancelled_by = null, cancellation_reason = null, reopened_at = v_now, reopened_by = p_actor_id,
        reopen_reason = p_payload->>'reason', updated_at = v_now where id = v_challan_id;
    else
      raise exception 'unsupported status transition';
    end if;
    insert into sketch_challan_activity (challan_id, activity_type, actor_employee_id, actor_label, message, metadata)
      values (v_challan_id,
        case v_target when 'on_hold' then 'held'::sketch_challan_activity_type
          when 'completed' then 'completed'::sketch_challan_activity_type
          when 'cancelled' then 'cancelled'::sketch_challan_activity_type
          else case when v_status = 'on_hold' then 'resumed'::sketch_challan_activity_type else 'reopened'::sketch_challan_activity_type end end,
        p_actor_id, p_actor_label, 'Challan status changed to ' || v_target || '.', p_payload);
  else
    raise exception 'unsupported sketch challan action: %', p_action;
  end if;

  select coalesce(max(version_no), 0) + 1 into v_version from sketch_challan_versions where challan_id = v_challan_id;
  insert into sketch_challan_versions (challan_id, version_no, actor_employee_id, actor_label, origin, snapshot, changes)
    values (v_challan_id, v_version, p_actor_id, p_actor_label, p_action, private.sketch_challan_snapshot(v_challan_id), p_payload);
  return jsonb_build_object('challanId', v_challan_id, 'taskId', v_task_id);
end;
$$;

revoke all on function public.sketch_challan_apply_action(uuid, text, text, jsonb) from public, anon, authenticated;
-- The writing helpers trust their actor argument, so only the RPC (running as owner) may call them. The read
-- helpers keep default EXECUTE because RLS policies call them.
revoke execute on function private.sketch_challan_write_fields(uuid, jsonb, boolean) from public;
revoke execute on function private.sketch_challan_transfer(uuid, text, uuid, jsonb) from public;
grant execute on function public.sketch_challan_apply_action(uuid, text, text, jsonb) to service_role;
