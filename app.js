/**
 * =========================================================
 * 🔑 OpenRouter API Key Setup (오픈라우터 API 키 설정)
 * 실습용 키를 코드에 직접 넣으려면 아래 큰따옴표 사이에 입력하세요.
 * 예시: const OPENROUTER_API_KEY = "sk-or-v1-xxxxxxxxxxxx";
 * =========================================================
 */
const OPENROUTER_API_KEY = "";

// State Management
const storedModel = localStorage.getItem('openrouter_model');
const initialModel = (!storedModel || storedModel === 'google/gemini-2.5-flash:free') 
  ? 'google/gemini-2.5-flash' 
  : storedModel;

const state = {
  apiKey: OPENROUTER_API_KEY || localStorage.getItem('openrouter_api_key') || '',
  seoulApiKey: localStorage.getItem('seoul_api_key') || 'sample',
  model: initialModel,
  customModel: localStorage.getItem('openrouter_custom_model') || '',
  systemPrompt: localStorage.getItem('openrouter_system_prompt') || '당신은 서울시 내 주변 공공교육 지도 데이터를 이용하여 시민들에게 맞춤형 강좌 및 장소 안내를 제공하는 스마트 AI 어시스턴트입니다.',
  temperature: parseFloat(localStorage.getItem('openrouter_temperature') || '0.5'),
  messages: [],
  educationData: [],
  userLocation: { lat: 37.5665, lng: 126.9780, name: '서울시청 (기본)' }, // Default Seoul City Hall
  map: null,
  markersLayer: null,
  userMarker: null,
  activeView: 'chat', // 'chat' or 'map'
  isGenerating: false,
  abortController: null
};

// DOM Elements
const elements = {
  welcomeScreen: document.getElementById('welcomeScreen'),
  messagesContainer: document.getElementById('messagesContainer'),
  userInput: document.getElementById('userInput'),
  sendBtn: document.getElementById('sendBtn'),
  stopBtn: document.getElementById('stopBtn'),
  clearChatBtn: document.getElementById('clearChatBtn'),
  openSettingsBtn: document.getElementById('openSettingsBtn'),
  closeSettingsBtn: document.getElementById('closeSettingsBtn'),
  settingsModal: document.getElementById('settingsModal'),
  apiKeyInput: document.getElementById('apiKeyInput'),
  seoulApiKeyInput: document.getElementById('seoulApiKeyInput'),
  toggleKeyVisibility: document.getElementById('toggleKeyVisibility'),
  eyeIcon: document.getElementById('eyeIcon'),
  modelSelect: document.getElementById('modelSelect'),
  customModelWrapper: document.getElementById('customModelWrapper'),
  customModelInput: document.getElementById('customModelInput'),
  systemPromptInput: document.getElementById('systemPromptInput'),
  tempSlider: document.getElementById('tempSlider'),
  tempValue: document.getElementById('tempValue'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  resetSettingsBtn: document.getElementById('resetSettingsBtn'),
  dataSummaryBanner: document.getElementById('dataSummaryBanner'),
  tabChatBtn: document.getElementById('tabChatBtn'),
  tabMapBtn: document.getElementById('tabMapBtn'),
  chatMainView: document.getElementById('chatMainView'),
  mapSectionView: document.getElementById('mapSectionView'),
  locateUserBtn: document.getElementById('locateUserBtn'),
  radiusSelect: document.getElementById('radiusSelect'),
  locationStatusText: document.getElementById('locationStatusText')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', async () => {
  initMarked();
  loadSettingsUI();
  setupEventListeners();
  getUserGeolocation();
  await loadSeoulEducationData();
  initLeafletMap();
});

// Configure Marked & Highlight.js
function initMarked() {
  if (window.marked) {
    marked.setOptions({
      highlight: function (code, lang) {
        if (window.hljs) {
          const language = hljs.getLanguage(lang) ? lang : 'plaintext';
          return hljs.highlight(code, { language }).value;
        }
        return code;
      },
      breaks: true
    });
  }
}

// Get User GPS Location
function getUserGeolocation() {
  if ('geolocation' in navigator) {
    elements.locationStatusText.textContent = '내 위치 찾기 위치 권한 요청 중...';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        state.userLocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          name: '현재 내 위치'
        };
        elements.locationStatusText.textContent = `내 위치: (${state.userLocation.lat.toFixed(4)}, ${state.userLocation.lng.toFixed(4)})`;
        if (state.map) {
          updateUserMapMarker();
          updateMapMarkers();
        }
      },
      (err) => {
        console.warn('Geolocation Error:', err);
        elements.locationStatusText.textContent = '내 위치: 서울시청 (기본값 사용)';
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  } else {
    elements.locationStatusText.textContent = '내 위치: 브라우저 위치 미지원';
  }
}

// Initialize Leaflet Map
function initLeafletMap() {
  if (!window.L || state.map) return;

  state.map = L.map('mapContainer', {
    center: [state.userLocation.lat, state.userLocation.lng],
    zoom: 13
  });

  // 100% Free OpenStreetMap Tile Layer (API Key 불필요)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(state.map);

  state.markersLayer = L.layerGroup().addTo(state.map);
  updateUserMapMarker();
  updateMapMarkers();
}

// Update User Marker on Map
function updateUserMapMarker() {
  if (!state.map) return;

  if (state.userMarker) {
    state.map.removeLayer(state.userMarker);
  }

  const userIcon = L.divIcon({
    className: 'user-gps-marker',
    html: `<div style="background:#3b82f6; width:16px; height:16px; border-radius:50%; border:3px solid #fff; box-shadow:0 0 12px rgba(59,130,246,0.8);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  state.userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], { icon: userIcon })
    .addTo(state.map)
    .bindPopup(`<strong>📍 내 위치</strong><br>${state.userLocation.name}`);
}

// Update Program Markers on Map
function updateMapMarkers() {
  if (!state.map || !state.markersLayer) return;

  state.markersLayer.clearLayers();
  const radiusFilter = elements.radiusSelect.value;
  const maxRadiusKm = radiusFilter === 'all' ? 999 : parseFloat(radiusFilter);

  state.educationData.forEach(item => {
    const lat = parseFloat(item.lat || item.Y);
    const lng = parseFloat(item.lng || item.X);

    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return;

    const distKm = calculateDistance(state.userLocation.lat, state.userLocation.lng, lat, lng);
    item.distKm = distKm;

    if (distKm <= maxRadiusKm) {
      const isAvailable = item.status === '접수중' || item.status === '안내중';
      const markerColor = isAvailable ? '#10b981' : '#64748b';

      const customIcon = L.divIcon({
        className: 'program-pin-marker',
        html: `<div style="background:${markerColor}; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 2px 6px rgba(0,0,0,0.5);"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9]
      });

      const popupHtml = `
        <div class="map-popup-card">
          <span class="map-popup-tag">${item.category} • ${item.payType}</span>
          <h4>${item.title}</h4>
          <p><i class="fa-solid fa-location-dot"></i> ${item.place} (${item.area})</p>
          <p><i class="fa-solid fa-user"></i> ${item.target}</p>
          <p><i class="fa-solid fa-route"></i> 내 위치에서 ${distKm.toFixed(1)}km</p>
          <div class="map-popup-actions">
            <a href="${item.url}" target="_blank" class="map-popup-btn btn-link">예약하기</a>
            <button onclick="askAboutProgram('${item.id}')" class="map-popup-btn btn-ask">AI 질문</button>
          </div>
        </div>
      `;

      const marker = L.marker([lat, lng], { icon: customIcon })
        .bindPopup(popupHtml);

      state.markersLayer.addLayer(marker);
    }
  });
}

// Global handler to ask AI about specific program from map popup
window.askAboutProgram = function(id) {
  const item = state.educationData.find(d => d.id === id);
  if (item) {
    elements.userInput.value = `'${item.title}' (${item.place}) 강좌 상세 정보와 수강 대상, 예약 방법을 안내해줘.`;
    switchView('chat');
    handleSend();
  }
};

// Calculate Haversine Distance between two points in km
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Fetch & Load Real-time Seoul Public Reservation Education Data
async function loadSeoulEducationData() {
  const key = state.seoulApiKey || 'sample';
  const limit = key === 'sample' ? 5 : 100;
  const url = `http://openAPI.seoul.go.kr:8088/${key}/json/ListPublicReservationEducation/1/${limit}/`;

  try {
    elements.dataSummaryBanner.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 서울시 열린데이터광장에서 교육 및 지도 데이터 불러오는 중...`;
    
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API HTTP ${response.status}`);
    
    const json = await response.json();
    const resultData = json.ListPublicReservationEducation;

    if (resultData && resultData.row) {
      state.educationData = resultData.row.map(item => ({
        id: item.SVCID,
        title: cleanText(item.SVCNM),
        category: item.MINCLASSNM || item.MAXCLASSNM || '교육강좌',
        status: item.SVCSTATNM || '안내중',
        payType: item.PAYATNM || '무료',
        place: item.PLACENM || '서울시 공공시설',
        target: cleanText(item.USETGTINFO) || '누구나',
        url: item.SVCURL,
        area: item.AREANM || '서울시',
        lat: parseFloat(item.Y) || 37.5705,
        lng: parseFloat(item.X) || 126.9703,
        openStart: item.SVCOPNBGNDT ? item.SVCOPNBGNDT.substring(0, 10) : '',
        openEnd: item.SVCOPNENDDT ? item.SVCOPNENDDT.substring(0, 10) : '',
        receiptStart: item.RCPTBGNDT ? item.RCPTBGNDT.substring(0, 16) : '',
        receiptEnd: item.RCPTENDDT ? item.RCPTENDDT.substring(0, 16) : '',
        tel: item.TELNO || '',
        img: item.IMGURL || ''
      }));

      const totalCount = resultData.list_total_count || state.educationData.length;
      elements.dataSummaryBanner.innerHTML = `
        <i class="fa-solid fa-circle-check" style="color:#10b981;"></i> 
        서울시 실시간 공공교육 데이터 <strong>${state.educationData.length}건</strong> (지도 좌표 포함) 연동 완료!
      `;

      if (state.map) {
        updateMapMarkers();
      }
    } else {
      throw new Error(resultData?.RESULT?.MESSAGE || '데이터 없음');
    }
  } catch (err) {
    console.warn('서울시 API 연동 경고 (기본 데이터 사용):', err);
    elements.dataSummaryBanner.innerHTML = `
      <i class="fa-solid fa-triangle-exclamation" style="color:#f59e0b;"></i> 
      기본 교육 샘플 데이터로 동작합니다.
    `;
    useFallbackEducationData();
    if (state.map) updateMapMarkers();
  }
}

// Fallback sample education data with Coordinates
function useFallbackEducationData() {
  state.educationData = [
    {
      id: 'S260210133959300415',
      title: "2026년 상·하반기 '내 친구 박물관' 교육생 모집",
      category: "역사",
      status: "접수종료",
      payType: "무료",
      place: "서울역사박물관",
      target: "어린이(내 친구 박물관)",
      url: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260210133959300415",
      area: "종로구",
      lat: 37.570500279648634,
      lng: 126.97037430869801,
      receiptStart: "2026-02-19 10:00",
      receiptEnd: "2026-03-09 18:00",
      tel: "02-724-0236"
    },
    {
      id: 'S260519103905622756',
      title: "내 인생의 18번, 시대의 명곡이 되다 수강생 모집",
      category: "역사",
      status: "접수종료",
      payType: "무료",
      place: "서울역사박물관",
      target: "성인(55세 이상 성인)",
      url: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260519103905622756",
      area: "종로구",
      lat: 37.570500279648634,
      lng: 126.97037430869801,
      receiptStart: "2026-08-19 10:00",
      receiptEnd: "2026-08-30 17:00",
      tel: "02-724-0199"
    },
    {
      id: 'S260622155501556026',
      title: "제49기 <중학생 인턴제> 수강생 모집",
      category: "역사",
      status: "접수종료",
      payType: "무료",
      place: "서울역사박물관",
      target: "청소년(중학생 1-3학년)",
      url: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260622155501556026",
      area: "종로구",
      lat: 37.570500279648634,
      lng: 126.97037430869801,
      receiptStart: "2026-06-29 10:00",
      receiptEnd: "2026-07-31 17:00",
      tel: "02-724-0236"
    },
    {
      id: 'S260804164236879206',
      title: "2026 서울역사박물관대학 (심화반)",
      category: "역사",
      status: "접수종료",
      payType: "무료",
      place: "서울역사박물관",
      target: "성인",
      url: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260804164236879206",
      area: "종로구",
      lat: 37.570500279648634,
      lng: 126.97037430869801,
      receiptStart: "2026-08-14 10:00",
      receiptEnd: "2026-08-21 17:00",
      tel: "02-724-0199"
    },
    {
      id: 'S260806090535821750',
      title: "2026년 하반기 '우리 가족 경희궁 탐험대' 교육생 모집",
      category: "역사",
      status: "예약마감",
      payType: "무료",
      place: "서울역사박물관",
      target: "가족(초등학교 1~6학년 자녀 동반)",
      url: "https://yeyak.seoul.go.kr/web/reservation/selectReservView.do?rsv_svc_id=S260806090535821750",
      area: "종로구",
      lat: 37.570500279648634,
      lng: 126.97037430869801,
      receiptStart: "2026-08-24 10:00",
      receiptEnd: "2026-11-15 17:00",
      tel: "02-724-9750"
    }
  ];
}

// Clean HTML tags and special entities
function cleanText(text) {
  if (!text) return '';
  return text.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&middot;/g, '·').trim();
}

// Search Relevant Programs based on User Question (With Distance Ranking)
function findRelevantEducationItems(query) {
  if (!state.educationData || state.educationData.length === 0) return [];
  
  const q = query.toLowerCase();
  const keywords = q.split(/\s+/).filter(k => k.length > 1);

  const scored = state.educationData.map(item => {
    let score = 0;
    const fullContent = `${item.title} ${item.category} ${item.area} ${item.place} ${item.target} ${item.payType} ${item.status}`.toLowerCase();

    // Distance bonus for nearby programs
    const dist = item.distKm || calculateDistance(state.userLocation.lat, state.userLocation.lng, item.lat, item.lng);
    item.distKm = dist;
    
    if (q.includes('내 주변') || q.includes('근처') || q.includes('가까운')) {
      if (dist <= 3) score += 5;
      else if (dist <= 5) score += 3;
    }

    if (q.includes('어린이') || q.includes('초등')) {
      if (item.target.includes('어린이') || item.target.includes('초등') || item.target.includes('가족')) score += 3;
    }
    if (q.includes('성인') || q.includes('시니어')) {
      if (item.target.includes('성인')) score += 3;
    }
    if (q.includes('청소년') || q.includes('중학생')) {
      if (item.target.includes('청소년') || item.target.includes('중학생')) score += 3;
    }
    if (q.includes('무료')) {
      if (item.payType.includes('무료')) score += 2;
    }
    if (q.includes('역사') || q.includes('박물관')) {
      if (item.category.includes('역사') || item.title.includes('박물관') || item.place.includes('박물관')) score += 3;
    }

    keywords.forEach(kw => {
      if (fullContent.includes(kw)) score += 2;
    });

    return { item, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const matched = scored.filter(s => s.score > 0).map(s => s.item);

  return matched.length > 0 ? matched.slice(0, 5) : state.educationData.slice(0, 5);
}

// Check API key status
function checkApiKeyStatus() {
  const activeKey = getActiveApiKey();
}

// Get active OpenRouter API key
function getActiveApiKey() {
  if (state.apiKey && state.apiKey.trim() !== "") {
    return state.apiKey.trim();
  }
  if (OPENROUTER_API_KEY && OPENROUTER_API_KEY.trim() !== "") {
    return OPENROUTER_API_KEY.trim();
  }
  return '';
}

// Load settings into Modal UI
function loadSettingsUI() {
  elements.apiKeyInput.value = getActiveApiKey();
  elements.seoulApiKeyInput.value = state.seoulApiKey || 'sample';

  const options = Array.from(elements.modelSelect.options).map(opt => opt.value);
  if (options.includes(state.model)) {
    elements.modelSelect.value = state.model;
    elements.customModelWrapper.classList.add('hidden');
  } else {
    elements.modelSelect.value = 'custom';
    elements.customModelWrapper.classList.remove('hidden');
    elements.customModelInput.value = state.model;
  }

  elements.systemPromptInput.value = state.systemPrompt;
  elements.tempSlider.value = state.temperature;
  elements.tempValue.textContent = state.temperature.toFixed(1);
}

// Get final selected model ID
function getActiveModel() {
  if (elements.modelSelect.value === 'custom') {
    return elements.customModelInput.value.trim() || 'google/gemini-2.5-flash';
  }
  return elements.modelSelect.value;
}

// Switch between Chat and Map views
function switchView(viewName) {
  state.activeView = viewName;
  if (viewName === 'chat') {
    elements.tabChatBtn.classList.add('active');
    elements.tabMapBtn.classList.remove('active');
    elements.chatMainView.classList.remove('hidden');
    elements.mapSectionView.classList.add('hidden');
  } else {
    elements.tabChatBtn.classList.remove('active');
    elements.tabMapBtn.classList.add('active');
    elements.chatMainView.classList.add('hidden');
    elements.mapSectionView.classList.remove('hidden');
    
    // Invalidate Leaflet map size on show
    setTimeout(() => {
      if (state.map) {
        state.map.invalidateSize();
      }
    }, 100);
  }
}

// Setup Event Listeners
function setupEventListeners() {
  // Tab View Switch
  elements.tabChatBtn.addEventListener('click', () => switchView('chat'));
  elements.tabMapBtn.addEventListener('click', () => switchView('map'));

  // User GPS locate button
  elements.locateUserBtn.addEventListener('click', () => {
    getUserGeolocation();
    switchView('map');
  });

  // Radius Select Filter Change
  elements.radiusSelect.addEventListener('change', updateMapMarkers);

  // Auto-resize textarea
  elements.userInput.addEventListener('input', () => {
    elements.userInput.style.height = 'auto';
    elements.userInput.style.height = Math.min(elements.userInput.scrollHeight, 160) + 'px';
  });

  // Enter to send (Shift + Enter for new line)
  elements.userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  });

  // Buttons
  elements.sendBtn.addEventListener('click', handleSend);
  elements.stopBtn.addEventListener('click', handleStop);
  elements.clearChatBtn.addEventListener('click', handleClearChat);

  // Suggestion chips
  document.querySelectorAll('.suggestion-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        elements.userInput.value = prompt;
        handleSend();
      }
    });
  });

  // Settings Modal Controls
  elements.openSettingsBtn.addEventListener('click', () => {
    loadSettingsUI();
    elements.settingsModal.classList.remove('hidden');
  });

  elements.closeSettingsBtn.addEventListener('click', () => {
    elements.settingsModal.classList.add('hidden');
  });

  elements.settingsModal.addEventListener('click', (e) => {
    if (e.target === elements.settingsModal) {
      elements.settingsModal.classList.add('hidden');
    }
  });

  // Toggle API Key visibility
  elements.toggleKeyVisibility.addEventListener('click', () => {
    const type = elements.apiKeyInput.getAttribute('type') === 'password' ? 'text' : 'password';
    elements.apiKeyInput.setAttribute('type', type);
    elements.eyeIcon.className = type === 'password' ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
  });

  // Model Select Change
  elements.modelSelect.addEventListener('change', () => {
    if (elements.modelSelect.value === 'custom') {
      elements.customModelWrapper.classList.remove('hidden');
    } else {
      elements.customModelWrapper.classList.add('hidden');
    }
  });

  // Temperature Slider
  elements.tempSlider.addEventListener('input', (e) => {
    elements.tempValue.textContent = parseFloat(e.target.value).toFixed(1);
  });

  // Save Settings
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  
  // Reset Settings
  elements.resetSettingsBtn.addEventListener('click', resetSettings);
}

// Save Settings
async function saveSettings() {
  const newApiKey = elements.apiKeyInput.value.trim();
  const newSeoulApiKey = elements.seoulApiKeyInput.value.trim() || 'sample';
  const selectedModel = getActiveModel();
  const systemPrompt = elements.systemPromptInput.value.trim();
  const temperature = parseFloat(elements.tempSlider.value);

  state.apiKey = newApiKey;
  state.seoulApiKey = newSeoulApiKey;
  state.model = selectedModel;
  state.systemPrompt = systemPrompt;
  state.temperature = temperature;

  localStorage.setItem('openrouter_api_key', newApiKey);
  localStorage.setItem('seoul_api_key', newSeoulApiKey);
  localStorage.setItem('openrouter_model', selectedModel);
  localStorage.setItem('openrouter_system_prompt', systemPrompt);
  localStorage.setItem('openrouter_temperature', temperature.toString());

  checkApiKeyStatus();
  elements.settingsModal.classList.add('hidden');
  await loadSeoulEducationData();
  alert('설정이 성공적으로 저장되었습니다!');
}

// Reset Settings
function resetSettings() {
  state.apiKey = OPENROUTER_API_KEY;
  state.seoulApiKey = 'sample';
  state.model = 'google/gemini-2.5-flash';
  state.systemPrompt = '당신은 서울시 내 주변 공공교육 지도 데이터를 이용하여 시민들에게 맞춤형 강좌 및 장소 안내를 제공하는 스마트 AI 어시스턴트입니다.';
  state.temperature = 0.5;

  localStorage.removeItem('openrouter_api_key');
  localStorage.removeItem('seoul_api_key');
  localStorage.removeItem('openrouter_model');
  localStorage.removeItem('openrouter_system_prompt');
  localStorage.removeItem('openrouter_temperature');

  loadSettingsUI();
  checkApiKeyStatus();
  loadSeoulEducationData();
}

// Clear Chat History
function handleClearChat() {
  if (state.messages.length === 0) return;

  if (confirm('대화 내용을 모두 삭제하시겠습니까?')) {
    state.messages = [];
    elements.messagesContainer.innerHTML = '';
    elements.welcomeScreen.classList.remove('hidden');
  }
}

// Stop Streaming Response
function handleStop() {
  if (state.abortController) {
    state.abortController.abort();
    state.isGenerating = false;
    toggleGeneratingUI(false);
  }
}

// Send User Message with Location & Context Injection
async function handleSend() {
  const userText = elements.userInput.value.trim();
  if (!userText || state.isGenerating) return;

  const apiKey = getActiveApiKey();
  if (!apiKey) {
    alert('OpenRouter API 키가 필요합니다. 설정 메뉴에서 입력해주세요.');
    elements.openSettingsBtn.click();
    return;
  }

  // Clear Input
  elements.userInput.value = '';
  elements.userInput.style.height = 'auto';

  // Hide Welcome Screen & Ensure Chat View
  elements.welcomeScreen.classList.add('hidden');
  if (state.activeView !== 'chat') {
    switchView('chat');
  }

  // Add User Message to UI & State
  appendMessage('user', userText);
  state.messages.push({ role: 'user', content: userText });

  // Retrieve matching Seoul Public Service Education Items & Distances
  const relevantItems = findRelevantEducationItems(userText);
  let dataContext = `\n\n[사용자 현재 위치 정보]\n- 위도: ${state.userLocation.lat.toFixed(4)}, 경도: ${state.userLocation.lng.toFixed(4)} (${state.userLocation.name})\n`;
  
  if (relevantItems.length > 0) {
    dataContext += `\n[실시간 서울시 공공교육 지도 추천 정보]\n` +
      relevantItems.map((item, idx) => `
${idx + 1}. 강좌명: ${item.title}
   - 분류/상태: ${item.category} / ${item.status} (${item.payType})
   - 대상: ${item.target}
   - 장소/지역: ${item.place} (${item.area})
   - 내 위치에서의 거리: 약 ${item.distKm ? item.distKm.toFixed(1) : '?'}km
   - 접수기간: ${item.receiptStart} ~ ${item.receiptEnd}
   - 예약링크: ${item.url}
      `).join('\n');
  }

  // Prepare Assistant Message Bubble in UI
  const assistantBubble = appendMessage('assistant', '', true);
  
  // Start Generation
  state.isGenerating = true;
  toggleGeneratingUI(true);
  state.abortController = new AbortController();

  let accumulatedContent = '';

  try {
    const fullSystemPrompt = `${state.systemPrompt}\n\n사용자의 위치와 실시간 서울시 교육 데이터 기반으로 가장 가까운 유용한 강좌를 추천하세요. 각 추천 프로그램마다 **[예약 바로가기](URL)** 링크와 거리(km), 장소를 카드 형태로 작성해 주세요.${dataContext}`;

    const apiMessages = [
      { role: 'system', content: fullSystemPrompt },
      ...state.messages
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'Seoul Nearby Education Map AI Chatbot',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: getActiveModel(),
        messages: apiMessages,
        temperature: state.temperature,
        stream: true
      }),
      signal: state.abortController.signal
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      const errorMsg = errJson.error?.message || `HTTP 오류: ${response.status}`;
      throw new Error(errorMsg);
    }

    // Read SSE Stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const dataStr = trimmed.replace(/^data: /, '');

        if (dataStr === '[DONE]') break;

        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            accumulatedContent += delta;
            updateAssistantBubble(assistantBubble, accumulatedContent);
            scrollToBottom();
          }
        } catch (err) {
          // Ignore incomplete chunk parse errors
        }
      }
    }

    // Save final assistant message to state
    state.messages.push({ role: 'assistant', content: accumulatedContent });

  } catch (error) {
    if (error.name === 'AbortError') {
      accumulatedContent += '\n\n*(답변 생성이 중단되었습니다.)*';
      updateAssistantBubble(assistantBubble, accumulatedContent);
    } else {
      console.error('OpenRouter API Call Error:', error);
      const errDisplay = `⚠️ **오류가 발생했습니다.**\n\n\`${error.message}\`\n\n- API 키가 유효한지 확인해보세요.`;
      updateAssistantBubble(assistantBubble, errDisplay);
    }
  } finally {
    state.isGenerating = false;
    state.abortController = null;
    toggleGeneratingUI(false);
  }
}

// Toggle UI controls during response generation
function toggleGeneratingUI(isGenerating) {
  if (isGenerating) {
    elements.sendBtn.classList.add('hidden');
    elements.stopBtn.classList.remove('hidden');
  } else {
    elements.sendBtn.classList.remove('hidden');
    elements.stopBtn.classList.add('hidden');
  }
}

// Append message row to DOM
function appendMessage(role, content, isTyping = false) {
  const row = document.createElement('div');
  row.className = `message-row ${role}-row`;

  const avatar = document.createElement('div');
  avatar.className = 'avatar';
  avatar.innerHTML = role === 'user' 
    ? '<i class="fa-solid fa-user"></i>' 
    : '<i class="fa-solid fa-map-location-dot"></i>';

  const wrapper = document.createElement('div');
  wrapper.className = 'message-content-wrapper';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (isTyping && !content) {
    bubble.innerHTML = `
      <div class="typing-indicator">
        <div class="dot-flashing"></div>
        <div class="dot-flashing"></div>
        <div class="dot-flashing"></div>
      </div>
    `;
  } else {
    renderBubbleContent(bubble, content, role);
  }

  wrapper.appendChild(bubble);
  row.appendChild(avatar);
  row.appendChild(wrapper);
  elements.messagesContainer.appendChild(row);
  scrollToBottom();

  return bubble;
}

// Update Assistant Bubble with parsed markdown
function updateAssistantBubble(bubble, markdownText) {
  renderBubbleContent(bubble, markdownText, 'assistant');
  attachCodeCopyButtons(bubble);
}

// Render markdown/HTML inside bubble
function renderBubbleContent(bubble, text, role) {
  if (role === 'assistant') {
    if (window.marked) {
      bubble.innerHTML = marked.parse(text);
    } else {
      bubble.textContent = text;
    }
  } else {
    bubble.textContent = text;
  }
}

// Attach Copy Buttons to Code Blocks
function attachCodeCopyButtons(container) {
  const preElements = container.querySelectorAll('pre');
  preElements.forEach((pre) => {
    if (pre.parentElement.classList.contains('code-block-container')) return;

    const codeEl = pre.querySelector('code');
    let lang = 'code';
    if (codeEl) {
      const langClass = Array.from(codeEl.classList).find(c => c.startsWith('language-'));
      if (langClass) lang = langClass.replace('language-', '');
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'code-block-container';

    const header = document.createElement('div');
    header.className = 'code-header';
    header.innerHTML = `
      <span>${lang}</span>
      <button class="copy-code-btn"><i class="fa-regular fa-copy"></i> 복사</button>
    `;

    const copyBtn = header.querySelector('.copy-code-btn');
    copyBtn.addEventListener('click', () => {
      const codeText = codeEl ? codeEl.innerText : pre.innerText;
      navigator.clipboard.writeText(codeText).then(() => {
        copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> 완료!';
        setTimeout(() => {
          copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i> 복사';
        }, 2000);
      });
    });

    pre.parentNode.insertBefore(wrapper, pre);
    wrapper.appendChild(header);
    wrapper.appendChild(pre);
  });
}

// Scroll chat container to bottom
function scrollToBottom() {
  const chatMain = document.querySelector('.chat-main');
  chatMain.scrollTop = chatMain.scrollHeight;
}
