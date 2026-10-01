-- jrgpt.receivables : open customer receivables, one row per ledger entry.
-- Requires nav_mirror."JRCPL Live$Cust_ Ledger Entry" and
--          nav_mirror."JRCPL Live$Detailed Cust_ Ledg_ Entry"  (see jrgpt/copy_ledger.py)
--
-- WHY THE JOIN: in this NAV version the ledger header has NO stored amount columns.
-- Amount / Remaining Amount / Remaining Amt_ (LCY) are FlowFields - computed, not stored.
-- The money only exists in the detail table, aggregated per Cust_ Ledger Entry No_.
create or replace view jrgpt.receivables as
with detail as (
  select "Cust_ Ledger Entry No_"       as ledger_entry_no,
         sum("Amount (LCY)")            as amount_inr
  from nav_mirror."JRCPL Live$Detailed Cust_ Ledg_ Entry"
  group by 1),
-- the ledger carries only a customer code; names come from the order/invoice side
names as (
  select customer_code, max(customer_name) as customer_name from (
    select nullif(btrim("Customer No_"),'') as customer_code,
           nullif(btrim("Customer Name"),'') as customer_name
    from nav_mirror."NAV-062 - Customer Open Order Value Report"
    union all
    select customer_code, customer_name from jrgpt.sales_invoiced
  ) u where customer_code is not null and customer_name is not null
  group by 1)
select
  h."Entry No_"                              as ledger_entry_no,
  nullif(btrim(h."Customer No_"), '')        as customer_code,
  n.customer_name                            as customer_name,
  h."Posting Date"::date                     as posting_date,
  h."Due Date"::date                         as due_date,
  h."Document No_"                           as document_no,
  case h."Document Type" when 1 then 'Payment' when 2 then 'Invoice'
       when 3 then 'Credit Memo' when 4 then 'Finance Charge Memo'
       when 5 then 'Reminder' when 6 then 'Refund' else 'Other' end as document_type,
  nullif(btrim(h."Currency Code"), '')       as currency_code,
  (h."Open" = 1)                             as is_open,
  d.amount_inr,
  (current_date - h."Due Date"::date)        as days_overdue
from nav_mirror."JRCPL Live$Cust_ Ledger Entry" h
join detail d on d.ledger_entry_no = h."Entry No_"
left join names n on n.customer_code = nullif(btrim(h."Customer No_"), '')
where h."Open" = 1 and d.amount_inr <> 0;

comment on view jrgpt.receivables is
'Open customer receivables. amount_inr comes from the DETAIL table - the header amount columns are NAV FlowFields and are not stored. days_overdue is negative when not yet due. Positive amount_inr = owed to us.';
