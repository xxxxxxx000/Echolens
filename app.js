/**
 * EchoLens — indoor stereo object cues.
 * Names supported COCO objects and pans them left/right.
 * Not a cane. Silence does not mean the path is clear.
 */

import './style.css';
import { recognizeText, decodeBarcode, nameColor } from './tools.js';
import {
  SUPPORTED_LANGUAGES,
  getLanguage,
  setLanguage,
  getTTSCode,
  translateObject,
  translateDirection,
  formatCue,
  t,
} from './i18n.js';
import {
  startLocationWatch,
  reverseGeocode,
  nearbyPlaces,
  initLeafletMap,
  updateLeafletMarker,
  getLastFix,
  getLastAddress,
  getLastPlaces,
  getSavedGoogleKey,
  saveGoogleKey,
  loadGoogleMaps,
  initGoogleMap,
  updateGoogleMarker,
  googleNearby,
  bearingFromTo,
  distanceBetween,
  initMiniMap,
  updateMiniMapMarker,
} from './maps.js';

let model = null;
let isModelLoading = true;
let isListening = false;
let isMuted = false;
let isHapticEnabled = true;
let isDemoMode = false;
let isVoiceEnabled = false;
let currentAudioProfile = 'standard';
let activeHomingTarget = null;
let facingMode = 'environment';
let activeStream = null;
let animationFrameId = null;
let sonarTimeoutId = null;
let demoTimeoutId = null;
let homingTimeoutId = null;
let isDetecting = false;
let isCameraPreviewEnabled = true;
let volumeSetting = 60;
let confidenceThreshold = 0.55;
let recognition = null;
let lastEmptySpeakAt = 0;
let lastSpokenKey = '';
let lastSpokenAt = 0;
let lastClose = false;
let mapReady = false;
let useGoogleMaps = false;
let lastGeocodeAt = 0;

/* AR camera overlay state */
let isARMode = false;
let arCameraStream = null;
let arCompassHeading = null;
let arOrientationHandler = null;
let arRenderRAF = null;
let arPlacesCache = [];
let miniMapReady = false;

const MAX_GAIN = 0.7;
const EMPTY_COOLDOWN_MS = 12000;
const SPEAK_COOLDOWN_MS = 6000;

let audioCtx = null;
let mainGainNode = null;
let closestObject = null;
let currentItems = [];
const objectTracks = new Map();
const TRACK_TTL_MS = 1800;

const PEOPLE = new Set(['person']);
const FURNITURE = new Set([
  'chair', 'couch', 'bench', 'bed', 'dining table', 'potted plant',
  'laptop', 'tv', 'book', 'backpack', 'suitcase', 'handbag', 'bottle', 'cup',
]);
const VEHICLES = new Set(['car', 'truck', 'bus', 'motorcycle', 'bicycle', 'train']);

const PROFILES = {
  person: { family: 'person', tone: 420, wave: 'sine', label: 'person' },
  chair: { family: 'furniture', tone: 520, wave: 'triangle', label: 'chair' },
  couch: { family: 'furniture', tone: 400, wave: 'triangle', label: 'couch' },
  bench: { family: 'furniture', tone: 500, wave: 'triangle', label: 'bench' },
  bed: { family: 'furniture', tone: 380, wave: 'triangle', label: 'bed' },
  'dining table': { family: 'furniture', tone: 460, wave: 'triangle', label: 'table' },
  'potted plant': { family: 'furniture', tone: 540, wave: 'sine', label: 'plant' },
  laptop: { family: 'furniture', tone: 580, wave: 'triangle', label: 'laptop' },
  tv: { family: 'furniture', tone: 360, wave: 'triangle', label: 'tv' },
  book: { family: 'furniture', tone: 620, wave: 'sine', label: 'book' },
  backpack: { family: 'furniture', tone: 500, wave: 'triangle', label: 'bag' },
  suitcase: { family: 'furniture', tone: 480, wave: 'triangle', label: 'suitcase' },
  handbag: { family: 'furniture', tone: 510, wave: 'triangle', label: 'bag' },
  bottle: { family: 'furniture', tone: 640, wave: 'sine', label: 'bottle' },
  cup: { family: 'furniture', tone: 680, wave: 'sine', label: 'cup' },
  dog: { family: 'person', tone: 340, wave: 'sine', label: 'dog' },
  cat: { family: 'person', tone: 600, wave: 'sine', label: 'cat' },
  car: { family: 'vehicle', tone: 200, wave: 'sawtooth', label: 'vehicle' },
  truck: { family: 'vehicle', tone: 180, wave: 'sawtooth', label: 'vehicle' },
  bus: { family: 'vehicle', tone: 190, wave: 'sawtooth', label: 'bus' },
  motorcycle: { family: 'vehicle', tone: 240, wave: 'sawtooth', label: 'motorcycle' },
  bicycle: { family: 'vehicle', tone: 280, wave: 'sawtooth', label: 'bicycle' },
};

const HEIGHTS = {
  person: 1.7, chair: 0.85, couch: 0.85, bench: 0.8, bed: 0.6, 'dining table': 0.75,
  'potted plant': 0.6, laptop: 0.25, tv: 0.65, book: 0.22, backpack: 0.45,
  bottle: 0.25, cup: 0.12, car: 1.45, bus: 3, dog: 0.55, cat: 0.28,
};

const CHIP_ICON = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
const FIND_TARGETS = [
  { id: 'person', label: 'Person' },
  { id: 'chair', label: 'Chair' },
  { id: 'couch', label: 'Couch' },
  { id: 'dining table', label: 'Table' },
  { id: 'bottle', label: 'Bottle' },
  { id: 'cup', label: 'Cup' },
  { id: 'laptop', label: 'Laptop' },
  { id: 'backpack', label: 'Bag' },
  { id: 'book', label: 'Book' },
  { id: 'tv', label: 'TV' },
];

const LIMITS = 'EchoLens is not a cane. It names supported objects and places them left or right. If you hear nothing, I do not see a supported object. Hold the phone facing forward. Open-ear or one earbud recommended.';

let webcam, canvas, ctx;
let statusDot, statusText, btnStart, btnDemo, btnMute, btnInfo;
let primaryKicker, primaryTitle, primarySub, radarPills, radarStage;
let volumeControl, volumeVal, profileSelect, btnHaptic, btnPreview, btnSwitch;
let findInput, findChips, homingKicker, homingTitle, homingSub;

window.addEventListener('DOMContentLoaded', init);

let availableVoices = [];
let selectedVoice = null;
let voiceTone = localStorage.getItem('echolens_voice_tone') || 'crisp';

function getToneSettings() {
  switch (voiceTone) {
    case 'crisp':
      return { pitch: 1.15, rate: 1.06 }; // Bright, simple, clear, not too deep
    case 'natural':
      return { pitch: 1.05, rate: 1.03 };
    case 'gentle':
      return { pitch: 1.0, rate: 0.98 };
    default:
      return { pitch: 1.12, rate: 1.05 };
  }
}

function initVoices() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const updateVoices = () => {
    availableVoices = window.speechSynthesis.getVoices();
    if (!availableVoices.length) return;
    
    // Filter out ugly, raspy or overly deep legacy voices
    const isBadVoice = (v) => /(Desktop|Hazel|Hedda|Zira|David|Mark|George)/i.test(v.name);
    
    // Preferred clean, bright, clear voices
    const preferredNames = [
      'Google US English', 'Google UK English Female', 'Microsoft Aria Online',
      'Microsoft Jenny Online', 'Microsoft Guy Online', 'Samantha', 'Karen',
      'Daniel', 'en-US', 'en-GB'
    ];

    const lang = getLanguage();
    const langVoices = availableVoices.filter(v => v.lang.startsWith(lang) && !isBadVoice(v));
    const allCleanVoices = availableVoices.filter(v => !isBadVoice(v));
    
    if (!selectedVoice || !selectedVoice.lang.startsWith(lang)) {
      selectedVoice = langVoices.find(v => preferredNames.some(p => v.name.includes(p))) 
        || langVoices[0] 
        || allCleanVoices.find(v => preferredNames.some(p => v.name.includes(p)))
        || allCleanVoices[0]
        || availableVoices[0];
    }
    
    const voiceSelect = document.getElementById('voice-select');
    const voicePopover = document.getElementById('voice-popover');
    const voiceTriggerText = document.getElementById('voice-trigger-text');
    const displayVoices = langVoices.length ? langVoices : allCleanVoices;

    if (voiceSelect) {
      voiceSelect.innerHTML = displayVoices
        .map(v => `<option value="${v.name}" ${selectedVoice && v.name === selectedVoice.name ? 'selected' : ''}>${v.name} (${v.lang})</option>`)
        .join('');
    }

    if (voicePopover) {
      voicePopover.innerHTML = displayVoices
        .map(v => {
          const isSel = selectedVoice && v.name === selectedVoice.name;
          const cleanLabel = v.name.replace(/Microsoft |Google /g, '');
          return `<button type="button" class="popover-item ${isSel ? 'selected' : ''}" data-value="${v.name}">
            <span>🗣️ ${cleanLabel}</span>
            <span class="popover-check">✓</span>
          </button>`;
        })
        .join('');
    }

    if (selectedVoice && voiceTriggerText) {
      voiceTriggerText.textContent = '🗣️ ' + selectedVoice.name.replace(/Microsoft |Google /g, '');
    }
  };

  updateVoices();
  window.speechSynthesis.onvoiceschanged = updateVoices;
}

function initHudMiniMap() {
  const container = document.getElementById('hud-mini-map');
  if (!container) return;
  initMiniMap(container, 'hud');

  startLocationWatch(
    async (fix) => {
      updateMiniMapMarker(fix.lat, fix.lon);
      const accText = document.getElementById('hud-gps-text');
      if (accText) accText.textContent = `GPS ±${Math.round(fix.accuracy || 10)}m`;

      try {
        const addrObj = await reverseGeocode(fix.lat, fix.lon);
        const name = addrObj.address?.road || addrObj.address?.suburb || addrObj.address?.city || addrObj.display_name?.split(',')[0] || 'Live Location';
        const streetEl = document.getElementById('hud-street-name');
        if (streetEl) streetEl.textContent = name;
      } catch {
        const streetEl = document.getElementById('hud-street-name');
        if (streetEl) streetEl.textContent = `${fix.lat.toFixed(4)}°, ${fix.lon.toFixed(4)}°`;
      }
    },
    (err) => {
      console.warn('GPS watch notice:', err);
      const streetEl = document.getElementById('hud-street-name');
      if (streetEl) streetEl.textContent = 'GPS offline / estimating';
    }
  );

  document.getElementById('btn-hud-speak-loc')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const lastAddr = getLastAddress();
    const fix = getLastFix();
    if (lastAddr) {
      speak(`Current location: ${lastAddr}`);
    } else if (fix) {
      speak(`Current coordinates: ${fix.lat.toFixed(4)} degrees latitude, ${fix.lon.toFixed(4)} degrees longitude.`);
    } else {
      speak('Acquiring satellite GPS position.');
    }
  });
}

function registerPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('PWA ServiceWorker ready:', reg.scope))
        .catch(err => console.warn('PWA registration notice:', err));
    });
  }

  let deferredInstallPrompt = null;
  const pwaBanner = document.getElementById('pwa-install-banner');
  const btnInstall = document.getElementById('btn-pwa-install');
  const btnDismiss = document.getElementById('btn-pwa-dismiss');

  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const dismissed = sessionStorage.getItem('echolens_pwa_dismissed') === 'true';

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (!isStandalone && !dismissed && pwaBanner) {
      setTimeout(() => {
        pwaBanner.classList.remove('hidden');
      }, 1800);
    }
  });

  btnInstall?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        pwaBanner?.classList.add('hidden');
      }
      deferredInstallPrompt = null;
    } else {
      speak('To install EchoLens, tap your browser menu or Share, then Add to Home Screen.');
      pwaBanner?.classList.add('hidden');
    }
  });

  btnDismiss?.addEventListener('click', () => {
    pwaBanner?.classList.add('hidden');
    sessionStorage.setItem('echolens_pwa_dismissed', 'true');
  });

  window.addEventListener('appinstalled', () => {
    pwaBanner?.classList.add('hidden');
    speak('EchoLens installed successfully.');
  });
}

async function init() {
  cache();
  initVoices();
  const greet = document.getElementById('home-greeting');
  if (greet) {
    const h = new Date().getHours();
    greet.textContent = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  }
  renderFindChips();
  bind();
  initHudMiniMap();
  registerPWA();
  await loadModel();
}

function cache() {
  webcam = document.getElementById('webcam');
  canvas = document.getElementById('canvas');
  ctx = canvas ? canvas.getContext('2d') : null;
  statusDot = document.getElementById('status-dot');
  statusText = document.getElementById('status-text');
  btnStart = document.getElementById('btn-start-listening');
  btnDemo = document.getElementById('btn-demo');
  btnMute = document.getElementById('btn-mute');
  btnInfo = document.getElementById('btn-info');
  primaryKicker = document.getElementById('primary-kicker');
  primaryTitle = document.getElementById('primary-title');
  primarySub = document.getElementById('primary-sub');
  radarPills = document.getElementById('radar-pills');
  radarStage = document.getElementById('home-radar-stage');
  volumeControl = document.getElementById('volume-control');
  volumeVal = document.getElementById('volume-val');
  profileSelect = document.getElementById('audio-profile-select');
  btnHaptic = document.getElementById('btn-haptic');
  btnPreview = document.getElementById('btn-camera-preview');
  btnSwitch = document.getElementById('btn-switch-camera');
  findInput = document.getElementById('find-input');
  findChips = document.getElementById('find-chips');
  homingKicker = document.getElementById('homing-kicker');
  homingTitle = document.getElementById('homing-title');
  homingSub = document.getElementById('homing-sub');
}

function setupCustomSelect(wrapId, triggerId, popoverId, selectId) {
  const wrap = document.getElementById(wrapId);
  const trigger = document.getElementById(triggerId);
  const popover = document.getElementById(popoverId);
  const select = document.getElementById(selectId);
  if (!wrap || !trigger || !popover) return;

  trigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.contains('open');
    document.querySelectorAll('.custom-select-wrap.open').forEach(w => {
      if (w !== wrap) w.classList.remove('open');
    });
    wrap.classList.toggle('open', !isOpen);
    trigger.setAttribute('aria-expanded', String(!isOpen));
  });

  popover.addEventListener('click', (e) => {
    const item = e.target.closest('.popover-item');
    if (!item) return;
    const val = item.getAttribute('data-value');
    
    // update trigger label
    const textSpan = trigger.querySelector('.trigger-text');
    if (textSpan) {
      const itemText = item.querySelector('span')?.textContent || item.textContent;
      textSpan.textContent = itemText.replace('✓', '').trim();
    }

    // update selected class
    popover.querySelectorAll('.popover-item').forEach(btn => {
      btn.classList.toggle('selected', btn === item);
    });

    wrap.classList.remove('open');
    trigger.setAttribute('aria-expanded', 'false');

    if (select) {
      select.value = val;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
}

function bind() {
  document.querySelectorAll('.tab-button[data-target], [data-target]').forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = tab.getAttribute('data-target');
      /* Stop AR camera when leaving the Map tab */
      if (id !== 'view-map' && isARMode) stopARMode();
      switchTab(id, tab);
      if (id === 'view-map') openMapTab();
    });
  });

  // Global click outside to dismiss all custom dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.custom-select-wrap')) {
      document.querySelectorAll('.custom-select-wrap.open').forEach(w => w.classList.remove('open'));
    }
  });

  // Initialize Custom Selects
  setupCustomSelect('lang-custom-wrap', 'lang-trigger', 'lang-popover', 'language-select');
  setupCustomSelect('tone-custom-wrap', 'tone-trigger', 'tone-popover', 'voice-tone-select');
  setupCustomSelect('voice-custom-wrap', 'voice-trigger', 'voice-popover', 'voice-select');
  setupCustomSelect('profile-custom-wrap', 'profile-trigger', 'profile-popover', 'audio-profile-select');

  // Set initial labels
  const currentL = getLanguage();
  const langItem = document.querySelector(`#lang-popover .popover-item[data-value="${currentL}"]`);
  if (langItem) {
    document.querySelectorAll('#lang-popover .popover-item').forEach(b => b.classList.toggle('selected', b === langItem));
    const lt = document.getElementById('lang-trigger-text');
    if (lt) lt.textContent = (langItem.querySelector('span')?.textContent || langItem.textContent).replace('✓', '').trim();
  }

  const toneItem = document.querySelector(`#tone-popover .popover-item[data-value="${voiceTone}"]`);
  if (toneItem) {
    document.querySelectorAll('#tone-popover .popover-item').forEach(b => b.classList.toggle('selected', b === toneItem));
    const tt = document.getElementById('tone-trigger-text');
    if (tt) tt.textContent = (toneItem.querySelector('span')?.textContent || toneItem.textContent).replace('✓', '').trim();
  }

  const langSelect = document.getElementById('language-select');
  if (langSelect) {
    langSelect.value = getLanguage();
    langSelect.addEventListener('change', (e) => {
      setLanguage(e.target.value);
      initVoices();
      renderFindChips();
      renderPrimary(closestObject);
      const confMsg = {
        en: 'Language set to English.',
        es: 'Idioma cambiado a Español.',
        fr: 'Langue définie sur le Français.',
        de: 'Sprache auf Deutsch eingestellt.',
        hi: 'भाषा हिन्दी पर सेट की गई।',
        ja: '言語を日本語に設定しました。',
        zh: '语言已设置为中文。',
        pt: 'Idioma definido para Português.',
        it: 'Lingua impostata su Italiano.',
        ar: 'تم ضبط اللغة على العربية.'
      }[e.target.value] || 'Language updated.';
      speak(confMsg);
    });
  }

  const toneSelect = document.getElementById('voice-tone-select');
  if (toneSelect) {
    toneSelect.value = voiceTone;
    toneSelect.addEventListener('change', (e) => {
      voiceTone = e.target.value;
      localStorage.setItem('echolens_voice_tone', voiceTone);
      const msg = {
        crisp: 'Voice tone set to simple and bright.',
        natural: 'Voice tone set to natural and balanced.',
        gentle: 'Voice tone set to gentle and smooth.'
      }[voiceTone] || 'Voice tone updated.';
      speak(msg);
    });
  }

  document.getElementById('voice-select')?.addEventListener('change', (e) => {
    selectedVoice = availableVoices.find(v => v.name === e.target.value) || selectedVoice;
    speak('Voice set to ' + (selectedVoice ? selectedVoice.name : 'default'));
  });

  document.getElementById('audio-profile-select')?.addEventListener('change', (e) => {
    currentAudioProfile = e.target.value;
    speak('Filter set to ' + e.target.value);
  });

  document.getElementById('btn-test-voice')?.addEventListener('click', () => {
    const sample = {
      en: 'EchoLens is ready. Detecting objects with clear spatial audio.',
      es: 'EchoLens está listo. Detectando objetos con audio espacial claro.',
      fr: 'EchoLens est prêt. Détection d\'objets avec audio spatial clair.',
      de: 'EchoLens ist bereit. Objekterkennung mit klarem Raumklang.',
      hi: 'इको लेंस तैयार है। स्पष्ट 3डी ऑडियो के साथ वस्तुओं की पहचान सक्रिय है।',
      ja: 'EchoLensの準備ができました。クリアな空間オーディオで物体を検出します。',
      zh: 'EchoLens 已就绪。正在通过清晰的空间音频感知周围环境。',
      pt: 'EchoLens está pronto. Detectando objetos com áudio espacial claro.',
      it: 'EchoLens è pronto. Rilevamento oggetti con audio spaziale chiaro.',
      ar: 'إيكو لينز جاهز. يتم رصد الأجسام بصوت مكاني واضح.'
    }[getLanguage()] || 'EchoLens is ready.';
    speak(sample);
  });

  document.getElementById('btn-speak-location')?.addEventListener('click', speakLocation);
  document.getElementById('btn-nearby')?.addEventListener('click', speakNearby);
  document.getElementById('btn-ar-speak-location')?.addEventListener('click', speakLocation);
  document.getElementById('btn-ar-nearby')?.addEventListener('click', async () => {
    await speakNearby();
    /* After nearby fetch, update AR labels */
    const places = getLastPlaces();
    if (places.length) arPlacesCache = places;
  });
  document.getElementById('btn-quick-flip-cam')?.addEventListener('click', async () => {
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    if (isListening && !isDemoMode) {
      await stopListening({ silent: true });
      await startListening();
    }
    speak(facingMode === 'user' ? 'Front camera active.' : 'Rear camera active.');
  });

  document.getElementById('btn-ar-toggle')?.addEventListener('click', () => toggleARMode());
  const gmapsInput = document.getElementById('gmaps-key');
  if (gmapsInput) gmapsInput.value = getSavedGoogleKey();
  document.getElementById('btn-save-gmaps')?.addEventListener('click', async () => {
    const key = (document.getElementById('gmaps-key')?.value || '').trim();
    saveGoogleKey(key);
    speak(key ? 'Google Maps key saved. Open the Map tab again.' : 'Using OpenStreetMap.');
    mapReady = false;
    useGoogleMaps = false;
  });

  btnStart?.addEventListener('click', () => toggleListening());
  btnDemo?.addEventListener('click', () => toggleDemo());
  btnMute?.addEventListener('click', () => toggleMute());
  btnInfo?.addEventListener('click', () => speak(LIMITS));

  document.getElementById('btn-voice-assistant')?.addEventListener('click', () => toggleVoice());
  document.getElementById('btn-voice-close')?.addEventListener('click', () => stopVoice());
  document.getElementById('btn-grant-cam')?.addEventListener('click', async () => {
    hideModal();
    await startListening();
  });
  document.getElementById('btn-modal-demo')?.addEventListener('click', () => {
    hideModal();
    startDemo();
  });
  document.getElementById('btn-close-cam-modal')?.addEventListener('click', hideModal);

  document.getElementById('btn-find-go')?.addEventListener('click', () => {
    setHomingTarget(findInput?.value || '');
  });
  findInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') setHomingTarget(findInput.value);
  });
  document.getElementById('btn-clear-find')?.addEventListener('click', () => setHomingTarget(''));
  document.getElementById('btn-read-text')?.addEventListener('click', () => runReadTool('text'));
  document.getElementById('btn-read-barcode')?.addEventListener('click', () => runReadTool('barcode'));
  document.getElementById('btn-read-color')?.addEventListener('click', () => runReadTool('color'));

  // Walkthrough Tour Listeners
  document.getElementById('btn-start-walkthrough')?.addEventListener('click', () => startTour());
  document.getElementById('btn-tour-next')?.addEventListener('click', () => nextTourStep());
  document.getElementById('btn-tour-prev')?.addEventListener('click', () => prevTourStep());
  document.getElementById('btn-tour-replay')?.addEventListener('click', () => replayTourStep());
  document.getElementById('btn-close-tour')?.addEventListener('click', () => exitTour());

  volumeControl?.addEventListener('input', (e) => {
    volumeSetting = Number(e.target.value);
    if (volumeVal) volumeVal.textContent = `${volumeSetting}%`;
    if (mainGainNode && audioCtx) mainGainNode.gain.setValueAtTime(cappedGain(), audioCtx.currentTime);
  });
  profileSelect?.addEventListener('change', (e) => {
    currentAudioProfile = e.target.value;
    speak(profileSelect.options[profileSelect.selectedIndex].text);
  });
  btnHaptic?.addEventListener('change', () => {
    isHapticEnabled = btnHaptic.checked;
    if (isHapticEnabled) haptic('tap');
  });
  btnPreview?.addEventListener('change', () => {
    isCameraPreviewEnabled = btnPreview.checked;
    applyPreview();
  });
  btnSwitch?.addEventListener('click', async () => {
    if (!isListening || isDemoMode) return;
    facingMode = facingMode === 'environment' ? 'user' : 'environment';
    await stopListening({ silent: true });
    await startListening();
  });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, textarea, select')) return;
    if (e.key === 'd' || e.key === 'D') toggleDemo();
    if (e.key === 'n' || e.key === 'N') toggleListening();
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });
}

function switchTab(id, tabEl) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  document.querySelectorAll('.tab-button, [data-target]').forEach((t) => {
    t.classList.remove('active');
    t.removeAttribute('aria-current');
  });
  document.getElementById(id)?.classList.add('active');
  if (tabEl) {
    tabEl.classList.add('active');
    tabEl.setAttribute('aria-current', 'page');
  }
}

function renderFindChips() {
  if (!findChips) return;
  findChips.innerHTML = FIND_TARGETS.map((t) => (
    `<button type="button" class="chip" data-target="${t.id}" aria-pressed="false">${CHIP_ICON}<span>${translateObject(t.id)}</span></button>`
  )).join('');
  findChips.querySelectorAll('.chip').forEach((chip) => {
    chip.addEventListener('click', () => setHomingTarget(chip.getAttribute('data-target')));
  });
}

async function loadModel() {
  setStatus('loading', 'Loading model');
  try {
    if (typeof cocoSsd === 'undefined') {
      await new Promise((resolve) => {
        const id = setInterval(() => {
          if (typeof cocoSsd !== 'undefined') { clearInterval(id); resolve(); }
        }, 80);
      });
    }
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
    isModelLoading = false;
    setStatus('ready', 'Ready');
    speak(t('limitsNotice'));
    countCameras();
  } catch (err) {
    console.error(err);
    isModelLoading = false;
    setStatus('error', 'Model failed');
    speak('The detection model failed to load. Check your connection. You can still play the guided demo.');
  }
}

function setStatus(state, text) {
  if (statusText) statusText.textContent = text;
  if (!statusDot) return;
  statusDot.className = `status-dot ${state}`;
}

function cappedGain() {
  return isMuted ? 0 : Math.min(MAX_GAIN, volumeSetting / 100);
}

function initAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    mainGainNode = audioCtx.createGain();
    mainGainNode.gain.setValueAtTime(cappedGain(), audioCtx.currentTime);
    mainGainNode.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
}

function haptic(kind) {
  if (!isHapticEnabled || !navigator.vibrate) return;
  if (kind === 'close') navigator.vibrate([70, 40, 70]);
  else if (kind === 'danger') navigator.vibrate([160, 50, 160]);
  else navigator.vibrate(30);
}

function speak(text) {
  if (!text) return;
  const live = document.getElementById('live-region');
  const announcer = document.getElementById('tts-announcer');
  if (live) live.textContent = text;
  if (announcer) announcer.textContent = text;

  if (isMuted) return;

  try {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/([0-9]+)m\b/g, '$1 meters').trim();
    const u = new SpeechSynthesisUtterance(cleanText);
    const lang = getLanguage();
    u.lang = lang;
    
    // Choose selected voice or best voice for this language
    const voiceForLang = availableVoices.find(v => v.lang.startsWith(lang));
    if (selectedVoice && selectedVoice.lang.startsWith(lang)) {
      u.voice = selectedVoice;
    } else if (voiceForLang) {
      u.voice = voiceForLang;
    }

    const { pitch, rate } = getToneSettings();
    u.pitch = pitch; // 1.15 = bright, clear, simple, not deep!
    u.rate = rate;   // 1.06 = crisp, natural cadence
    u.volume = Math.min(1, Math.max(0.1, volumeSetting / 100));

    window.speechSynthesis.speak(u);
  } catch (err) {
    console.warn('Speech synthesis error:', err);
  }
}

function toggleMute() {
  isMuted = !isMuted;
  if (btnMute) {
    btnMute.classList.toggle('is-muted', isMuted);
    btnMute.setAttribute('aria-pressed', isMuted ? 'true' : 'false');
    btnMute.setAttribute('aria-label', isMuted ? 'Unmute audio' : 'Mute audio');
  }
  if (mainGainNode && audioCtx) mainGainNode.gain.setValueAtTime(cappedGain(), audioCtx.currentTime);
  speak(isMuted ? 'Audio muted.' : 'Audio on.');
}

async function toggleListening() {
  if (isModelLoading && !isDemoMode) return;
  if (isListening && !isDemoMode) await stopListening();
  else await startListening();
}

async function startListening() {
  if (isDemoMode) await stopDemo({ silent: true });
  initAudio();
  try {
    const constraints = { video: { facingMode, width: { ideal: 640 }, height: { ideal: 480 } }, audio: false };
    try {
      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    webcam.srcObject = activeStream;
    await new Promise((res) => { webcam.onloadedmetadata = res; });
    await webcam.play();
    canvas.width = webcam.videoWidth;
    canvas.height = webcam.videoHeight;
    const camTrack = activeStream.getVideoTracks()[0];
    camTrack.addEventListener('ended', onCameraEnded);
    isListening = true;
    setListeningChrome(true);
    setStatus('live', 'Listening');
    speak('Listening. I will name supported objects. If I am silent, I do not see one. Use your cane.');
    detectionLoop();
    scheduleSonar();
    countCameras();
  } catch (err) {
    console.error(err);
    setStatus('error', 'Camera blocked');
    showModal(err.name === 'NotAllowedError');
    speak('Camera permission is required for live listening. Or play the guided demo.');
  }
}

function onCameraEnded() {
  if (!isListening || isDemoMode) return;
  speak('Camera off. I cannot see. Use your cane.');
  stopListening({ silent: true });
}

async function stopListening({ silent = false } = {}) {
  isListening = false;
  isDetecting = false;
  closestObject = null;
  currentItems = [];
  objectTracks.clear();
  if (activeStream) {
    activeStream.getTracks().forEach((t) => t.stop());
    activeStream = null;
  }
  if (webcam) webcam.srcObject = null;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  animationFrameId = null;
  if (sonarTimeoutId) clearTimeout(sonarTimeoutId);
  sonarTimeoutId = null;
  if (ctx && canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  setListeningChrome(false);
  renderPrimary(null);
  if (!isModelLoading) setStatus('ready', 'Ready');
  if (!silent) speak('Listening stopped. I cannot see.');
}

function setListeningChrome(on) {
  document.body.classList.toggle('is-live', on && !isDemoMode);
  if (btnStart) {
    btnStart.classList.toggle('live', on);
    const label = btnStart.querySelector('.btn-primary-label');
    const sub = btnStart.querySelector('.btn-primary-sub');
    if (label) label.textContent = on ? 'Stop listening' : 'Start listening';
    if (sub) sub.textContent = on ? 'Camera is on this device' : 'Camera stays on this device';
    btnStart.setAttribute('aria-label', on ? 'Stop listening' : 'Start listening');
    const ico = btnStart.querySelector('.btn-ico svg');
    if (ico) {
      ico.innerHTML = on
        ? '<rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor"/>'
        : '<polygon points="6 4 20 12 6 20" fill="currentColor"/>';
    }
  }
  applyPreview();
}

function applyPreview() {
  const live = isListening && !isDemoMode;
  radarStage?.classList.toggle('is-live', live);
  radarStage?.classList.toggle('preview-on', isCameraPreviewEnabled && live);
}

function showModal() {
  document.getElementById('cam-permission-modal')?.classList.remove('hidden');
}
function hideModal() {
  document.getElementById('cam-permission-modal')?.classList.add('hidden');
}

async function countCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    if (btnSwitch) btnSwitch.disabled = devices.filter((d) => d.kind === 'videoinput').length < 2;
  } catch { /* ignore */ }
}

function profileFor(label) {
  return PROFILES[label] || { family: 'furniture', tone: 500, wave: 'sine', label };
}

function distanceMeters(cls, boxH, frameH) {
  const real = HEIGHTS[cls] || 0.8;
  return Math.max(0.4, Math.min(10, (frameH * 0.85 * real) / Math.max(12, boxH)));
}

function panToClock(pan) {
  return Math.round(3 * pan + 12) % 12 || 12;
}

function sideWord(pan) {
  if (pan < -0.28) return 'left';
  if (pan > 0.28) return 'right';
  return 'ahead';
}

function allowedClass(cls) {
  if (currentAudioProfile === 'minimal') return PEOPLE.has(cls);
  if (currentAudioProfile === 'standard') return PEOPLE.has(cls) || FURNITURE.has(cls) || VEHICLES.has(cls);
  return true;
}

function iou(a, b) {
  const [ax, ay, aw, ah] = a;
  const [bx, by, bw, bh] = b;
  const w = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const h = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  return (w * h) / Math.max(1, aw * ah + bw * bh - w * h);
}

function track(det, meters) {
  const now = performance.now();
  let bestKey = null;
  let best = 0;
  for (const [key, t] of objectTracks) {
    if (t.class !== det.class || now - t.updatedAt > TRACK_TTL_MS) continue;
    const v = iou(t.bbox, det.bbox);
    if (v > best) { best = v; bestKey = key; }
  }
  const prev = best > 0.25 ? objectTracks.get(bestKey) : null;
  const key = bestKey || `${det.class}-${now.toFixed(0)}`;
  const dt = prev ? Math.max(0.1, (now - prev.updatedAt) / 1000) : 0;
  const closing = prev ? (prev.distanceMeters - meters) / dt : 0;
  objectTracks.set(key, { class: det.class, bbox: det.bbox, distanceMeters: meters, updatedAt: now });
  for (const [k, t] of objectTracks) if (now - t.updatedAt > TRACK_TTL_MS) objectTracks.delete(k);
  return closing > 0.45 ? 'approaching' : 'steady';
}

async function detectionLoop() {
  if (!isListening || !model || isDemoMode) return;
  if (isDetecting) {
    animationFrameId = requestAnimationFrame(detectionLoop);
    return;
  }
  isDetecting = true;
  try {
    const preds = await model.detect(webcam);
    const valid = preds.filter((p) => p.score >= confidenceThreshold && allowedClass(p.class));
    drawFrame(valid);
    processItems(valid);
  } catch (err) {
    console.error(err);
  }
  isDetecting = false;
  if (isListening && !isDemoMode) animationFrameId = requestAnimationFrame(detectionLoop);
}

function drawFrame(dets) {
  if (!ctx || !canvas) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (webcam && webcam.readyState >= 2) {
    ctx.drawImage(webcam, 0, 0, canvas.width, canvas.height);
  }
  dets.forEach((det) => {
    const [x, y, w, h] = det.bbox;
    const label = translateObject(det.class);
    
    // High-contrast clean bounding box
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.5;
    ctx.strokeRect(x, y, w, h);

    // High-contrast tag pill
    ctx.font = '600 12px -apple-system, sans-serif';
    const txtWidth = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(8, 9, 11, 0.88)';
    ctx.fillRect(x, Math.max(0, y - 22), txtWidth + 14, 20);

    ctx.fillStyle = '#ffffff';
    ctx.fillText(label, x + 6, Math.max(14, y - 7));
  });
}

function processItems(dets) {
  const w = webcam.videoWidth || 640;
  const h = webcam.videoHeight || 480;
  const items = dets.map((det) => {
    const [x, y, bw, bh] = det.bbox;
    let pan = ((x + bw / 2) / w) * 2 - 1;
    if (facingMode === 'user') pan = -pan;
    const meters = distanceMeters(det.class, bh, h);
    const prof = profileFor(det.class);
    return {
      class: det.class,
      confidence: det.score,
      pan,
      distanceMeters: meters,
      profile: prof,
      clockHour: panToClock(pan),
      movement: track(det, meters),
    };
  }).sort((a, b) => a.distanceMeters - b.distanceMeters);

  currentItems = items;
  const primary = pickPrimary(items);
  closestObject = primary;
  renderPrimary(primary);
  maybeSpeak(primary);
}

function pickPrimary(items) {
  if (!items.length) return null;
  if (activeHomingTarget) {
    const hit = items.find((i) => matchesTarget(i, activeHomingTarget));
    if (hit) return hit;
  }
  const person = items.find((i) => i.class === 'person');
  if (person) return person;
  return items[0];
}

function matchesTarget(item, target) {
  const t = target.toLowerCase().trim();
  const cls = item.class.toLowerCase();
  const label = (item.profile?.label || '').toLowerCase();
  return cls.includes(t) || label.includes(t) || t.includes(cls);
}

function renderPrimary(item) {
  const dirBadge = document.getElementById('primary-direction');
  const proxFill = document.getElementById('proximity-fill');

  if (!item) {
    if (primaryKicker) primaryKicker.textContent = isListening ? 'Scanning' : 'Standby';
    if (dirBadge) dirBadge.textContent = isListening ? 'Scanning field...' : 'Ready';
    if (primaryTitle) primaryTitle.textContent = t('noObject');
    if (primarySub) primarySub.textContent = isListening
      ? t('limitsNotice')
      : t('standbySub');
    if (proxFill) proxFill.style.width = '0%';
    renderPills([]);
    return;
  }

  const label = translateObject(item.class);
  const about = item.distanceMeters.toFixed(1);
  const side = translateDirection(sideWord(item.pan));
  
  if (primaryKicker) primaryKicker.textContent = item.profile?.family || 'Object';
  if (dirBadge) dirBadge.textContent = `${side} · ${item.clockHour} o'clock`;
  if (primaryTitle) primaryTitle.textContent = `${label}, ${side}`;
  if (primarySub) primarySub.textContent = `Distance: ${about} meters · ${item.movement === 'approaching' ? '⚠️ Approaching' : 'Steady'}`;
  
  if (proxFill) {
    const pct = Math.min(100, Math.max(10, (1 - (item.distanceMeters - 0.4) / 4.6) * 100));
    proxFill.style.width = `${pct}%`;
  }

  renderPills([item]);
}

function renderPills(items) {
  if (!radarPills) return;
  if (!items.length) {
    radarPills.innerHTML = '';
    return;
  }
  radarPills.innerHTML = items.slice(0, 1).map((item) => {
    const pan = Math.max(-1, Math.min(1, item.pan));
    const radius = 18 + Math.min(32, (item.distanceMeters / 10) * 32);
    const ang = ((pan * 70) - 90) * Math.PI / 180;
    const x = 50 + Math.cos(ang) * radius;
    const y = 50 + Math.sin(ang) * radius;
    const label = translateObject(item.class);
    const side = translateDirection(sideWord(item.pan));
    return `<div class="object-pill" style="left:${x}%;top:${y}%">
      <div class="pill-dot">${label.slice(0, 1).toUpperCase()}</div>
      <div><b>${label}</b><span>${item.distanceMeters.toFixed(1)} m · ${side}</span></div>
    </div>`;
  }).join('');
}

function maybeSpeak(primary) {
  const now = Date.now();
  if (!primary) {
    if (isListening && now - lastEmptySpeakAt > EMPTY_COOLDOWN_MS) {
      lastEmptySpeakAt = now;
      lastSpokenKey = '';
      speak(t('noObject'));
    }
    return;
  }
  if (primary.confidence < confidenceThreshold) return;
  const close = primary.distanceMeters < 1.5;
  const key = `${primary.class}-${sideWord(primary.pan)}`;
  const isNew = key !== lastSpokenKey;
  const closing = primary.movement === 'approaching' && close && !lastClose;
  if (!isNew && !closing && now - lastSpokenAt < SPEAK_COOLDOWN_MS) return;
  lastSpokenKey = key;
  lastSpokenAt = now;
  lastClose = close;
  const phrase = formatCue(primary.class, sideWord(primary.pan), primary.distanceMeters);
  speak(phrase);
  if (close) haptic('close');
  else haptic('tap');
}

function scheduleSonar() {
  if (!isListening && !isDemoMode) return;
  const item = closestObject;
  if (item) {
    const close = item.distanceMeters < 1.5;
    playFamilyBeep(item, close ? 2 : 1);
    const delay = close ? 280 : 180 + Math.min(900, item.distanceMeters * 140);
    sonarTimeoutId = setTimeout(scheduleSonar, delay);
  } else {
    playHeartbeat();
    sonarTimeoutId = setTimeout(scheduleSonar, 4000);
  }
}

function playFamilyBeep(item, pulses) {
  if (isMuted || !audioCtx) return;
  const prof = item.profile || profileFor(item.class);
  for (let i = 0; i < pulses; i += 1) {
    const t = audioCtx.currentTime + i * 0.12;
    const osc = audioCtx.createOscillator();
    const panNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
    const g = audioCtx.createGain();
    osc.type = prof.wave;
    osc.frequency.setValueAtTime(prof.tone + Math.max(0, (4 - item.distanceMeters) * 18), t);
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.11);
    if (panNode) {
      panNode.pan.setValueAtTime(Math.max(-1, Math.min(1, item.pan || 0)), t);
      osc.connect(panNode); panNode.connect(g);
    } else osc.connect(g);
    g.connect(mainGainNode);
    osc.start(t);
    osc.stop(t + 0.12);
    setTimeout(() => { try { osc.disconnect(); g.disconnect(); panNode?.disconnect(); } catch {} }, 200);
  }
}

function playHeartbeat() {
  if (isMuted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, audioCtx.currentTime);
  g.gain.setValueAtTime(0.012, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
  osc.connect(g); g.connect(mainGainNode);
  osc.start(); osc.stop(audioCtx.currentTime + 0.06);
}

function playHomingBeep(item) {
  if (isMuted || !audioCtx || !item) return;
  const osc = audioCtx.createOscillator();
  const panNode = audioCtx.createStereoPanner ? audioCtx.createStereoPanner() : null;
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(880 + Math.max(0, (5 - item.distanceMeters) * 70), audioCtx.currentTime);
  g.gain.setValueAtTime(0.06, audioCtx.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
  if (panNode) {
    panNode.pan.setValueAtTime(item.pan, audioCtx.currentTime);
    osc.connect(panNode); panNode.connect(g);
  } else osc.connect(g);
  g.connect(mainGainNode);
  osc.start(); osc.stop(audioCtx.currentTime + 0.11);
}

function setHomingTarget(raw) {
  const target = String(raw || '').toLowerCase().trim();
  activeHomingTarget = target || null;
  findChips?.querySelectorAll('.chip').forEach((chip) => {
    chip.setAttribute('aria-pressed', chip.getAttribute('data-target') === target ? 'true' : 'false');
  });
  if (findInput && target) findInput.value = target;
  if (!target) {
    if (homingTimeoutId) clearTimeout(homingTimeoutId);
    if (homingKicker) homingKicker.textContent = 'No target';
    if (homingTitle) homingTitle.textContent = 'Choose an object to hunt';
    if (homingSub) homingSub.textContent = 'I only report supported COCO classes.';
    speak('Find target cleared.');
    return;
  }
  switchTab('view-find', document.querySelector('.tab[data-target="view-find"]'));
  speak(`Looking for ${target}. I will beep faster as it fills the camera.`);
  if (!isListening && !isDemoMode) startListening();
  startHomingLoop();
}

function startHomingLoop() {
  if (homingTimeoutId) clearTimeout(homingTimeoutId);
  const tick = () => {
    if (!activeHomingTarget) return;
    const hit = currentItems.find((i) => matchesTarget(i, activeHomingTarget));
    if (homingKicker) homingKicker.textContent = activeHomingTarget;
    if (hit) {
      if (homingTitle) homingTitle.textContent = `${hit.profile.label || hit.class}, ${sideWord(hit.pan)}`;
      if (homingSub) homingSub.textContent = `About ${hit.distanceMeters.toFixed(1)} meters. Homing beep is on.`;
      playHomingBeep(hit);
      homingTimeoutId = setTimeout(tick, 160 + Math.min(800, hit.distanceMeters * 120));
    } else {
      if (homingTitle) homingTitle.textContent = `No ${activeHomingTarget} in view`;
      if (homingSub) homingSub.textContent = isListening ? 'Turn slowly. I can only see what the camera sees.' : 'Start listening to scan.';
      homingTimeoutId = setTimeout(tick, 900);
    }
  };
  tick();
}

function toggleDemo() {
  if (isDemoMode) stopDemo();
  else startDemo();
}

async function startDemo() {
  initAudio();
  if (isListening && !isDemoMode) await stopListening({ silent: true });
  isDemoMode = true;
  isListening = true;
  const demoLabel = document.getElementById('btn-demo-label');
  if (demoLabel) demoLabel.textContent = 'Stop demo';
  btnDemo?.setAttribute('aria-label', 'Stop guided demo');
  setStatus('live', 'Demo');
  document.body.classList.add('is-demo');
  scheduleSonar();
  speak('Headphones demo. These scenes are scripted. Live camera cannot do all of this. Not a cane.');

  const scenes = [
    { hold: 6500, speech: null, item: null },
    {
      hold: 5500,
      speech: 'Person on your right, about 3 meters. The beep sits in your right ear.',
      item: mock('person', 0.7, 3.2),
    },
    {
      hold: 5000,
      speech: 'Chair on your left, about 1.5 meters.',
      item: mock('chair', -0.72, 1.5),
    },
    {
      hold: 5500,
      speech: 'Table ahead, about 2 meters. Live mode only reports COCO objects.',
      item: mock('dining table', 0.05, 2.1),
    },
  ];

  let step = 0;
  const run = () => {
    if (!isDemoMode) return;
    const scene = scenes[step];
    closestObject = scene.item;
    currentItems = scene.item ? [scene.item] : [];
    renderPrimary(scene.item);
    if (scene.speech) speak(scene.speech);
    step += 1;
    if (step >= scenes.length) {
      demoTimeoutId = setTimeout(() => {
        speak('Demo complete. Start listening to try the live camera.');
        stopDemo({ silent: true });
      }, scene.hold);
      return;
    }
    demoTimeoutId = setTimeout(run, scene.hold);
  };
  demoTimeoutId = setTimeout(run, 700);
}

function mock(cls, pan, meters) {
  return {
    class: cls,
    confidence: 0.94,
    pan,
    distanceMeters: meters,
    profile: profileFor(cls),
    clockHour: panToClock(pan),
    movement: 'steady',
  };
}

async function stopDemo({ silent = false } = {}) {
  isDemoMode = false;
  if (demoTimeoutId) clearTimeout(demoTimeoutId);
  demoTimeoutId = null;
  const demoLabel = document.getElementById('btn-demo-label');
  if (demoLabel) demoLabel.textContent = 'Play guided demo';
  btnDemo?.setAttribute('aria-label', 'Play guided demo');
  document.body.classList.remove('is-demo');
  if (isListening) await stopListening({ silent: true });
  else {
    closestObject = null;
    currentItems = [];
    renderPrimary(null);
    if (sonarTimeoutId) clearTimeout(sonarTimeoutId);
  }
  if (!silent) speak('Demo stopped.');
}

function toggleVoice() {
  if (isVoiceEnabled) stopVoice();
  else startVoice();
}

function startVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const hud = document.getElementById('voice-hud');
  if (!SpeechRecognition) {
    speak('Voice commands are not supported in this browser. Please use Chrome or Edge.');
    return;
  }
  isVoiceEnabled = true;
  hud?.classList.remove('hidden');
  document.getElementById('btn-voice-assistant')?.classList.add('listening');
  
  try { recognition?.stop(); } catch {}
  recognition = new SpeechRecognition();
  recognition.continuous = true;
  recognition.interimResults = true;
  
  const langCode = {
    en: 'en-US', es: 'es-ES', fr: 'fr-FR', de: 'de-DE', hi: 'hi-IN',
    ja: 'ja-JP', zh: 'zh-CN', pt: 'pt-BR', it: 'it-IT', ar: 'ar-SA'
  }[getLanguage()] || 'en-US';
  recognition.lang = langCode;

  recognition.onresult = (event) => {
    let finalText = '';
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const t = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalText = t;
      else interim += t;
    }
    const el = document.getElementById('voice-hud-transcript');
    if (el) el.textContent = finalText || interim || 'Listening for command...';
    if (finalText) handleVoice(finalText.toLowerCase().trim());
  };

  recognition.onend = () => {
    if (isVoiceEnabled) {
      try { recognition.start(); } catch {}
    }
  };

  try { recognition.start(); } catch {}
  speak('Voice control active. You can talk to control the app.');
}

function stopVoice() {
  isVoiceEnabled = false;
  try { recognition?.stop(); } catch {}
  document.getElementById('voice-hud')?.classList.add('hidden');
  document.getElementById('btn-voice-assistant')?.classList.remove('listening');
}

function handleVoice(rawText) {
  const text = rawText.toLowerCase().trim();
  console.log('Voice Command received:', text);

  // 0. Walkthrough Tour Controls
  if (text.includes('start tour') || text.includes('walkthrough') || text.includes('help tour') || text.includes('audio tour')) {
    startTour();
    return;
  }
  if (text.includes('next step') || text.includes('next tour') || text === 'next') {
    nextTourStep();
    return;
  }
  if (text.includes('previous step') || text.includes('previous tour') || text === 'previous' || text === 'back') {
    prevTourStep();
    return;
  }
  if (text.includes('exit tour') || text.includes('close tour') || text.includes('stop tour')) {
    exitTour();
    return;
  }
  if (text.includes('repeat step') || text.includes('replay step') || text.includes('repeat tour') || text.includes('say again')) {
    replayTourStep();
    return;
  }

  // 1. Language Controls
  if (text.includes('spanish') || text.includes('español')) {
    setLanguage('es');
    syncLanguageUI('es');
    speak('Idioma cambiado a Español.');
    return;
  }
  if (text.includes('french') || text.includes('français')) {
    setLanguage('fr');
    syncLanguageUI('fr');
    speak('Langue définie sur le Français.');
    return;
  }
  if (text.includes('german') || text.includes('deutsch')) {
    setLanguage('de');
    syncLanguageUI('de');
    speak('Sprache auf Deutsch eingestellt.');
    return;
  }
  if (text.includes('hindi') || text.includes('हिंदी')) {
    setLanguage('hi');
    syncLanguageUI('hi');
    speak('भाषा हिन्दी पर सेट की गई।');
    return;
  }
  if (text.includes('japanese') || text.includes('日本語')) {
    setLanguage('ja');
    syncLanguageUI('ja');
    speak('言語を日本語に設定しました。');
    return;
  }
  if (text.includes('chinese') || text.includes('中文')) {
    setLanguage('zh');
    syncLanguageUI('zh');
    speak('语言已设置为中文。');
    return;
  }
  if (text.includes('portuguese') || text.includes('português')) {
    setLanguage('pt');
    syncLanguageUI('pt');
    speak('Idioma definido para Português.');
    return;
  }
  if (text.includes('italian') || text.includes('italiano')) {
    setLanguage('it');
    syncLanguageUI('it');
    speak('Lingua impostata su Italiano.');
    return;
  }
  if (text.includes('arabic') || text.includes('عربية')) {
    setLanguage('ar');
    syncLanguageUI('ar');
    speak('تم ضبط اللغة على العربية.');
    return;
  }
  if (text.includes('english') || text.includes('ingles')) {
    setLanguage('en');
    syncLanguageUI('en');
    speak('Language switched to English.');
    return;
  }

  // 2. Voice Tone Settings
  if (text.includes('crisp voice') || text.includes('bright voice') || text.includes('simple voice') || text.includes('tone crisp')) {
    voiceTone = 'crisp';
    localStorage.setItem('echolens_voice_tone', 'crisp');
    syncToneUI('crisp');
    speak('Voice tone set to simple and bright.');
    return;
  }
  if (text.includes('natural voice') || text.includes('balanced voice') || text.includes('tone natural')) {
    voiceTone = 'natural';
    localStorage.setItem('echolens_voice_tone', 'natural');
    syncToneUI('natural');
    speak('Voice tone set to natural and balanced.');
    return;
  }
  if (text.includes('gentle voice') || text.includes('smooth voice') || text.includes('tone gentle')) {
    voiceTone = 'gentle';
    localStorage.setItem('echolens_voice_tone', 'gentle');
    syncToneUI('gentle');
    speak('Voice tone set to gentle and smooth.');
    return;
  }

  // 3. Volume Adjustments
  const volMatch = text.match(/volume (?:to )?(\d+)/) || text.match(/set volume (?:to )?(\d+)/);
  if (volMatch) {
    const val = Math.min(100, Math.max(10, parseInt(volMatch[1], 10)));
    volumeSetting = val;
    localStorage.setItem('echolens_volume', val);
    syncVolumeUI(val);
    speak(`Volume set to ${val} percent.`);
    return;
  }
  if (text.includes('volume up') || text.includes('louder') || text.includes('increase volume')) {
    volumeSetting = Math.min(100, volumeSetting + 20);
    localStorage.setItem('echolens_volume', volumeSetting);
    syncVolumeUI(volumeSetting);
    speak(`Volume ${volumeSetting} percent.`);
    return;
  }
  if (text.includes('volume down') || text.includes('quieter') || text.includes('decrease volume') || text.includes('lower volume')) {
    volumeSetting = Math.max(10, volumeSetting - 20);
    localStorage.setItem('echolens_volume', volumeSetting);
    syncVolumeUI(volumeSetting);
    speak(`Volume ${volumeSetting} percent.`);
    return;
  }
  if (text.includes('max volume') || text.includes('maximum volume') || text.includes('full volume')) {
    volumeSetting = 100;
    localStorage.setItem('echolens_volume', 100);
    syncVolumeUI(100);
    speak('Volume set to maximum.');
    return;
  }

  // 4. Audio Filters / Detection Profiles
  if (text.includes('detect all') || text.includes('all objects') || text.includes('filter all') || text.includes('everything')) {
    currentAudioProfile = 'all';
    syncProfileUI('all');
    speak('Detection profile set to all objects.');
    return;
  }
  if (text.includes('people only') || text.includes('only people') || text.includes('filter people') || text.includes('human mode')) {
    currentAudioProfile = 'people';
    syncProfileUI('people');
    speak('Filter set to people only.');
    return;
  }
  if (text.includes('furniture only') || text.includes('filter furniture')) {
    currentAudioProfile = 'furniture';
    syncProfileUI('furniture');
    speak('Filter set to furniture only.');
    return;
  }
  if (text.includes('vehicles only') || text.includes('traffic mode') || text.includes('filter vehicles')) {
    currentAudioProfile = 'vehicles';
    syncProfileUI('vehicles');
    speak('Filter set to vehicles and traffic.');
    return;
  }
  if (text.includes('indoor profile') || text.includes('indoor mode')) {
    currentAudioProfile = 'indoor';
    syncProfileUI('indoor');
    speak('Indoor profile activated.');
    return;
  }
  if (text.includes('outdoor profile') || text.includes('outdoor mode')) {
    currentAudioProfile = 'outdoor';
    syncProfileUI('outdoor');
    speak('Outdoor profile activated.');
    return;
  }

  // 5. Vibration / Haptics
  if (text.includes('turn on vibration') || text.includes('enable haptic') || text.includes('enable vibration')) {
    isHapticEnabled = true;
    localStorage.setItem('echolens_haptics', 'true');
    const hToggle = document.getElementById('haptic-toggle');
    if (hToggle) hToggle.checked = true;
    speak('Tactile haptic feedback enabled.');
    return;
  }
  if (text.includes('turn off vibration') || text.includes('disable haptic') || text.includes('disable vibration')) {
    isHapticEnabled = false;
    localStorage.setItem('echolens_haptics', 'false');
    const hToggle = document.getElementById('haptic-toggle');
    if (hToggle) hToggle.checked = false;
    speak('Tactile haptic feedback disabled.');
    return;
  }

  // 6. Camera Controls
  if (text.includes('flip camera') || text.includes('switch camera') || text.includes('front camera') || text.includes('rear camera') || text.includes('back camera')) {
    if (text.includes('front')) facingMode = 'user';
    else if (text.includes('rear') || text.includes('back')) facingMode = 'environment';
    else facingMode = facingMode === 'environment' ? 'user' : 'environment';
    
    if (isListening && !isDemoMode) {
      stopListening({ silent: true }).then(() => startListening());
    }
    speak(facingMode === 'user' ? 'Front camera activated.' : 'Rear camera activated.');
    return;
  }

  // 7. Navigation Across Tabs
  if (text.includes('open listen') || text.includes('go to listen') || text.includes('camera tab') || text.includes('listen view')) {
    switchTab('view-listen', document.querySelector('.tab-button[data-target="view-listen"]'));
    speak('Listen tab open.');
    return;
  }
  if (text.includes('open read') || text.includes('go to read') || text.includes('text reader') || text.includes('read tab')) {
    switchTab('view-read', document.querySelector('.tab-button[data-target="view-read"]'));
    speak('Read tab open.');
    return;
  }
  if (text.includes('open find') || text.includes('go to find') || text.includes('object search') || text.includes('find tab')) {
    switchTab('view-find', document.querySelector('.tab-button[data-target="view-find"]'));
    speak('Find tab open.');
    return;
  }
  if (text.includes('open map') || text.includes('go to map') || text.includes('gps navigation') || text.includes('map tab')) {
    switchTab('view-map', document.querySelector('.tab-button[data-target="view-map"]'));
    openMapTab();
    speak('Map tab open.');
    return;
  }
  if (text.includes('open setting') || text.includes('go to setting') || text.includes('preferences')) {
    switchTab('view-settings', document.querySelector('.tab-button[data-target="view-settings"]'));
    speak('Settings tab open.');
    return;
  }

  // 8. Vision & Audio Controls
  if (text.includes('start listen') || text.includes('start vision') || text.includes('turn on camera') || text.includes('start spatial')) {
    if (!isListening) startListening();
    else speak('Spatial vision is already running.');
    return;
  }
  if (text.includes('stop listen') || text.includes('stop vision') || text.includes('stop camera') || text === 'stop') {
    if (isListening) stopListening();
    if (isDemoMode) stopDemo();
    return;
  }
  if (text.includes('start demo') || text.includes('play demo') || text.includes('run demo')) {
    if (!isDemoMode) startDemo();
    return;
  }
  if (text.includes('stop demo')) {
    if (isDemoMode) stopDemo();
    return;
  }
  if (text.includes('unmute') || text.includes('sound on') || text.includes('audio on')) {
    if (isMuted) toggleMute();
    else speak('Audio is already on.');
    return;
  }
  if (text.includes('mute') || text.includes('silence') || text.includes('quiet')) {
    if (!isMuted) toggleMute();
    return;
  }

  // 9. Object Search & Homing
  if (text.startsWith('find ') || text.includes('where is ') || text.includes('look for ') || text.includes('search for ')) {
    const target = text
      .replace('find the', '')
      .replace('find a', '')
      .replace('find', '')
      .replace('where is the', '')
      .replace('where is a', '')
      .replace('where is', '')
      .replace('look for the', '')
      .replace('look for a', '')
      .replace('look for', '')
      .replace('search for', '')
      .trim();
    if (target) setHomingTarget(target);
    return;
  }
  if (text.includes('stop find') || text.includes('cancel find') || text.includes('clear search') || text.includes('clear target')) {
    setHomingTarget(null);
    return;
  }

  // 10. AI Scene & Vision Tools
  if (text.includes('describe scene') || text.includes('what do you see') || text.includes('what is in front')) {
    if (closestObject) {
      const label = translateObject(closestObject.class);
      const side = translateDirection(sideWord(closestObject.pan));
      speak(`${label}, ${side}, about ${closestObject.distanceMeters.toFixed(1)} meters.`);
    } else {
      runReadTool('scene');
    }
    return;
  }
  if (text.includes('read text') || text.includes('read sign') || text.includes('read document') || text.includes('read page')) {
    runReadTool('text');
    return;
  }
  if (text.includes('barcode') || text.includes('qr') || text.includes('scan code') || text.includes('product scan')) {
    runReadTool('barcode');
    return;
  }
  if (text.includes('color') || text.includes('what colour') || text.includes('detect color')) {
    runReadTool('color');
    return;
  }

  // 11. Location & Places
  if (text.includes('where am i') || text.includes('my location') || text.includes('what street') || text.includes('current location') || text.includes('speak location')) {
    speakLocation();
    return;
  }
  if (text.includes('nearby') || text.includes('what is around') || text.includes('places around me')) {
    speakNearby();
    return;
  }

  // Fallback
  speak(`I heard: "${text}". Try saying "start listening", "find chair", "change language to Spanish", "volume 80", or "where am I".`);
}

// UI Synchronization Helpers for Voice Control
function syncLanguageUI(lang) {
  initVoices();
  renderFindChips();
  renderPrimary(closestObject);
  const sel = document.getElementById('language-select');
  if (sel) sel.value = lang;
  const langItem = document.querySelector(`#lang-popover .popover-item[data-value="${lang}"]`);
  if (langItem) {
    document.querySelectorAll('#lang-popover .popover-item').forEach(b => b.classList.toggle('selected', b === langItem));
    const lt = document.getElementById('lang-trigger-text');
    if (lt) lt.textContent = (langItem.querySelector('span')?.textContent || langItem.textContent).replace('✓', '').trim();
  }
}

function syncToneUI(tone) {
  const sel = document.getElementById('voice-tone-select');
  if (sel) sel.value = tone;
  const toneItem = document.querySelector(`#tone-popover .popover-item[data-value="${tone}"]`);
  if (toneItem) {
    document.querySelectorAll('#tone-popover .popover-item').forEach(b => b.classList.toggle('selected', b === toneItem));
    const tt = document.getElementById('tone-trigger-text');
    if (tt) tt.textContent = (toneItem.querySelector('span')?.textContent || toneItem.textContent).replace('✓', '').trim();
  }
}

function syncVolumeUI(val) {
  const volCtrl = document.getElementById('volume-control');
  const volVal = document.getElementById('volume-val');
  if (volCtrl) volCtrl.value = val;
  if (volVal) volVal.textContent = `${val}%`;
}

function syncProfileUI(prof) {
  const sel = document.getElementById('audio-profile-select');
  if (sel) sel.value = prof;
  const profItem = document.querySelector(`#profile-popover .popover-item[data-value="${prof}"]`);
  if (profItem) {
    document.querySelectorAll('#profile-popover .popover-item').forEach(b => b.classList.toggle('selected', b === profItem));
    const pt = document.getElementById('profile-trigger-text');
    if (pt) pt.textContent = (profItem.querySelector('span')?.textContent || profItem.textContent).replace('✓', '').trim();
  }
}

/* ── 🧭 Audio-Guided Walkthrough Tour Engine ── */
let currentTourIndex = 0;
const tourSteps = [
  {
    step: 1,
    title: '100% Voice Controllable',
    badge: 'Step 1 of 6 · Voice Control',
    tab: 'view-listen',
    icon: '<rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" stroke-width="2"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    speech: 'Welcome to EchoLens! You never need to touch the screen. You can control the entire app simply by speaking. Say start listening, change language to Spanish, set volume to 80, or where am I at any time.',
    desc: 'You never need to touch the screen. Simply talk to EchoLens to change settings, adjust volume, switch languages, find objects, or navigate anywhere.'
  },
  {
    step: 2,
    title: 'Spatial Vision & GPS HUD',
    badge: 'Step 2 of 6 · Listen View',
    tab: 'view-listen',
    icon: '<circle cx="12" cy="12" r="3.5" fill="currentColor"/><path d="M3.5 12a8.5 8.5 0 0 1 17 0M7 12a5 5 0 0 1 10 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    speech: 'In the Listen tab, point your camera forward. Obstacles appear in the centre with real-time 3D stereo audio, while your live street and rotating GPS compass are displayed in the top-right corner.',
    desc: 'Centre camera feed with AI bounding boxes, distance estimates, and a Picture-in-Picture GPS mini-map in the top-right.'
  },
  {
    step: 3,
    title: 'Audio Object Hunting',
    badge: 'Step 3 of 6 · Find View',
    tab: 'view-find',
    icon: '<circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="m21 21-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    speech: 'In the Find tab, you can ask EchoLens to hunt for specific objects like chairs, bottles, laptops, or people. The audio beeps faster and higher in pitch as you get closer.',
    desc: 'Say "Find chair" or "Look for person" to lock onto objects with directional sound.'
  },
  {
    step: 4,
    title: 'Document & Scene Reader',
    badge: 'Step 4 of 6 · Read View',
    tab: 'view-read',
    icon: '<path d="M4 6h16M4 11h10M4 16h13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    speech: 'In the Read tab, point your camera at text, signs, products, or barcodes. EchoLens will read documents aloud or describe the entire scene.',
    desc: 'Say "Read text", "Scan barcode", or "Describe scene" for instant spoken descriptions.'
  },
  {
    step: 5,
    title: 'Real-Time Street Navigation',
    badge: 'Step 5 of 6 · Map View',
    tab: 'view-map',
    icon: '<polygon points="3 11 22 2 13 21 11 13 3 11" fill="currentColor"/>',
    speech: 'In the Map tab, track your real-world coordinates and street address. Say "Where am I" or "What is nearby" for spoken geographic awareness.',
    desc: 'Continuous GPS tracking, rotating compass heading cone, and nearby place discovery.'
  },
  {
    step: 6,
    title: 'Voice & Multi-Language Settings',
    badge: 'Step 6 of 6 · Settings',
    tab: 'view-settings',
    icon: '<circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" stroke-width="2"/>',
    speech: 'In Settings, you can switch between 10 languages, adjust bright voice tones, and change volume. Simply say "Change language to Spanish" or "Set volume to 80". You are all set to use EchoLens!',
    desc: '10 international languages, bright voice tones, volume slider, and tactile feedback.'
  }
];

function startTour(stepIndex = 0) {
  currentTourIndex = Math.max(0, Math.min(tourSteps.length - 1, stepIndex));
  document.getElementById('walkthrough-modal')?.classList.remove('hidden');
  renderTourStep(currentTourIndex);
}

function renderTourStep(index) {
  const item = tourSteps[index];
  if (!item) return;

  if (item.tab) {
    const tabBtn = document.querySelector(`.tab-button[data-target="${item.tab}"]`);
    switchTab(item.tab, tabBtn);
    if (item.tab === 'view-map') openMapTab();
  }

  const badgeEl = document.getElementById('tour-step-badge');
  const titleEl = document.getElementById('tour-modal-title');
  const descEl = document.getElementById('tour-modal-desc');
  const iconEl = document.getElementById('tour-icon-box');
  const nextBtn = document.getElementById('btn-tour-next');
  const prevBtn = document.getElementById('btn-tour-prev');
  const speechText = document.getElementById('tour-speech-text');

  if (badgeEl) badgeEl.textContent = item.badge;
  if (titleEl) titleEl.textContent = item.title;
  if (descEl) descEl.textContent = item.desc;
  if (iconEl && item.icon) iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none">${item.icon}</svg>`;
  if (speechText) speechText.textContent = item.title;

  if (prevBtn) prevBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
  if (nextBtn) nextBtn.textContent = index === tourSteps.length - 1 ? 'Finish Tour ✓' : 'Next Step →';

  speak(item.speech);
}

function nextTourStep() {
  if (currentTourIndex < tourSteps.length - 1) {
    currentTourIndex++;
    renderTourStep(currentTourIndex);
  } else {
    exitTour();
    speak('Tour complete. You can speak commands anytime. Say start listening to begin.');
  }
}

function prevTourStep() {
  if (currentTourIndex > 0) {
    currentTourIndex--;
    renderTourStep(currentTourIndex);
  }
}

function replayTourStep() {
  const item = tourSteps[currentTourIndex];
  if (item) speak(item.speech);
}

function exitTour() {
  document.getElementById('walkthrough-modal')?.classList.add('hidden');
}

function setMapCard(kicker, title, sub) {
  const k = document.getElementById('map-kicker');
  const t = document.getElementById('map-title');
  const s = document.getElementById('map-sub');
  if (k) k.textContent = kicker;
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

function openMapTab() {
  startLocationWatch(onGpsFix, (err) => {
    setMapCard('GPS', 'Location blocked', err.message || 'Allow location in the browser to show your map.');
    speak('Location permission is required for the live map.');
  });
  const host = document.getElementById('live-map');
  const key = getSavedGoogleKey();
  if (key) {
    loadGoogleMaps(key).then((ok) => {
      useGoogleMaps = ok;
      const fix = getLastFix();
      if (ok && fix) initGoogleMap(host, fix.lat, fix.lon);
      else initLeafletMap(host);
      mapReady = true;
    }).catch(() => {
      useGoogleMaps = false;
      initLeafletMap(host);
      mapReady = true;
      speak('Google Maps did not load. Using OpenStreetMap.');
    });
  } else {
    initLeafletMap(host);
    mapReady = true;
  }
}

async function onGpsFix(fix) {
  const acc = Math.round(fix.accuracy || 0);
  setMapCard('GPS', `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`, acc ? `Accuracy about ${acc} meters` : 'Live GPS');
  if (useGoogleMaps) updateGoogleMarker(fix.lat, fix.lon);
  else updateLeafletMarker(fix.lat, fix.lon);

  /* Update AR overlay */
  if (isARMode) {
    updateMiniMapMarker(fix.lat, fix.lon);
    const coordsEl = document.getElementById('ar-coords');
    if (coordsEl) coordsEl.textContent = `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}` + (acc ? ` · ±${acc}m` : '');
  }

  const now = Date.now();
  if (now - lastGeocodeAt < 8000) return;
  lastGeocodeAt = now;
  try {
    const geo = await reverseGeocode(fix.lat, fix.lon);
    if (geo?.display_name) {
      const short = geo.display_name.split(',').slice(0, 3).join(',');
      setMapCard('You are here', short, geo.display_name);
      /* Update AR address bar */
      const arAddr = document.getElementById('ar-address');
      if (arAddr) arAddr.textContent = short;
    }
  } catch {
    /* keep coordinates */
  }
}

async function speakLocation() {
  openMapTab();
  const fix = getLastFix();
  if (!fix) {
    speak('Waiting for GPS. Allow location access.');
    return;
  }
  const named = getLastAddress();
  if (named) {
    speak(named);
    return;
  }
  try {
    const geo = await reverseGeocode(fix.lat, fix.lon);
    speak(geo.display_name || `Latitude ${fix.lat.toFixed(4)}, longitude ${fix.lon.toFixed(4)}.`);
  } catch {
    speak(`Latitude ${fix.lat.toFixed(4)}, longitude ${fix.lon.toFixed(4)}.`);
  }
}

async function speakNearby() {
  openMapTab();
  const fix = getLastFix();
  if (!fix) {
    speak('Waiting for GPS before looking up nearby places.');
    return;
  }
  setMapCard('Searching', 'Looking for nearby places', 'Live OpenStreetMap or Google Places.');
  speak('Looking up places near you.');
  try {
    const places = useGoogleMaps ? await googleNearby(fix.lat, fix.lon) : await nearbyPlaces(fix.lat, fix.lon);
    const list = document.getElementById('place-list');
    if (list) {
      list.innerHTML = places.slice(0, 8).map((p) => (
        `<li><strong>${p.name}</strong><span>${p.kind}</span></li>`
      )).join('') || '<li><strong>No named places in range</strong></li>';
    }
    if (!places.length) {
      speak('No named places found within about 250 meters.');
      return;
    }
    /* Keep AR overlay in sync */
    arPlacesCache = places;
    const spoken = places.slice(0, 4).map((p) => p.name).join(', ');
    speak(`Nearby: ${spoken}.`);
  } catch {
    speak('Nearby search failed. Try again in a moment.');
  }
}

function setReadCard(kicker, title, sub) {
  const k = document.getElementById('read-kicker');
  const t = document.getElementById('read-title');
  const s = document.getElementById('read-sub');
  if (k) k.textContent = kicker;
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

async function ensureCameraForRead() {
  switchTab('view-read', document.querySelector('.tab[data-target="view-read"]'));
  if (!isListening || isDemoMode) {
    await startListening();
  }
  if (!isListening) throw new Error('camera-unavailable');
  await new Promise((r) => setTimeout(r, 250));
}

function grabVideoFrame() {
  if (!webcam || webcam.readyState < 2) return null;
  const snap = document.createElement('canvas');
  snap.width = webcam.videoWidth || 640;
  snap.height = webcam.videoHeight || 480;
  const c = snap.getContext('2d');
  c.drawImage(webcam, 0, 0, snap.width, snap.height);
  return snap;
}

async function runReadTool(kind) {
  try {
    await ensureCameraForRead();
  } catch {
    speak('Camera is required to read. Allow camera, or use the demo on Listen.');
    return;
  }
  const frame = grabVideoFrame();
  if (!frame) {
    speak('I could not capture a camera frame. Try again.');
    return;
  }

  if (kind === 'text') {
    setReadCard('Reading', 'Looking for print', 'Tesseract.js is reading this frame on your device.');
    speak('Hold still. Reading text.');
    try {
      const { text, confidence } = await recognizeText(frame);
      if (!text || text.length < 2) {
        setReadCard('No text', 'I could not read any print', 'Move closer, add light, and try again. OCR misses blurry or stylized text.');
        speak('I could not read any print in this view.');
        return;
      }
      const hedge = confidence < 60 ? 'I think it says: ' : '';
      setReadCard('Text', hedge + text, confidence ? `Confidence about ${Math.round(confidence)} percent. On-device Tesseract.js.` : 'On-device Tesseract.js.');
      speak(`${hedge}${text}`);
    } catch (err) {
      console.error(err);
      setReadCard('Error', 'Text reading failed', 'The OCR engine could not start. Check your connection for the first download.');
      speak('Text reading failed.');
    }
    return;
  }

  if (kind === 'barcode') {
    setReadCard('Scanning', 'Looking for a code', 'ZXing and the browser barcode API run on this device.');
    speak('Scanning for a barcode.');
    try {
      const hit = await decodeBarcode(frame);
      if (!hit) {
        setReadCard('No code', 'No barcode in this view', 'Center a QR or product barcode and try again.');
        speak('No barcode in this view.');
        return;
      }
      setReadCard(String(hit.format), hit.raw, 'Decoded on this device with ZXing or BarcodeDetector.');
      speak(`Code ${hit.format}. ${hit.raw}`);
    } catch (err) {
      console.error(err);
      setReadCard('Error', 'Barcode scan failed', 'This browser may not support barcode scanning.');
      speak('Barcode scan failed.');
    }
    return;
  }

  const color = nameColor(frame);
  setReadCard('Color', color.name, 'Sampled from the center of the camera. Lighting changes the name.');
  speak(`The center looks ${color.name}.`);
}

/* ═══════════════════════════════════════════════════════
   AR Camera Overlay — Map Tab
   ═══════════════════════════════════════════════════════ */

function toggleARMode() {
  if (isARMode) stopARMode();
  else startARMode();
}

async function startARMode() {
  const toggleBtn = document.getElementById('btn-ar-toggle');
  const toggleLabel = document.getElementById('ar-toggle-label');
  const classicView = document.getElementById('map-classic');
  const arView = document.getElementById('ar-camera-view');

  /* Start AR camera */
  try {
    const constraints = {
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    };
    try {
      arCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch {
      arCameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
    }
    const arWebcam = document.getElementById('ar-webcam');
    if (arWebcam) {
      arWebcam.srcObject = arCameraStream;
      await new Promise((r) => { arWebcam.onloadedmetadata = r; });
      await arWebcam.play();
    }
  } catch (err) {
    console.error('AR camera failed:', err);
    speak('Camera permission is required for AR view.');
    return;
  }

  isARMode = true;

  /* Switch UI */
  classicView?.classList.add('hidden');
  arView?.classList.remove('hidden');
  toggleBtn?.classList.add('ar-active');
  if (toggleLabel) toggleLabel.textContent = 'Map';
  toggleBtn?.setAttribute('aria-label', 'Switch to flat map view');

  /* Init mini-map */
  if (!miniMapReady) {
    const miniContainer = document.getElementById('ar-mini-map');
    initMiniMap(miniContainer, 'ar');
    miniMapReady = true;
    setTimeout(() => {
      const fix = getLastFix();
      if (fix) updateMiniMapMarker(fix.lat, fix.lon);
    }, 150);
  }

  /* Populate initial AR info */
  const fix = getLastFix();
  if (fix) {
    const coordsEl = document.getElementById('ar-coords');
    if (coordsEl) coordsEl.textContent = `${fix.lat.toFixed(5)}, ${fix.lon.toFixed(5)}`;
    updateMiniMapMarker(fix.lat, fix.lon);
  }
  const addr = getLastAddress();
  if (addr) {
    const arAddr = document.getElementById('ar-address');
    if (arAddr) arAddr.textContent = addr.split(',').slice(0, 3).join(',');
  }

  /* Start compass */
  startCompass();

  /* Load nearby places into AR if we have them */
  const places = getLastPlaces();
  if (places.length) arPlacesCache = places;

  /* Start AR render loop */
  startARRenderLoop();

  /* Ensure GPS is running */
  openMapTab();

  speak('AR camera view. Point the phone to see nearby places.');
}

function stopARMode() {
  const toggleBtn = document.getElementById('btn-ar-toggle');
  const toggleLabel = document.getElementById('ar-toggle-label');
  const classicView = document.getElementById('map-classic');
  const arView = document.getElementById('ar-camera-view');

  isARMode = false;

  /* Stop AR camera */
  if (arCameraStream) {
    arCameraStream.getTracks().forEach((t) => t.stop());
    arCameraStream = null;
  }
  const arWebcam = document.getElementById('ar-webcam');
  if (arWebcam) arWebcam.srcObject = null;

  /* Stop compass */
  stopCompass();

  /* Stop render loop */
  if (arRenderRAF) cancelAnimationFrame(arRenderRAF);
  arRenderRAF = null;

  /* Switch UI back */
  arView?.classList.add('hidden');
  classicView?.classList.remove('hidden');
  toggleBtn?.classList.remove('ar-active');
  if (toggleLabel) toggleLabel.textContent = 'AR';
  toggleBtn?.setAttribute('aria-label', 'Switch to AR camera view');

  /* Clear AR labels */
  const layer = document.getElementById('ar-places-layer');
  if (layer) layer.innerHTML = '';

  speak('Returned to flat map view.');
}

/* ── Compass / DeviceOrientation ── */

function startCompass() {
  /* iOS 13+ requires permission */
  if (typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function') {
    DeviceOrientationEvent.requestPermission()
      .then((state) => {
        if (state === 'granted') attachCompassListener();
        else console.warn('Compass permission denied');
      })
      .catch((err) => console.warn('Compass permission error:', err));
  } else {
    attachCompassListener();
  }
}

function attachCompassListener() {
  arOrientationHandler = (event) => {
    /* webkitCompassHeading for iOS, alpha for Android */
    if (typeof event.webkitCompassHeading === 'number') {
      arCompassHeading = event.webkitCompassHeading;
    } else if (event.alpha !== null) {
      /* On Android, alpha is relative to device orientation, not north */
      arCompassHeading = event.absolute ? (360 - event.alpha) % 360 : event.alpha;
    }
    /* Update compass indicator */
    const el = document.getElementById('ar-heading-text');
    if (el && arCompassHeading !== null) {
      const dir = compassDirection(arCompassHeading);
      el.textContent = `${Math.round(arCompassHeading)}° ${dir}`;
    }
  };
  window.addEventListener('deviceorientation', arOrientationHandler, true);
}

function stopCompass() {
  if (arOrientationHandler) {
    window.removeEventListener('deviceorientation', arOrientationHandler, true);
    arOrientationHandler = null;
  }
  arCompassHeading = null;
}

function compassDirection(deg) {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/* ── AR Render Loop ── */

function startARRenderLoop() {
  if (arRenderRAF) cancelAnimationFrame(arRenderRAF);
  const tick = () => {
    if (!isARMode) return;
    renderARPlaces();
    arRenderRAF = requestAnimationFrame(tick);
  };
  arRenderRAF = requestAnimationFrame(tick);
}

function renderARPlaces() {
  const layer = document.getElementById('ar-places-layer');
  if (!layer) return;

  const fix = getLastFix();
  const heading = arCompassHeading;

  /* If no GPS or no compass, show a "no data" state */
  if (!fix || heading === null) {
    if (layer.childElementCount > 0 && !fix) layer.innerHTML = '';
    return;
  }

  const places = arPlacesCache;
  if (!places.length) {
    if (layer.childElementCount > 0) layer.innerHTML = '';
    return;
  }

  /* Camera FOV approximation: 120° horizontal */
  const FOV = 120;
  const halfFov = FOV / 2;

  /* Build or update pills */
  const containerW = layer.offsetWidth || 360;
  const containerH = layer.offsetHeight || 600;
  const verticalCenter = containerH * 0.45; /* Place labels in upper-middle band */

  /* Reuse existing DOM elements where possible */
  const existing = layer.querySelectorAll('.ar-place-pill');
  const existingMap = new Map();
  existing.forEach((el) => existingMap.set(el.dataset.name, el));

  const shown = new Set();

  places.forEach((place, idx) => {
    if (!place.lat || !place.lon) return;

    const bearing = bearingFromTo(fix.lat, fix.lon, place.lat, place.lon);
    let delta = bearing - heading;
    /* Normalize to -180..180 */
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;

    /* Only show places within the FOV */
    if (Math.abs(delta) > halfFov) {
      const el = existingMap.get(place.name);
      if (el) el.style.opacity = '0';
      return;
    }

    const dist = distanceBetween(fix.lat, fix.lon, place.lat, place.lon);
    const distStr = dist < 1000 ? `${Math.round(dist)}m` : `${(dist / 1000).toFixed(1)}km`;

    /* Horizontal position: map delta (-halfFov..halfFov) → (0%..100%) */
    const xPct = ((delta + halfFov) / FOV) * 100;
    /* Vertical: slight spread to avoid overlap */
    const yOffset = (idx % 5) * 28 - 56;

    shown.add(place.name);

    let pill = existingMap.get(place.name);
    if (!pill) {
      pill = document.createElement('div');
      pill.className = 'ar-place-pill';
      pill.dataset.name = place.name;
      pill.innerHTML = `
        <div class="ar-place-pill-dot"></div>
        <div class="ar-place-pill-label">
          <span class="ar-place-pill-name"></span>
          <span class="ar-place-pill-meta"></span>
        </div>`;
      layer.appendChild(pill);
    }

    pill.style.left = `${xPct}%`;
    pill.style.top = `${verticalCenter + yOffset}px`;
    pill.style.opacity = '1';

    const nameEl = pill.querySelector('.ar-place-pill-name');
    const metaEl = pill.querySelector('.ar-place-pill-meta');
    if (nameEl) nameEl.textContent = place.name;
    if (metaEl) metaEl.textContent = `${place.kind} · ${distStr}`;
  });

  /* Fade out pills that are no longer visible */
  existing.forEach((el) => {
    if (!shown.has(el.dataset.name)) el.style.opacity = '0';
  });

  /* Clean up pills that have been invisible for a while */
  setTimeout(() => {
    layer.querySelectorAll('.ar-place-pill').forEach((el) => {
      if (el.style.opacity === '0' && !shown.has(el.dataset.name)) el.remove();
    });
  }, 500);
}
