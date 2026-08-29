-- Per-school Grade R language choices. Defaults retain the original English / Afrikaans behaviour.
alter table public.school_setup_settings
  add column if not exists grade_r_home_language text not null default 'English',
  add column if not exists grade_r_first_additional_language text not null default 'Afrikaans';

alter table public.grade_r_term_results
  add column if not exists subject_label_snapshot text;

update public.grade_r_term_results
set subject_label_snapshot = case subject_key
  when 'english_home_language' then 'English Home Language'
  when 'afrikaans_first_additional_language' then 'Afrikaans First Additional Language'
  when 'mathematics' then 'Mathematics'
  when 'life_skills' then 'Life Skills'
  else subject_label_snapshot
end
where subject_label_snapshot is null;
