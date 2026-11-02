/** Legal text. Reviewed wording lives here, so it is written by hand in two languages, not machine translated. */
export const LEGAL_UPDATED = '2026-11-02';
export const SUPPORT_EMAIL = (import.meta.env.VITE_SUPPORT_EMAIL as string | undefined) ?? '';
export const SUPPORT_RESPONSE_DAYS = 3;

export interface LegalSection { heading: string; body: string[] }
export interface LegalDoc { title: string; sections: LegalSection[] }
export type LegalKey = 'privacy' | 'terms' | 'support' | 'delete';

export const LEGAL: Record<'zh' | 'en', Record<LegalKey, LegalDoc>> = {
  zh: {
    privacy: { title: '隱私權政策', sections: [
      { heading: '誰在處理你的資料', body: ['TKU Campus OS 由學生個人開發與營運，不是淡江大學官方服務，也未獲校方授權。聯絡方式見「聯絡與支援」頁。'] },
      { heading: '蒐集的資料與目的', body: [
        '帳號資料：Email、密碼（由 Supabase 驗證服務處理）、暱稱、系級、好友代碼。用途是登入與辨識帳號。',
        '學習資料：學期、課程、教師、教室、節次、備註、作業、考試、私人行程與收藏。用途是提供課表、待辦與提醒。',
        '社群資料：好友關係、市集貼文、價格、留言、照片、檢舉與封鎖紀錄。用途是提供好友與市集功能及維護安全。',
        '技術資料：推播訂閱資訊、提醒設定與發送紀錄、桌面小工具權杖的雜湊值，以及服務商記錄的連線資料（例如 IP 位址）。用途是傳送通知與維持服務運作。',
        '回饋內容：你主動送出的意見文字。用途是改善服務與回覆問題。',
      ] },
      { heading: '只留在裝置上的資料', body: [
        '訪客模式的資料、校園助理對話、語言與外觀設定只存在你的裝置。校園助理與課表圖片辨識都在裝置上處理，不會上傳；但你確認匯入後的課程，在登入狀態下會同步到雲端。',
        '「我的位置」只在你按下後才取得定位，定位座標不會傳到本服務的伺服器。不過地圖移到你所在區域時，會向地圖圖磚服務請求該區域的圖片，對方可能因此得知大致範圍。',
      ] },
      { heading: '分享給誰', body: [
        '我們不販售資料，也不用於廣告。下列服務商會依功能處理資料：',
        'Supabase（帳號、資料庫、市集照片）、Vercel（網站與伺服器功能）、Open-Meteo（以固定的校園座標查詢天氣）、OpenStreetMap（地圖圖磚）、Google Fonts（字型）、Google 地圖（僅在你點開導航時）、Apple／Google／Mozilla／Microsoft 的推播服務（傳送加密通知）。',
        '你的好友看得到你的課表，但看不到備註。市集貼文與留言所有登入使用者都看得到；貼文照片使用公開連結，知道網址的人即使未登入也能開啟。',
      ] },
      { heading: '保存與刪除', body: [
        '資料保存到你刪除或刪除帳號為止。提醒發送紀錄約保存三天。刪除帳號時，個人資料、貼文、留言與照片會一併刪除；你送出的意見內容與管理紀錄可能保留，但不再連結到帳號，請勿在其中留下個資。',
        '服務商的備份與系統紀錄依其政策保存，會在其週期後移除。',
      ] },
      { heading: '你的權利', body: ['依個人資料保護法，你可以查詢、閱覽、請求複本、補充更正、停止蒐集利用或請求刪除個人資料。多數操作可在「我的」完成，也可以來信聯絡。', '不提供 Email 就無法建立帳號，但仍可用訪客模式使用課表、待辦與校園助理。'] },
      { heading: '年齡', body: ['本服務以大專院校學生為對象，不針對未滿 13 歲兒童。若發現未滿 13 歲者的資料，請聯絡我們刪除。'] },
      { heading: '政策更新', body: ['政策有重大變更時，會在 App 內公告並更新本頁日期。'] },
    ] },
    terms: { title: '服務條款', sections: [
      { heading: '服務內容', body: ['TKU Campus OS 提供課表、待辦、校園資訊、好友與二手市集功能。本服務非淡江大學官方服務；校園資訊僅供參考，成績、學籍與規定請以學校公告為準。'] },
      { heading: '帳號', body: ['請提供正確資料並保管好帳號。你要為帳號下的行為負責。'] },
      { heading: '禁止的內容與行為', body: [
        '不得張貼或進行：違法內容、違禁品、藥品、武器、盜版、考試答案、代寫代考、色情或性剝削內容、未經同意的私密影像、仇恨、騷擾、霸凌、詐騙、垃圾訊息，或公開他人個資。',
        '對不當內容與濫用行為採零容忍。',
      ] },
      { heading: '檢舉與處理', body: [
        '你可以在 App 內檢舉貼文、留言與使用者，也可以封鎖使用者。被三位以上使用者檢舉的內容會先隱藏等待審查。',
        `我們會在 3 個工作天內審查檢舉，並可移除內容、停權或終止違規帳號。`,
      ] },
      { heading: '二手市集', body: ['平台不經手金錢，也不是交易的一方。商品真偽、品質與付款由雙方自行負責。請在校內公開場所面交，當面確認後再付款。'] },
      { heading: '你的內容', body: ['內容的權利仍屬於你。你同意我們為了顯示與營運服務而儲存及呈現這些內容。請勿上傳你沒有權利使用的內容。'] },
      { heading: '服務與責任', body: ['本服務依現狀提供，可能中斷或變更，提醒也可能延遲或未送達，重要事項請自行確認。在法律允許範圍內，對因使用本服務造成的間接損失不負責任。'] },
      { heading: '終止與適用法律', body: ['你可以隨時刪除帳號。本條款適用中華民國法律。'] },
    ] },
    support: { title: '聯絡與支援', sections: [
      { heading: '聯絡我們', body: ['問題回報、隱私請求與不當內容申訴都可以來信，我們會在 3 個工作天內回覆。緊急或涉及人身安全的情況，請直接聯絡校方或警方。'] },
      { heading: '在 App 內檢舉', body: ['開啟貼文或留言，點「檢舉」；要避開某位使用者，點「封鎖」。'] },
    ] },
    delete: { title: '刪除帳號', sections: [
      { heading: '在 App 內刪除', body: ['登入後到「我的」，點「刪除帳號」並確認。帳號、課表、待辦、好友關係、貼文、留言與照片會立即永久刪除，無法復原。'] },
      { heading: '無法登入時', body: ['請用註冊的 Email 來信並註明「刪除 TKU Campus OS 帳號」，我們會確認身分後在 7 天內處理。'] },
      { heading: '會保留的資料', body: ['你送出的意見內容與管理紀錄可能保留以維護安全，但不再連結到帳號。服務商的備份會在其週期後移除。'] },
    ] },
  },
  en: {
    privacy: { title: 'Privacy Policy', sections: [
      { heading: 'Who handles your data', body: ['TKU Campus OS is run by a student as a personal project. It is not an official Tamkang University service and has no university authorization. See Contact & Support for how to reach us.'] },
      { heading: 'What we collect and why', body: [
        'Account: email, password (handled by Supabase Auth), nickname, department, year, friend code. Used for sign-in and identifying your account.',
        'Study data: semesters, courses, instructors, rooms, periods, notes, assignments, exams, private events and bookmarks. Used to provide your schedule, tasks and reminders.',
        'Social data: friendships, market posts, prices, comments, photos, reports and blocks. Used for friends, the market and safety.',
        'Technical data: push subscription details, reminder settings and delivery records, a hash of your widget token, and connection data logged by providers such as IP address. Used to deliver notifications and run the service.',
        'Feedback: text you choose to send. Used to improve the service and reply to you.',
      ] },
      { heading: 'Data that stays on your device', body: [
        'Guest data, campus assistant conversations, and language and appearance settings stay on your device. The assistant and timetable image reading run on your device; courses you confirm are synced when you are signed in.',
        'My Location only runs after you tap it, and coordinates are not sent to our servers. When the map moves to your area it requests map images for that area, so the map tile provider may learn your rough location.',
      ] },
      { heading: 'Who receives data', body: [
        'We do not sell data or use it for advertising. These providers process data for specific features:',
        'Supabase (accounts, database, market photos), Vercel (website and server functions), Open-Meteo (weather for fixed campus coordinates), OpenStreetMap (map tiles), Google Fonts (fonts), Google Maps (only when you open directions), and Apple, Google, Mozilla or Microsoft push services (encrypted notifications).',
        'Friends can see your schedule but not your notes. Market posts and comments are visible to all signed-in users. Post photos use public links, so anyone with the address can open them without signing in.',
      ] },
      { heading: 'Retention and deletion', body: [
        'We keep data until you delete it or your account. Reminder delivery records are kept for about three days. Deleting your account removes your personal data, posts, comments and photos. Feedback text and moderation records may remain without a link to your account, so please leave personal details out of them.',
        'Provider backups and system logs are kept under their own policies and expire on their schedules.',
      ] },
      { heading: 'Your rights', body: ['Under Taiwan’s Personal Data Protection Act you can ask to review, copy, correct, stop using or delete your personal data. Most of this can be done under Me, or contact us.', 'An email is needed for an account. Guest mode still gives you the schedule, tasks and campus assistant.'] },
      { heading: 'Age', body: ['The service is intended for college students and is not directed at children under 13. If you find data from a child under 13, contact us to delete it.'] },
      { heading: 'Changes', body: ['We will announce major changes in the app and update the date on this page.'] },
    ] },
    terms: { title: 'Terms of Service', sections: [
      { heading: 'The service', body: ['TKU Campus OS offers schedules, tasks, campus information, friends and a second-hand market. It is not an official Tamkang University service. Campus information is for reference; rely on university notices for grades, enrollment and rules.'] },
      { heading: 'Your account', body: ['Provide accurate details and keep your account secure. You are responsible for what happens under it.'] },
      { heading: 'Prohibited content and conduct', body: [
        'Do not post or do any of the following: illegal content, prohibited goods, drugs, weapons, pirated material, exam answers, paid assignment or exam taking, pornographic or sexually exploitative content, nonconsensual intimate images, hate, harassment, bullying, scams, spam, or other people’s private information.',
        'We have zero tolerance for objectionable content and abusive users.',
      ] },
      { heading: 'Reports and enforcement', body: [
        'You can report posts, comments and users in the app and block users. Content reported by three or more people is hidden until reviewed.',
        'We review reports within 3 business days and may remove content, or suspend or end accounts that break these terms.',
      ] },
      { heading: 'Second-hand market', body: ['We do not handle money and are not a party to any transaction. Buyers and sellers are responsible for goods and payment. Meet in a public place on campus and check items before paying.'] },
      { heading: 'Your content', body: ['You keep the rights to your content and allow us to store and show it to run the service. Do not upload content you have no right to use.'] },
      { heading: 'Availability and liability', body: ['The service is provided as is. It may change or stop, and reminders can be late or missing, so check anything important yourself. To the extent the law allows, we are not liable for indirect losses from using it.'] },
      { heading: 'Ending and governing law', body: ['You can delete your account at any time. These terms are governed by the laws of the Republic of China (Taiwan).'] },
    ] },
    support: { title: 'Contact & Support', sections: [
      { heading: 'Contact us', body: ['Email us about problems, privacy requests or objectionable content. We reply within 3 business days. In an emergency or if someone’s safety is at risk, contact the university or the police directly.'] },
      { heading: 'Report in the app', body: ['Open a post or comment and tap Report. To avoid someone, tap Block.'] },
    ] },
    delete: { title: 'Delete Your Account', sections: [
      { heading: 'In the app', body: ['Sign in, go to Me, tap Delete account and confirm. Your account, schedule, tasks, friendships, posts, comments and photos are deleted permanently right away.'] },
      { heading: 'If you cannot sign in', body: ['Email us from your registered address with the subject “Delete TKU Campus OS account”. We will confirm it is you and finish within 7 days.'] },
      { heading: 'What may remain', body: ['Feedback text and moderation records may remain for safety, with no link to your account. Provider backups expire on their own schedules.'] },
    ] },
  },
};
