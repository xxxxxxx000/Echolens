/**
 * EchoLens Internationalization (i18n) Engine
 * Supports English, Spanish, French, German, Hindi, Japanese, Chinese, Portuguese, Italian, Arabic
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸', ttsCode: 'en' },
  { code: 'es', name: 'Español', flag: '🇪🇸', ttsCode: 'es' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', ttsCode: 'fr' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪', ttsCode: 'de' },
  { code: 'hi', name: 'हिन्दी', flag: '🇮🇳', ttsCode: 'hi' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', ttsCode: 'ja' },
  { code: 'zh', name: '中文 (Mandarin)', flag: '🇨🇳', ttsCode: 'zh' },
  { code: 'pt', name: 'Português', flag: '🇧🇷', ttsCode: 'pt' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹', ttsCode: 'it' },
  { code: 'ar', name: 'العربية', flag: '🇸🇦', ttsCode: 'ar' },
];

export const OBJECT_TRANSLATIONS = {
  person: {
    en: 'person', es: 'persona', fr: 'personne', de: 'Person',
    hi: 'व्यक्ति', ja: '人', zh: '人', pt: 'pessoa', it: 'persona', ar: 'شخص'
  },
  chair: {
    en: 'chair', es: 'silla', fr: 'chaise', de: 'Stuhl',
    hi: 'कुर्सी', ja: '椅子', zh: '椅子', pt: 'cadeira', it: 'sedia', ar: 'كرسي'
  },
  couch: {
    en: 'couch', es: 'sofá', fr: 'canapé', de: 'Sofa',
    hi: 'सोफ़ा', ja: 'ソファ', zh: '沙发', pt: 'sofá', it: 'divano', ar: 'أريكة'
  },
  bench: {
    en: 'bench', es: 'banco', fr: 'banc', de: 'Bank',
    hi: 'बेंच', ja: 'ベンチ', zh: '长凳', pt: 'banco', it: 'panchina', ar: 'مقعد'
  },
  bed: {
    en: 'bed', es: 'cama', fr: 'lit', de: 'Bett',
    hi: 'बिस्तर', ja: 'ベッド', zh: '床', pt: 'cama', it: 'letto', ar: 'سرير'
  },
  'dining table': {
    en: 'table', es: 'mesa', fr: 'table', de: 'Tisch',
    hi: 'मेज़', ja: '机', zh: '桌子', pt: 'mesa', it: 'tavolo', ar: 'طاولة'
  },
  'potted plant': {
    en: 'plant', es: 'planta', fr: 'plante', de: 'Pflanze',
    hi: 'पौधा', ja: '植物', zh: '植物', pt: 'planta', it: 'pianta', ar: 'نبات'
  },
  laptop: {
    en: 'laptop', es: 'portátil', fr: 'ordinateur portable', de: 'Laptop',
    hi: 'लैपटॉप', ja: 'ノートパソコン', zh: '笔记本电脑', pt: 'laptop', it: 'portatile', ar: 'حاسوب محمول'
  },
  tv: {
    en: 'TV', es: 'televisor', fr: 'télévision', de: 'Fernseher',
    hi: 'टीवी', ja: 'テレビ', zh: '电视', pt: 'televisão', it: 'televisione', ar: 'تلفاز'
  },
  book: {
    en: 'book', es: 'libro', fr: 'livre', de: 'Buch',
    hi: 'किताब', ja: '本', zh: '书', pt: 'livro', it: 'libro', ar: 'كتاب'
  },
  backpack: {
    en: 'backpack', es: 'mochila', fr: 'sac à dos', de: 'Rucksack',
    hi: 'बैग', ja: 'リュック', zh: '背包', pt: 'mochila', it: 'zaino', ar: 'حقيبة ظهر'
  },
  bottle: {
    en: 'bottle', es: 'botella', fr: 'bouteille', de: 'Flasche',
    hi: 'बोतल', ja: 'ボトル', zh: '瓶子', pt: 'garrafa', it: 'bottiglia', ar: 'زجاجة'
  },
  cup: {
    en: 'cup', es: 'taza', fr: 'tasse', de: 'Tasse',
    hi: 'कप', ja: 'カップ', zh: '杯子', pt: 'xícara', it: 'tazza', ar: 'كوب'
  },
  dog: {
    en: 'dog', es: 'perro', fr: 'chien', de: 'Hund',
    hi: 'कुत्ता', ja: '犬', zh: '狗', pt: 'cachorro', it: 'cane', ar: 'كلب'
  },
  cat: {
    en: 'cat', es: 'gato', fr: 'chat', de: 'Katze',
    hi: 'बिल्ली', ja: '猫', zh: '猫', pt: 'gato', it: 'gatto', ar: 'قطة'
  },
  car: {
    en: 'car', es: 'coche', fr: 'voiture', de: 'Auto',
    hi: 'कार', ja: '車', zh: '汽车', pt: 'carro', it: 'auto', ar: 'سيارة'
  },
  bus: {
    en: 'bus', es: 'autobús', fr: 'bus', de: 'Bus',
    hi: 'बस', ja: 'バス', zh: '公交车', pt: 'ônibus', it: 'autobus', ar: 'حافلة'
  },
};

export const DIRECTIONS = {
  left: {
    en: 'on your left', es: 'a tu izquierda', fr: 'à votre gauche', de: 'links von Ihnen',
    hi: 'बाईं ओर', ja: '左側', zh: '在你的左边', pt: 'à sua esquerda', it: 'alla tua sinistra', ar: 'على يسارك'
  },
  right: {
    en: 'on your right', es: 'a tu derecha', fr: 'à votre droite', de: 'rechts von Ihnen',
    hi: 'दाईं ओर', ja: '右側', zh: '在你的右边', pt: 'à sua direita', it: 'alla tua destra', ar: 'على يمينك'
  },
  ahead: {
    en: 'ahead', es: 'al frente', fr: 'devant', de: 'geradeaus',
    hi: 'आगे', ja: '正面', zh: '正前方', pt: 'à frente', it: 'davanti', ar: 'أمامك'
  },
};

export const UI_STRINGS = {
  listenTab: {
    en: 'Listen', es: 'Escuchar', fr: 'Écouter', de: 'Hören',
    hi: 'सुनें', ja: '聴く', zh: '聆听', pt: 'Ouvir', it: 'Ascolta', ar: 'استمع'
  },
  readTab: {
    en: 'Read', es: 'Leer', fr: 'Lire', de: 'Lesen',
    hi: 'पढ़ें', ja: '読む', zh: '阅读', pt: 'Ler', it: 'Leggi', ar: 'اقرأ'
  },
  findTab: {
    en: 'Find', es: 'Buscar', fr: 'Trouver', de: 'Finden',
    hi: 'खोजें', ja: '探す', zh: '寻找', pt: 'Buscar', it: 'Trova', ar: 'ابحث'
  },
  mapTab: {
    en: 'Map', es: 'Mapa', fr: 'Carte', de: 'Karte',
    hi: 'नक्शा', ja: '地図', zh: '地图', pt: 'Mapa', it: 'Mappa', ar: 'الخريطة'
  },
  settingsTab: {
    en: 'Settings', es: 'Ajustes', fr: 'Réglages', de: 'Einstellungen',
    hi: 'सेटिंग्स', ja: '設定', zh: '设置', pt: 'Ajustes', it: 'Impostazioni', ar: 'الإعدادات'
  },
  startListening: {
    en: 'Start Listening', es: 'Iniciar escucha', fr: 'Démarrer l\'écoute', de: 'Hören starten',
    hi: 'सुनना शुरू करें', ja: '聴覚を開始', zh: '开始感知', pt: 'Iniciar escuta', it: 'Inizia ascolto', ar: 'ابدأ الاستماع'
  },
  stopListening: {
    en: 'Stop Listening', es: 'Detener escucha', fr: 'Arrêter l\'écoute', de: 'Hören stoppen',
    hi: 'सुनना बंद करें', ja: '聴覚を停止', zh: '停止感知', pt: 'Parar escuta', it: 'Ferma ascolto', ar: 'إيقاف الاستماع'
  },
  noObject: {
    en: 'No object detected', es: 'Ningún objeto detectado', fr: 'Aucun objet détecté', de: 'Kein Objekt erkannt',
    hi: 'कोई वस्तु नहीं मिली', ja: '物体は検出されません', zh: '未检测到物体', pt: 'Nenhum objeto detectado', it: 'Nessun oggetto rilevato', ar: 'لم يتم رصد أي جسم'
  },
  standbySub: {
    en: 'Start listening or run the guided demo.',
    es: 'Inicia la escucha o ejecuta la demostración.',
    fr: 'Démarrez l\'écoute ou lancez la démonstration.',
    de: 'Starten Sie das Hören oder die Demo.',
    hi: 'सुनना शुरू करें या डेमो चलाएं।',
    ja: '聴覚を開始するか、デモを実行してください。',
    zh: '开始感知或播放演示。',
    pt: 'Inicie a escuta ou reproduza a demonstração.',
    it: 'Inizia l\'ascolto o avvia la demo guidata.',
    ar: 'ابدأ الاستماع أو قم بتشغيل العرض التوضيحي.'
  },
  limitsNotice: {
    en: 'EchoLens is not a cane. It names supported objects and places them left or right. If you hear nothing, I do not see a supported object. Hold the phone facing forward.',
    es: 'EchoLens no es un bastón. Nombra objetos y los ubica a la izquierda o derecha. Si no escuchas nada, no veo un objeto compatible. Sostén el teléfono hacia adelante.',
    fr: 'EchoLens n\'est pas une canne. Il nomme les objets et les place à gauche ou à droite. Si vous n\'entendez rien, aucun objet n\'est détecté. Tenez le téléphone vers l\'avant.',
    de: 'EchoLens ist kein Blindenstock. Es nennt Objekte links oder rechts. Wenn Sie nichts hören, wird kein Objekt erkannt. Halten Sie das Telefon nach vorne.',
    hi: 'इको लेंस छड़ी का विकल्प नहीं है। यह वस्तुओं को पहचान कर बाएं या दाएं बताता है। फोन को आगे की ओर रखें।',
    ja: 'EchoLensは白杖の代わりではありません。検出された物体を左右の音で知らせます。電話を前に向けて保持してください。',
    zh: 'EchoLens不是手杖。它会播报物体并提示左右方位。若无声音表示未检测到物体。请将手机朝前握持。',
    pt: 'EchoLens não é uma bengala. Ele identifica objetos e posiciona à esquerda ou à direita. Mantenha o telefone apontado para frente.',
    it: 'EchoLens non è un bastone. Nomina gli oggetti e li posiziona a sinistra o destra. Tieni il telefono rivolto in avanti.',
    ar: 'إيكو لينز ليس عكازاً. يقوم بتسمية الأجسام وتحديد موقعها يساراً أو يميناً. وجّه الهاتف للأمام.'
  }
};

let currentLang = localStorage.getItem('echolens_lang') || 'en';

export function getLanguage() {
  return currentLang;
}

export function setLanguage(code) {
  if (SUPPORTED_LANGUAGES.some(l => l.code === code)) {
    currentLang = code;
    localStorage.setItem('echolens_lang', code);
  }
  return currentLang;
}

export function getTTSCode() {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === currentLang);
  return lang ? lang.ttsCode : 'en';
}

export function translateObject(label) {
  return OBJECT_TRANSLATIONS[label]?.[currentLang] || OBJECT_TRANSLATIONS[label]?.['en'] || label;
}

export function translateDirection(side) {
  return DIRECTIONS[side]?.[currentLang] || DIRECTIONS[side]?.['en'] || side;
}

export function formatCue(objectLabel, side, distanceMeters) {
  const name = translateObject(objectLabel);
  const dir = translateDirection(side);
  const d = Math.round(distanceMeters * 10) / 10;

  switch (currentLang) {
    case 'es':
      return `${name} ${dir}, a ${d} metros`;
    case 'fr':
      return `${name} ${dir}, à ${d} mètres`;
    case 'de':
      return `${name} ${dir}, ${d} Meter`;
    case 'hi':
      return `${dir} ${name}, ${d} मीटर`;
    case 'ja':
      return `${dir}に${name}、${d}メートル`;
    case 'zh':
      return `${dir}有${name}，距离${d}米`;
    case 'pt':
      return `${name} ${dir}, a ${d} metros`;
    case 'it':
      return `${name} ${dir}, a ${d} metri`;
    case 'ar':
      return `${name} ${dir}، على بعد ${d} أمتار`;
    default:
      return `${name} ${dir}, ${d} meters`;
  }
}

export function t(key) {
  return UI_STRINGS[key]?.[currentLang] || UI_STRINGS[key]?.['en'] || key;
}
