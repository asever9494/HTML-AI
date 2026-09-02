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
  model: initialModel,
  customModel: localStorage.getItem('openrouter_custom_model') || '',
  systemPrompt: localStorage.getItem('openrouter_system_prompt') || '당신은 친절하고 전문적이며 명확한 설명을 제공하는 스마트 AI 어시스턴트입니다.',
  temperature: parseFloat(localStorage.getItem('openrouter_temperature') || '0.7'),
  messages: [],
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
  currentModelBadge: document.getElementById('badgeModelName'),
  keyWarningBox: document.getElementById('keyWarningBox'),
  currentPromptStatus: document.getElementById('currentPromptStatus')
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initMarked();
  loadSettingsUI();
  setupEventListeners();
  checkApiKeyStatus();
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

// Check API key & show warning if missing
function checkApiKeyStatus() {
  const activeKey = getActiveApiKey();
  if (activeKey) {
    elements.keyWarningBox.classList.add('hidden');
  } else {
    elements.keyWarningBox.classList.remove('hidden');
  }
}

// Get active API key (UI state key priority -> Code constant -> LocalStorage fallback)
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

  // Set Model Select
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

  updateModelBadge();
}

// Update model badge label in header
function updateModelBadge() {
  const currentModel = getActiveModel();
  const shortName = currentModel.split('/').pop() || currentModel;
  elements.currentModelBadge.textContent = shortName;
}

// Get final selected model ID
function getActiveModel() {
  if (elements.modelSelect.value === 'custom') {
    return elements.customModelInput.value.trim() || 'google/gemini-2.5-flash';
  }
  return elements.modelSelect.value;
}

// Setup Event Listeners
function setupEventListeners() {
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

// Save Settings to State & LocalStorage
function saveSettings() {
  const newApiKey = elements.apiKeyInput.value.trim();
  const selectedModel = getActiveModel();
  const systemPrompt = elements.systemPromptInput.value.trim();
  const temperature = parseFloat(elements.tempSlider.value);

  state.apiKey = newApiKey;
  state.model = selectedModel;
  state.systemPrompt = systemPrompt;
  state.temperature = temperature;

  localStorage.setItem('openrouter_api_key', newApiKey);
  localStorage.setItem('openrouter_model', selectedModel);
  localStorage.setItem('openrouter_system_prompt', systemPrompt);
  localStorage.setItem('openrouter_temperature', temperature.toString());

  checkApiKeyStatus();
  updateModelBadge();

  elements.settingsModal.classList.add('hidden');
  alert('설정이 성공적으로 저장되었습니다!');
}

// Reset Settings
function resetSettings() {
  state.apiKey = OPENROUTER_API_KEY;
  state.model = 'google/gemini-2.5-flash';
  state.systemPrompt = '당신은 친절하고 전문적이며 명확한 설명을 제공하는 스마트 AI 어시스턴트입니다.';
  state.temperature = 0.7;

  localStorage.removeItem('openrouter_api_key');
  localStorage.removeItem('openrouter_model');
  localStorage.removeItem('openrouter_system_prompt');
  localStorage.removeItem('openrouter_temperature');

  loadSettingsUI();
  checkApiKeyStatus();
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

// Send User Message
async function handleSend() {
  const userText = elements.userInput.value.trim();
  if (!userText || state.isGenerating) return;

  const apiKey = getActiveApiKey();
  if (!apiKey) {
    alert('OpenRouter API 키가 필요합니다. app.js 코드의 OPENROUTER_API_KEY에 입력하거나 설정에서 입력해주세요.');
    elements.openSettingsBtn.click();
    return;
  }

  // Clear Input
  elements.userInput.value = '';
  elements.userInput.style.height = 'auto';

  // Hide Welcome Screen
  elements.welcomeScreen.classList.add('hidden');

  // Add User Message to UI & State
  appendMessage('user', userText);
  state.messages.push({ role: 'user', content: userText });

  // Prepare Assistant Message Bubble in UI
  const assistantBubble = appendMessage('assistant', '', true);

  // Start Generation
  state.isGenerating = true;
  toggleGeneratingUI(true);
  state.abortController = new AbortController();

  let accumulatedContent = '';

  try {
    const apiMessages = [
      { role: 'system', content: state.systemPrompt },
      ...state.messages
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.href,
        'X-Title': 'OpenRouter Direct AI Chatbot',
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
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

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
          // Ignore JSON parse errors for incomplete chunks
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
      const errDisplay = `⚠️ **오류가 발생했습니다.**\n\n\`${error.message}\`\n\n- API 키가 유효한지 확인해보세요.\n- 선택한 모델(${getActiveModel()})이 사용 가능한 상태인지 확인하세요.`;
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
    : '<i class="fa-solid fa-bot"></i>';

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
