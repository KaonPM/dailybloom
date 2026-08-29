insert into public.learning_resources (title, grade, resource_type, source_name, source_url, language, academic_year, term, content_rights, is_downloadable, is_printable, is_parent_shareable, status)
values
  ('DBE Grade R Workbook Book 1', 'Grade R', 'DBE Workbook', 'Department of Basic Education', 'https://www.education.gov.za/LinkClick.aspx?fileticket=hFCcRCMWxm8%3D&forcedownload=true&mid=14753&portalid=0&tabid=5726', 'English', 2026, 1, 'DBE State-Owned', true, true, true, 'published'),
  ('DBE Grade R Workbook Book 2', 'Grade R', 'DBE Workbook', 'Department of Basic Education', 'https://www.education.gov.za/LinkClick.aspx?fileticket=kr4Te5g4uho%3D&forcedownload=true&mid=14754&portalid=0&tabid=5726', 'English', 2026, 2, 'DBE State-Owned', true, true, true, 'published'),
  ('DBE Grade R Workbook Book 3', 'Grade R', 'DBE Workbook', 'Department of Basic Education', 'https://www.education.gov.za/LinkClick.aspx?fileticket=MKbh5TfkWpM%3D&forcedownload=true&mid=15010&portalid=0&tabid=5885', 'English', 2026, 3, 'DBE State-Owned', true, true, true, 'published'),
  ('DBE Grade R Workbook Book 4', 'Grade R', 'DBE Workbook', 'Department of Basic Education', 'https://www.education.gov.za/LinkClick.aspx?fileticket=rdFQ2gBXakw%3D&forcedownload=true&mid=15011&portalid=0&tabid=5885', 'English', 2026, 4, 'DBE State-Owned', true, true, true, 'published')
on conflict do nothing;
