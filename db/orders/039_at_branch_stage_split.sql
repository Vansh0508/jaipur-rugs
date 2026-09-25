-- Direct feedback, Back Ops walkthrough (transcript reviewed 2026-09-22): "At Branch"
-- (a packet has physically reached the weaving branch/house but weaving has NOT
-- started) was being lumped into the "Loom" stage bucket alongside "At Loom" (weaving
-- actually in progress) -- so an order could show as "on Loom," and get judged against
-- Loom's weaving-rate TAT, while it hadn't started weaving at all. Their own words: "we
-- are saying at branch is not equal to loom."
--
-- Note this was ALREADY correct on the *standard-days* side: stageTat.ts's
-- STATUS_TAT_RULES (and its SQL port, private.stage_standard_days) already give "branch"
-- its own 10d/7d(priority-0) standard, separate from loomStandardDays()'s weaving-rate
-- calculation -- that regex path is only reached for statuses NOT already caught by the
-- coarser stage bucket below. The bug was purely the coarse stage_id classification
-- (status_stage_map), which drives the stage filter, the stage timeline, and the Orders
-- table's "Stage" column/counts.
--
-- New stage placed between Pre-Loom (10) and Loom (20) -- conceptually, a packet is at
-- the branch waiting to be mounted, not yet weaving, but past the earlier pre-loom prep
-- work (design/PPC/stores/order process).

insert into stages (code, display_name, display_order, is_terminal)
values ('at_branch', 'At Branch', 15, false);

-- Only the exact "At Branch" mapping moves. "Carpet At Branch" (currently -> finish) is
-- a different, unrelated raw status -- not mentioned in this feedback, left as-is rather
-- than guessed at.
update status_stage_map
set stage_id = (select id from stages where code = 'at_branch')
where raw_status = 'At Branch' and is_prefix = false;
