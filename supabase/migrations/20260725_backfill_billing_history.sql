-- Attach legacy subscription payments to their preschool and package so all
-- historical records appear under the correct school billing account.

update public.subscription_payments payment
set school_id = subscription.school_id
from public.school_subscriptions subscription
where payment.subscription_id = subscription.id
  and payment.school_id is null;

update public.subscription_payments payment
set plan_name = subscription.plan_name
from public.school_subscriptions subscription
where payment.subscription_id = subscription.id
  and nullif(trim(payment.plan_name), '') is null;

update public.subscription_payments
set charge_type = 'subscription'
where charge_type is null;

create index if not exists subscription_payments_school_date_history_idx
  on public.subscription_payments (school_id, payment_date desc, id desc);
