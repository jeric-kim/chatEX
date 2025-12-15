const loginView = document.getElementById('login-view');
const chatView = document.getElementById('chat-view');
const loginForm = document.getElementById('login-form');
const nicknameInput = document.getElementById('nickname-input');
const passwordInput = document.getElementById('password-input');
const currentNickname = document.getElementById('current-nickname');
const chatList = document.getElementById('chat-list');
const chatEmpty = document.getElementById('chat-empty');
const sortSelect = document.getElementById('sort-select');
const refreshBtn = document.getElementById('refresh-btn');
const autoRefreshSelect = document.getElementById('auto-refresh');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');
const fab = document.getElementById('fab');
const conversationView = document.getElementById('conversation-view');
const backBtn = document.getElementById('back-btn');
const activePartner = document.getElementById('active-partner');
const messageList = document.getElementById('message-list');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');
const searchModal = document.getElementById('search-modal');
const closeModalBtn = document.getElementById('close-modal');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const startChatBtn = document.getElementById('start-chat-btn');

const NICKNAME_POOL = [
  '노랑우산',
  '푸른별',
  '도토리톡',
  '따뜻한차',
  '새벽바람',
  '도시여행자',
  '번개냥',
  '별빛달빛',
  '핑퐁',
  '크렘브륄레',
  '라벤더향기',
  '버터쿠키',
  '달리는고래',
  '사과쨈'
];

function buildDirectory() {
  const expanded = [];
  NICKNAME_POOL.forEach((base) => {
    expanded.push(`${base}`);
    for (let i = 0; i < 3; i += 1) {
      expanded.push(`${base}#${Math.floor(Math.random() * 9000 + 1000)}`);
    }
  });
  return expanded;
}

const SERVER_KEY = 'chatEX-server';

const state = {
  user: null,
  chats: [],
  sortOrder: 'latest',
  autoRefreshMs: 0,
  autoRefreshTimer: null,
  activeChatId: null,
  selectedSearch: null,
  directory: [],
  chatMeta: {},
};

function randomNickname() {
  const index = Math.floor(Math.random() * NICKNAME_POOL.length);
  return `${NICKNAME_POOL[index]}#${Math.floor(Math.random() * 900 + 100)}`;
}

function formatTimestamp(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

function normalizeNickname(name) {
  return name?.trim().toLowerCase();
}

function getServer() {
  const stored = localStorage.getItem(SERVER_KEY);
  if (!stored) {
    return { users: [], conversations: {} };
  }
  try {
    const parsed = JSON.parse(stored);
    return {
      users: parsed.users || [],
      conversations: parsed.conversations || {},
    };
  } catch (error) {
    console.error('서버 데이터 로드 실패', error);
    return { users: [], conversations: {} };
  }
}

function saveServer(server) {
  localStorage.setItem(SERVER_KEY, JSON.stringify(server));
}

function ensureUserRegistered(nickname) {
  const server = getServer();
  const normalized = normalizeNickname(nickname);
  if (!server.users.some((user) => normalizeNickname(user) === normalized)) {
    server.users.push(nickname);
    saveServer(server);
  }
  return server;
}

function conversationKey(a, b) {
  return [normalizeNickname(a), normalizeNickname(b)].sort().join('|');
}

function upsertConversation(partner) {
  const server = getServer();
  const id = conversationKey(state.user.nickname, partner);
  const existing = server.conversations[id];

  if (!existing) {
    server.conversations[id] = {
      id,
      participants: [state.user.nickname, partner],
      createdAt: new Date().toISOString(),
      messages: [],
    };
    saveServer(server);
  }

  return server.conversations[id];
}

function truncateContent(text) {
  if (text.length <= 15) return text;
  return `${text.slice(0, 15)}...`;
}

function persistSession() {
  if (!state.user) return;
  const serialized = state.chats.map((chat) => ({
    ...chat,
    createdAt: chat.createdAt.toISOString(),
    messages: chat.messages.map((msg) => ({ ...msg, timestamp: msg.timestamp.toISOString() })),
  }));
  localStorage.setItem(
    'chatEX-session',
    JSON.stringify({
      user: state.user,
      chats: serialized,
      sortOrder: state.sortOrder,
      autoRefreshMs: state.autoRefreshMs,
      directory: state.directory,
      chatMeta: Object.fromEntries(
        Object.entries(state.chatMeta).map(([id, meta]) => [id, { ...meta, lastRead: meta.lastRead?.toISOString?.() }])
      ),
    })
  );
}

function loadSession() {
  const stored = localStorage.getItem('chatEX-session');
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.user = parsed.user;
    state.chats = (parsed.chats || []).map((chat) => ({
      ...chat,
      createdAt: new Date(chat.createdAt || Date.now()),
      messages: (chat.messages || []).map((msg) => ({ ...msg, timestamp: new Date(msg.timestamp) })),
    }));
    state.sortOrder = parsed.sortOrder || 'latest';
    state.autoRefreshMs = parsed.autoRefreshMs || 0;
    state.directory = parsed.directory || buildDirectory();
    state.chatMeta = Object.fromEntries(
      Object.entries(parsed.chatMeta || {}).map(([id, meta]) => [id, { ...meta, lastRead: meta.lastRead ? new Date(meta.lastRead) : new Date(0) }])
    );
  } catch (error) {
    console.error('세션 로드 실패', error);
  }
}

function clearSession() {
  localStorage.removeItem('chatEX-session');
  state.user = null;
  state.chats = [];
  state.activeChatId = null;
  state.directory = [];
  state.chatMeta = {};
  stopAutoRefresh();
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 1800);
}

function toggleView(isLoggedIn) {
  if (isLoggedIn) {
    loginView.classList.add('hidden');
    chatView.classList.remove('hidden');
  } else {
    chatView.classList.add('hidden');
    loginView.classList.remove('hidden');
  }
}

function lastMessage(chat) {
  if (!chat.messages.length) return null;
  return chat.messages[chat.messages.length - 1];
}

function sortChats(list) {
  return [...list].sort((a, b) => {
    const aLast = lastMessage(a)?.timestamp?.getTime?.() || a.createdAt.getTime();
    const bLast = lastMessage(b)?.timestamp?.getTime?.() || b.createdAt.getTime();
    return state.sortOrder === 'latest' ? bLast - aLast : aLast - bLast;
  });
}

function syncFromServer() {
  if (!state.user) return;
  const server = getServer();
  const relevant = Object.values(server.conversations).filter((conv) =>
    conv.participants.some((p) => normalizeNickname(p) === normalizeNickname(state.user.nickname))
  );

  const rebuilt = relevant.map((conv) => {
    const partner = conv.participants.find((p) => normalizeNickname(p) !== normalizeNickname(state.user.nickname)) ||
      state.user.nickname;
    const messages = (conv.messages || []).map((msg) => ({
      ...msg,
      timestamp: new Date(msg.timestamp),
    }));
    const createdAt = conv.createdAt ? new Date(conv.createdAt) : messages[0]?.timestamp || new Date();
    const meta = state.chatMeta[conv.id] || { lastRead: new Date(0) };
    const hasNew = messages.some(
      (msg) => msg.sender && normalizeNickname(msg.sender) !== normalizeNickname(state.user.nickname) && msg.timestamp > meta.lastRead
    );

    return {
      id: conv.id,
      partner,
      createdAt,
      messages,
      hasNew,
    };
  });

  state.chats = rebuilt;
  state.directory = Array.from(new Set([...(server.users || []), ...state.directory]));
}

function renderChats() {
  chatList.innerHTML = '';
  const sorted = sortChats(state.chats);
  chatEmpty.classList.toggle('hidden', sorted.length > 0);

  const template = document.getElementById('chat-item-template');
  sorted.forEach((chat) => {
    const clone = template.content.cloneNode(true);
    const preview = lastMessage(chat);

    clone.querySelector('.chat-item__name').textContent = chat.partner;
    const timeSource = preview ? preview.timestamp : chat.createdAt;
    clone.querySelector('.chat-item__timestamp').textContent = formatTimestamp(timeSource);
    clone.querySelector('.chat-item__preview').textContent = preview
      ? truncateContent(preview.content)
      : '메시지를 남겨 보세요.';
    const badge = clone.querySelector('.chat-item__badge');
    badge.classList.toggle('hidden', !chat.hasNew);

    const item = clone.querySelector('.chat-item');
    item.addEventListener('click', () => openConversation(chat.id));
    chatList.appendChild(clone);
  });
}

function renderConversation() {
  const chat = state.chats.find((c) => c.id === state.activeChatId);
  if (!chat) {
    conversationView.classList.add('hidden');
    return;
  }

  conversationView.classList.remove('hidden');
  activePartner.textContent = chat.partner;
  chat.hasNew = false;
  messageList.innerHTML = '';

  chat.messages.forEach((msg) => {
    const li = document.createElement('li');
    li.classList.add('message', msg.sender === state.user.nickname ? 'message--me' : 'message--them');
    li.innerHTML = `
      <div class="message__bubble">
        <p class="message__text">${msg.content}</p>
        <span class="message__time">${formatTimestamp(msg.timestamp)}</span>
      </div>
    `;
    messageList.appendChild(li);
  });
  messageList.scrollTop = messageList.scrollHeight;
  state.chatMeta[chat.id] = { lastRead: new Date() };
  persistSession();
}

function refreshAll() {
  syncFromServer();
  renderChats();
  renderConversation();
}

function stopAutoRefresh() {
  if (state.autoRefreshTimer) {
    clearInterval(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

function startAutoRefresh(ms) {
  stopAutoRefresh();
  if (!ms) return;
  state.autoRefreshTimer = setInterval(refreshAll, ms);
}

function handleLogin(event) {
  event.preventDefault();
  const nickname = nicknameInput.value.trim() || randomNickname();
  const password = passwordInput.value.trim();

  if (!password) {
    showToast('비밀번호를 입력하세요.');
    return;
  }

  state.user = { nickname, password };
  currentNickname.textContent = nickname;
  state.chats = [];
  state.sortOrder = 'latest';
  state.directory = buildDirectory();
  state.chatMeta = {};
  ensureUserRegistered(nickname);
  syncFromServer();
  state.autoRefreshMs = Number(autoRefreshSelect.value) || 0;
  persistSession();
  toggleView(true);
  renderChats();
  showToast(`${nickname}님, 환영해요!`);
}

function handleLogout() {
  clearSession();
  toggleView(false);
  loginForm.reset();
  showToast('로그아웃 되었어요. 정보가 모두 삭제되었습니다.');
}

function openConversation(chatId) {
  state.activeChatId = chatId;
  renderConversation();
}

function pushMessageToServer(partner, content, sender) {
  const server = upsertConversation(partner);
  const message = { content, sender, timestamp: new Date().toISOString() };
  server.messages.push(message);
  const full = getServer();
  full.conversations[server.id] = server;
  saveServer(full);
}

function handleSendMessage(event) {
  event.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;
  const chat = state.chats.find((c) => c.id === state.activeChatId);
  if (!chat) return;

  pushMessageToServer(chat.partner, text, state.user.nickname);
  state.chatMeta[chat.id] = { lastRead: new Date() };
  messageInput.value = '';
  syncFromServer();
  persistSession();
  refreshAll();
}

function handleSearch(keyword) {
  const normalized = keyword.trim();
  const haystack = state.directory.length ? state.directory : buildDirectory();
  const candidates = haystack.filter(
    (name) =>
      name.toLowerCase().includes(normalized.toLowerCase()) &&
      name.toLowerCase() !== state.user?.nickname?.toLowerCase() &&
      !state.chats.some((chat) => chat.partner.toLowerCase() === name.toLowerCase())
  );

  searchResults.innerHTML = '';
  if (!candidates.length) {
    const empty = document.createElement('li');
    empty.className = 'search-results__empty';
    if (!normalized) {
      empty.textContent = '검색어를 입력해 주세요.';
      startChatBtn.disabled = true;
      state.selectedSearch = null;
    } else {
      empty.innerHTML = `검색 결과가 없어요. <strong>${normalized}</strong> 으로 시작할까요?`;
      const li = document.createElement('li');
      li.className = 'search-results__item search-results__item--manual';
      li.innerHTML = `
        <label>
          <input type="radio" name="search-user" value="${normalized}" />
          ${normalized} (새 닉네임)
        </label>
      `;
      li.querySelector('input').addEventListener('change', (event) => {
        state.selectedSearch = event.target.value;
        startChatBtn.disabled = false;
      });
      searchResults.appendChild(li);
    }
    searchResults.prepend(empty);
    return;
  }

  candidates.forEach((name) => {
    const li = document.createElement('li');
    li.className = 'search-results__item';
    li.innerHTML = `
      <label>
        <input type="radio" name="search-user" value="${name}" />
        ${name}
      </label>
    `;
    li.querySelector('input').addEventListener('change', (event) => {
      state.selectedSearch = event.target.value;
      startChatBtn.disabled = false;
    });
    searchResults.appendChild(li);
  });
}

function resetModal() {
  state.selectedSearch = null;
  searchInput.value = '';
  searchResults.innerHTML = '';
  startChatBtn.disabled = true;
}

function openModal() {
  resetModal();
  searchModal.classList.remove('hidden');
  searchInput.focus();
}

function closeModal() {
  searchModal.classList.add('hidden');
}

function startNewChat() {
  if (!state.selectedSearch) return;
  const partner = state.selectedSearch;
  const conversation = upsertConversation(partner);
  state.chatMeta[conversation.id] = state.chatMeta[conversation.id] || { lastRead: new Date(0) };
  syncFromServer();
  persistSession();
  closeModal();
  openConversation(conversation.id);
  refreshAll();
}

function handleBack() {
  state.activeChatId = null;
  conversationView.classList.add('hidden');
  renderChats();
}

loginForm.addEventListener('submit', handleLogin);
sortSelect.addEventListener('change', (event) => {
  state.sortOrder = event.target.value;
  persistSession();
  renderChats();
});
refreshBtn.addEventListener('click', refreshAll);
autoRefreshSelect.addEventListener('change', (event) => {
  const ms = Number(event.target.value);
  state.autoRefreshMs = ms;
  startAutoRefresh(ms);
  persistSession();
  showToast(ms ? `${ms / 1000}초마다 자동 새로고침` : '자동 새로고침 꺼짐');
});
logoutBtn.addEventListener('click', handleLogout);
fab.addEventListener('click', openModal);
closeModalBtn.addEventListener('click', closeModal);
searchBtn.addEventListener('click', () => handleSearch(searchInput.value));
searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    handleSearch(searchInput.value);
  }
});
startChatBtn.addEventListener('click', startNewChat);
backBtn.addEventListener('click', handleBack);
messageForm.addEventListener('submit', handleSendMessage);
window.addEventListener('storage', (event) => {
  if (event.key === SERVER_KEY || event.key === 'chatEX-session') {
    syncFromServer();
    refreshAll();
  }
});

loadSession();
if (state.user) {
  currentNickname.textContent = state.user.nickname;
  ensureUserRegistered(state.user.nickname);
  syncFromServer();
  sortSelect.value = state.sortOrder;
  autoRefreshSelect.value = state.autoRefreshMs?.toString() || '0';
  startAutoRefresh(state.autoRefreshMs);
  toggleView(true);
  refreshAll();
} else {
  toggleView(false);
}
