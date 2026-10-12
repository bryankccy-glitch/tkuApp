/**
 * Translations. 目前覆蓋：首頁 Hero、天氣、問候語、快捷操作、語言設定與天氣錯誤訊息。
 * 其他頁面仍為繁體中文硬編字串，逐步遷移（見 ROADMAP.md）。
 */
export const resources = {
  'zh-TW': {
    translation: {
      greeting: {
        morning: { title: '早安', line: '今天也在淡江展開新的一天。' },
        noon: { title: '午安', line: '下一堂課準備好了嗎？' },
        afternoon: { title: '午後好', line: '今天也在淡江過得充實嗎？' },
        evening: { title: '晚安', line: '今天辛苦了。' },
        withName: '{{greeting}}，{{name}}',
      },
      weather: {
        place: '淡水',
        feelsLike: '體感 {{value}}°',
        humidity: '濕度 {{value}}%',
        loading: '取得淡水天氣中',
        unavailable: '暫時無法取得天氣',
        offline: '目前離線，天氣未更新',
        stale: '天氣資料未更新（{{time}}）',
        updatedAt: '{{time}} 更新',
        source: '天氣資料：Open-Meteo',
        condition: {
          clear: '晴朗',
          mostlyClear: '晴時多雲',
          partly: '多雲時晴',
          overcast: '陰天',
          fog: '起霧',
          drizzle: '毛毛雨',
          rain: '下雨',
          showers: '陣雨',
          thunder: '雷雨',
          snow: '下雪',
        },
        scene: { sunny: '晴天', cloudy: '多雲', rainy: '下雨', sunset: '夕陽', night: '夜晚' },
      },
      hero: {
        sceneLabel: '淡江大橋像素動畫：{{scene}}',
        summary: {
          none: '今天沒有課。',
          allDone: '今天的 {{count}} 堂課都上完了。',
          remaining: '今天有 {{count}} 堂課，還剩 {{left}} 堂。',
          dueToday: '{{count}} 項待辦今天到期。',
        },
      },
      quick: { nextClass: '下一堂課', today: '今日課表', findRoom: '找教室', events: '校園活動', tasks: '待辦事項', label: '快捷操作' },
      settings: { language: '語言', zh: '繁體中文', en: 'English' },
    },
  },
  en: {
    translation: {
      greeting: {
        morning: { title: 'Good morning', line: 'A new day at Tamkang begins.' },
        noon: { title: 'Good day', line: 'Ready for your next class?' },
        afternoon: { title: 'Good afternoon', line: 'Having a fulfilling day at Tamkang?' },
        evening: { title: 'Good evening', line: 'You worked hard today.' },
        withName: '{{greeting}}, {{name}}',
      },
      weather: {
        place: 'Tamsui',
        feelsLike: 'Feels {{value}}°',
        humidity: 'Humidity {{value}}%',
        loading: 'Getting Tamsui weather',
        unavailable: 'Weather unavailable',
        offline: 'Offline — weather not updated',
        stale: 'Weather not updated ({{time}})',
        updatedAt: 'Updated {{time}}',
        source: 'Weather: Open-Meteo',
        condition: {
          clear: 'Sunny',
          mostlyClear: 'Mostly sunny',
          partly: 'Partly cloudy',
          overcast: 'Cloudy',
          fog: 'Foggy',
          drizzle: 'Drizzle',
          rain: 'Rainy',
          showers: 'Showers',
          thunder: 'Thunderstorm',
          snow: 'Snow',
        },
        scene: { sunny: 'Sunny', cloudy: 'Cloudy', rainy: 'Rainy', sunset: 'Sunset', night: 'Night' },
      },
      hero: {
        sceneLabel: 'Pixel art Tamkang Bridge: {{scene}}',
        summary: {
          none: 'No classes today.',
          allDone: 'All {{count}} classes are done for today.',
          remaining: '{{count}} classes today, {{left}} to go.',
          dueToday: '{{count}} tasks due today.',
        },
      },
      quick: { nextClass: 'Next Class', today: "Today's Classes", findRoom: 'Find a Classroom', events: 'Campus Events', tasks: 'To-dos', label: 'Quick actions' },
      settings: { language: 'Language', zh: '繁體中文', en: 'English' },
    },
  },
} as const;
