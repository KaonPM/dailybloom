alter table school_signup_requests
add column if not exists is_sponsored boolean default false;

alter table school_signup_requests
add column if not exists sponsor_programme_id bigint references sponsor_programmes(id);
