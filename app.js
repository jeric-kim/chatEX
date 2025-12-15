const loginView = document.getElementById('login-view');
const chatView = document.getElementById('chat-view');
const loginForm = document.getElementById('login-form');
const nicknameInput = document.getElementById('nickname-input');
const passwordInput = document.getElementById('password-input');
const currentNickname = document.getElementById('current-nickname');
const chatList = document.getElementById('chat-list');
const sortSelect = document.getElementById('sort-select');
const newChatBtn = document.getElementById('new-chat-btn');
const logoutBtn = document.getElementById('logout-btn');
const toast = document.getElementById('toast');

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
];

const state = {
  user: null,
  chats: [],
  sortOrder: 'latest',
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

function truncateContent(text) {
  if (text.length <= 15) return text;
  return `${text.slice(0, 15)}...`;
}

function persistSession() {
  if (!state.user) return;
  localStorage.setItem(
    'chatEX-session',
    JSON.stringify({ user: state.user, chats: state.chats, sortOrder: state.sortOrder })
  );
}

function loadSession() {
  const stored = localStorage.getItem('chatEX-session');
  if (!stored) return;
  try {
    const parsed = JSON.parse(stored);
    state.user = parsed.user;
    state.chats = parsed.chats.map((chat) => ({ ...chat, timestamp: new Date(chat.timestamp) }));
    state.sortOrder = parsed.sortOrder || 'latest';
  } catch (error) {
    console.error('세션 로드 실패', error);
  }
}

function clearSession() {
  localStorage.removeItem('chatEX-session');
  state.user = null;
  state.chats = [];
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

function renderChats() {
  chatList.innerHTML = '';
  const template = document.getElementById('chat-item-template');
  const sorted = [...state.chats].sort((a, b) => {
    return state.sortOrder === 'latest'
      ? b.timestamp.getTime() - a.timestamp.getTime()
      : a.timestamp.getTime() - b.timestamp.getTime();
  });

  sorted.forEach((chat) => {
    const clone = template.content.cloneNode(true);
    clone.querySelector('.chat-item__name').textContent = chat.sender;
    clone.querySelector('.chat-item__timestamp').textContent = formatTimestamp(chat.timestamp);
    clone.querySelector('.chat-item__preview').textContent = truncateContent(chat.content);
    const badge = clone.querySelector('.chat-item__badge');
    if (chat.isNew) {
      badge.classList.remove('hidden');
    }

    const item = clone.querySelector('.chat-item');
    item.addEventListener('click', () => markAsRead(chat.id));
    chatList.appendChild(clone);
  });
}

function markAsRead(chatId) {
  const chat = state.chats.find((item) => item.id === chatId);
  if (chat && chat.isNew) {
    chat.isNew = false;
    persistSession();
    renderChats();
  }
}

function simulateChats() {
  const base = new Date();
  const samples = [
    {
      sender: '밍밍',
      content: '오늘 저녁 메뉴 추천 좀 해줘!',
      timestamp: new Date(base.getTime() - 1000 * 60 * 12),
    },
    {
      sender: '카페사장',
      content: '아이스라떼 픽업 가능하세요?',
      timestamp: new Date(base.getTime() - 1000 * 60 * 30),
    },
    {
      sender: '팀플조장',
      content: '내일까지 초안 공유 부탁해요. 일정 지켜보자!',
      timestamp: new Date(base.getTime() - 1000 * 60 * 60 * 2),
    },
  ];

  state.chats = samples.map((item, index) => ({
    ...item,
    id: `seed-${index}`,
    isNew: false,
  }));
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
  simulateChats();
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

function receiveNewChat() {
  const now = new Date();
  const newChat = {
    id: `chat-${now.getTime()}`,
    sender: randomNickname(),
    content: '새 메시지가 도착했어요. 바로 확인해 주세요!',
    timestamp: now,
    isNew: true,
  };

  state.chats.unshift(newChat);
  state.sortOrder = 'latest';
  sortSelect.value = 'latest';
  persistSession();
  renderChats();
  showToast('신규 채팅을 수신했어요!');
}

loginForm.addEventListener('submit', handleLogin);
sortSelect.addEventListener('change', (event) => {
  state.sortOrder = event.target.value;
  persistSession();
  renderChats();
});
newChatBtn.addEventListener('click', receiveNewChat);
logoutBtn.addEventListener('click', handleLogout);

loadSession();
if (state.user) {
  currentNickname.textContent = state.user.nickname;
  state.chats = state.chats.map((chat) => ({ ...chat, isNew: false }));
  toggleView(true);
  renderChats();
} else {
  toggleView(false);
}
