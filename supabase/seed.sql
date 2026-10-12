-- 開發用 Seed（僅限本機 / 開發環境，勿在正式環境執行）
-- 只放入已查核來源的校園建築代碼；座標未查核者保持 null。
-- 來源：淡江大學空間代碼（學生整理，待與校方公開資料逐筆核對）
insert into public.campus_places (code, name, category, source_name, source_url) values
  ('B',  '商管大樓',         'academic', '淡江空間代碼（學生整理）', 'https://university.1111.com.tw/zone/University/discussTopic.asp?cat=University&id=270024'),
  ('E',  '工學大樓',         'academic', '淡江空間代碼（學生整理）', 'https://university.1111.com.tw/zone/University/discussTopic.asp?cat=University&id=270024'),
  ('H',  '宮燈教室',         'academic', '淡江空間代碼（學生整理）', 'https://university.1111.com.tw/zone/University/discussTopic.asp?cat=University&id=270024'),
  ('I',  '覺生綜合大樓',     'academic', '淡江大學遠距教學發展中心', 'https://deds.tku.edu.tw/room/'),
  ('U',  '覺生紀念圖書館',   'library',  '淡江空間代碼（學生整理）', 'https://university.1111.com.tw/zone/University/discussTopic.asp?cat=University&id=270024')
on conflict (code) do nothing;
