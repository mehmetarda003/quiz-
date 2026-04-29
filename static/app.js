const socket = io();

let role = null;
let roomCode = "";
let isHost = false;
let hasAnswered = false;

const roleCard = document.getElementById("roleCard");
const hostCard = document.getElementById("hostCard");
const playerCard = document.getElementById("playerCard");
const questionCard = document.getElementById("questionCard");
const leaderboardCard = document.getElementById("leaderboardCard");
const statusText = document.getElementById("status");

const questionsList = document.getElementById("questionsList");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const hostRoomInfo = document.getElementById("hostRoomInfo");
const startQuizBtn = document.getElementById("startQuizBtn");
const nextQuestionBtn = document.getElementById("nextQuestionBtn");
const qrCodeBox = document.getElementById("qrCode");
const joinLinkText = document.getElementById("joinLinkText");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const leaderboardList = document.getElementById("leaderboardList");
const questionTitle = document.getElementById("questionTitle");
const questionText = document.getElementById("questionText");
const optionsBox = document.getElementById("options");
const genderSelect = document.getElementById("gender");
const avatarStyleSelect = document.getElementById("avatarStyle");
const avatarPackInput = document.getElementById("avatarPackInput");
const saveAvatarPackBtn = document.getElementById("saveAvatarPackBtn");

const CUSTOM_AVATAR_PACK_KEY = "quiz_custom_avatar_pack_v1";
const BUILTIN_AVATAR_STYLES = {
  female: [
    {
      id: "female-classic",
      label: "Classic",
      svg: `
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="avatar">
        <circle cx="50" cy="50" r="30" fill="{{face}}" />
        <path d="M18 48 C22 18, 78 18, 82 48 L82 28 C78 10, 22 10, 18 28 Z" fill="{{hair}}" />
        {{accessory}}
        <circle cx="40" cy="50" r="3" fill="#111" />
        <circle cx="60" cy="50" r="3" fill="#111" />
        <path d="M38 62 Q50 72 62 62" stroke="#111" stroke-width="2" fill="none" />
        <rect x="25" y="82" width="50" height="30" rx="10" fill="{{shirt}}" />
      </svg>
      `,
    },
    {
      id: "female-hero",
      label: "Hero",
      svg: `
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="avatar">
        <ellipse cx="50" cy="50" rx="28" ry="30" fill="{{face}}" />
        <path d="M14 40 C24 12, 76 12, 86 40 L86 26 C78 6, 22 6, 14 26 Z" fill="{{hair}}" />
        {{accessory}}
        <circle cx="40" cy="50" r="3" fill="#111" />
        <circle cx="60" cy="50" r="3" fill="#111" />
        <path d="M36 63 Q50 76 64 63" stroke="#111" stroke-width="2" fill="none" />
        <path d="M18 84 C24 72, 76 72, 82 84 L82 112 L18 112 Z" fill="{{shirt}}" />
      </svg>
      `,
    },
  ],
  male: [
    {
      id: "male-classic",
      label: "Classic",
      svg: `
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="avatar">
        <circle cx="50" cy="50" r="30" fill="{{face}}" />
        <path d="M20 42 C26 20, 74 20, 80 42 L80 30 C74 16, 26 16, 20 30 Z" fill="{{hair}}" />
        {{accessory}}
        <circle cx="40" cy="50" r="3" fill="#111" />
        <circle cx="60" cy="50" r="3" fill="#111" />
        <path d="M38 62 Q50 68 62 62" stroke="#111" stroke-width="2" fill="none" />
        <rect x="24" y="82" width="52" height="30" rx="7" fill="{{shirt}}" />
      </svg>
      `,
    },
    {
      id: "male-sport",
      label: "Sport",
      svg: `
      <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="avatar">
        <rect x="22" y="22" width="56" height="56" rx="24" fill="{{face}}" />
        <path d="M20 44 C24 22, 76 22, 80 44 L80 30 C74 14, 26 14, 20 30 Z" fill="{{hair}}" />
        {{accessory}}
        <circle cx="40" cy="50" r="3" fill="#111" />
        <circle cx="60" cy="50" r="3" fill="#111" />
        <path d="M38 64 Q50 70 62 64" stroke="#111" stroke-width="2" fill="none" />
        <path d="M20 84 L80 84 L74 112 L26 112 Z" fill="{{shirt}}" />
      </svg>
      `,
    },
  ],
};

function setStatus(text) {
  statusText.textContent = text;
}

socket.on("connect", () => {
  setStatus("Sunucuya baglandi.");
});

socket.on("connect_error", () => {
  setStatus("Sunucu baglantisi kurulamadi. Sayfayi yenileyin.");
});

function makeQuestionBlock(index) {
  const wrap = document.createElement("div");
  wrap.className = "question-item";
  wrap.innerHTML = `
    <label>Soru ${index}
      <input class="q-text" placeholder="Soru metni" />
    </label>
    <div class="option-grid">
      <label>A<input class="q-opt" placeholder="A secenegi" /></label>
      <label>B<input class="q-opt" placeholder="B secenegi" /></label>
      <label>C<input class="q-opt" placeholder="C secenegi" /></label>
      <label>D<input class="q-opt" placeholder="D secenegi" /></label>
    </div>
    <label>Dogru Secenek (0-3)
      <input class="q-correct" type="number" min="0" max="3" value="0" />
    </label>
  `;
  return wrap;
}

function collectQuestions() {
  const blocks = [...document.querySelectorAll(".question-item")];
  return blocks
    .map((block) => {
      const text = block.querySelector(".q-text").value.trim();
      const options = [...block.querySelectorAll(".q-opt")].map((i) => i.value.trim());
      const correctIndex = Number(block.querySelector(".q-correct").value);
      return { text, options, correctIndex };
    })
    .filter((q) => q.text && q.options.every((o) => o));
}

function avatarState() {
  return {
    face: document.getElementById("faceColor").value,
    hair: document.getElementById("hairColor").value,
    shirt: document.getElementById("shirtColor").value,
    accessory: document.getElementById("accessory").value,
    gender: genderSelect.value,
    styleId: avatarStyleSelect.value,
  };
}

function getAccessoryMarkup(avatar) {
  const glasses = avatar.accessory === "glasses"
    ? `<rect x="20" y="40" width="22" height="12" fill="none" stroke="#111" stroke-width="2"/>
       <rect x="58" y="40" width="22" height="12" fill="none" stroke="#111" stroke-width="2"/>
       <line x1="42" y1="46" x2="58" y2="46" stroke="#111" stroke-width="2"/>`
    : "";
  const cap = avatar.accessory === "cap"
    ? `<path d="M12 30 C28 10, 72 10, 88 30 L88 36 L12 36 Z" fill="${avatar.hair}" />
       <rect x="34" y="34" width="32" height="8" fill="${avatar.hair}" />`
    : "";
  return `${cap}${glasses}`;
}

function loadCustomAvatarPack() {
  try {
    const raw = localStorage.getItem(CUSTOM_AVATAR_PACK_KEY);
    if (!raw) return { female: [], male: [] };
    const parsed = JSON.parse(raw);
    return {
      female: Array.isArray(parsed.female) ? parsed.female : [],
      male: Array.isArray(parsed.male) ? parsed.male : [],
    };
  } catch (_) {
    return { female: [], male: [] };
  }
}

function getStyleOptionsForGender(gender) {
  const customPack = loadCustomAvatarPack();
  const builtins = BUILTIN_AVATAR_STYLES[gender] || [];
  const customs = customPack[gender] || [];
  return [...builtins, ...customs].filter((item) => item && item.id && item.svg);
}

function refreshStyleDropdown() {
  const prevValue = avatarStyleSelect.value;
  const styles = getStyleOptionsForGender(genderSelect.value);
  avatarStyleSelect.innerHTML = "";

  styles.forEach((style) => {
    const option = document.createElement("option");
    option.value = style.id;
    option.textContent = style.label || style.id;
    avatarStyleSelect.appendChild(option);
  });

  if (styles.some((s) => s.id === prevValue)) {
    avatarStyleSelect.value = prevValue;
  }
}

function selectedStyleSvg(avatar) {
  const styles = getStyleOptionsForGender(avatar.gender);
  const selected = styles.find((style) => style.id === avatar.styleId) || styles[0];
  return selected ? selected.svg : "";
}

function renderAvatar(avatar) {
  const svg = selectedStyleSvg(avatar);
  return svg
    .replaceAll("{{face}}", avatar.face)
    .replaceAll("{{hair}}", avatar.hair)
    .replaceAll("{{shirt}}", avatar.shirt)
    .replaceAll("{{accessory}}", getAccessoryMarkup(avatar));
}

function updateAvatarPreview() {
  document.getElementById("avatarPreview").innerHTML = renderAvatar(avatarState());
}

document.getElementById("hostModeBtn").onclick = () => {
  role = "host";
  isHost = true;
  hostCard.classList.remove("hidden");
  playerCard.classList.add("hidden");
  roleCard.classList.add("hidden");
};

document.getElementById("playerModeBtn").onclick = () => {
  role = "player";
  isHost = false;
  playerCard.classList.remove("hidden");
  hostCard.classList.add("hidden");
  roleCard.classList.add("hidden");

  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (code) {
    document.getElementById("joinCode").value = code;
  }
};

document.getElementById("addQuestionBtn").onclick = () => {
  const idx = questionsList.querySelectorAll(".question-item").length + 1;
  questionsList.appendChild(makeQuestionBlock(idx));
};

document.getElementById("createRoomBtn").onclick = () => {
  const questions = collectQuestions();
  socket.emit("host_create_room", { questions });
};

startQuizBtn.onclick = () => socket.emit("host_start_quiz", { code: roomCode });
nextQuestionBtn.onclick = () => socket.emit("host_next_question", { code: roomCode });

document.getElementById("joinBtn").onclick = () => {
  const name = document.getElementById("playerName").value.trim();
  const code = document.getElementById("joinCode").value.trim();
  socket.emit("player_join", { name, code, avatar: avatarState() });
};

socket.on("room_created", ({ code }) => {
  roomCode = code;
  roomCodeLabel.textContent = code;
  hostRoomInfo.classList.remove("hidden");
  setStatus(`Oda hazir. Kod: ${code}`);
  const localIp = window.__LOCAL_IP__ || window.location.hostname;
  const port = window.location.port || "5000";
  const hostIsLocalOnly = ["localhost", "127.0.0.1"].includes(window.location.hostname);
  const joinUrl = hostIsLocalOnly
    ? `http://${localIp}:${port}/?code=${code}`
    : `${window.location.origin}/?code=${code}`;

  joinLinkText.innerHTML = `Katilim baglantisi: <a href="${joinUrl}" target="_blank" rel="noopener">${joinUrl}</a>`;
  copyLinkBtn.classList.remove("hidden");
  copyLinkBtn.onclick = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      setStatus("Baglanti panoya kopyalandi.");
    } catch (_) {
      setStatus("Baglanti kopyalanamadi, metni manuel kopyalayin.");
    }
  };

  qrCodeBox.innerHTML = "";
  // QR kodu her odaya ozel olarak uretilir.
  new QRCode(qrCodeBox, { text: joinUrl, width: 160, height: 160 });
});

socket.on("join_success", ({ code, name }) => {
  roomCode = code;
  setStatus(`${name} olarak baglandiniz. Oyun baslamasini bekleyin.`);
});

socket.on("lobby_update", ({ count }) => {
  setStatus(`Lobide ${count} katilimci var.`);
});

socket.on("question_started", ({ index, total, text, options }) => {
  hasAnswered = false;
  questionCard.classList.remove("hidden");
  leaderboardCard.classList.add("hidden");
  questionTitle.textContent = `Soru ${index} / ${total}`;
  questionText.textContent = text;
  optionsBox.innerHTML = "";
  options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "answer-btn";
    btn.textContent = `${String.fromCharCode(65 + i)} - ${opt}`;
    btn.onclick = () => {
      if (hasAnswered) return;
      hasAnswered = true;
      socket.emit("submit_answer", { code: roomCode, answerIndex: i });
      setStatus("Cevabiniz alindi.");
    };
    optionsBox.appendChild(btn);
  });
});

socket.on("question_result", ({ correctIndex, leaderboard }) => {
  leaderboardCard.classList.remove("hidden");
  if (isHost) {
    nextQuestionBtn.classList.remove("hidden");
  }
  setStatus(`Dogru cevap: ${String.fromCharCode(65 + correctIndex)}`);
  leaderboardList.innerHTML = leaderboard
    .map(
      (p) =>
        `<li><span>${p.name}</span><span>${p.score} puan</span></li>`
    )
    .join("");
});

socket.on("quiz_finished", ({ leaderboard }) => {
  leaderboardCard.classList.remove("hidden");
  nextQuestionBtn.classList.add("hidden");
  questionCard.classList.add("hidden");
  setStatus("Yarisma tamamlandi.");
  leaderboardList.innerHTML = leaderboard
    .map((p) => `<li><span>${p.name}</span><span>${p.score} puan</span></li>`)
    .join("");
});

socket.on("room_closed", ({ message }) => setStatus(message));
socket.on("answer_received", () => {});
socket.on("error_msg", ({ message }) => setStatus(`Hata: ${message}`));

["faceColor", "hairColor", "shirtColor", "accessory"].forEach((id) => {
  document.getElementById(id).addEventListener("input", updateAvatarPreview);
});

genderSelect.addEventListener("change", () => {
  refreshStyleDropdown();
  updateAvatarPreview();
});

avatarStyleSelect.addEventListener("change", updateAvatarPreview);

saveAvatarPackBtn.onclick = () => {
  const raw = avatarPackInput.value.trim();
  if (!raw) {
    localStorage.removeItem(CUSTOM_AVATAR_PACK_KEY);
    refreshStyleDropdown();
    updateAvatarPreview();
    setStatus("Ozel karakter paketi temizlendi.");
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    const validFemale = Array.isArray(parsed.female) ? parsed.female : [];
    const validMale = Array.isArray(parsed.male) ? parsed.male : [];
    localStorage.setItem(
      CUSTOM_AVATAR_PACK_KEY,
      JSON.stringify({ female: validFemale, male: validMale })
    );
    refreshStyleDropdown();
    updateAvatarPreview();
    setStatus("Ozel karakter paketi kaydedildi.");
  } catch (_) {
    setStatus("JSON formati hatali. Paketi kontrol edin.");
  }
};

const existingPack = localStorage.getItem(CUSTOM_AVATAR_PACK_KEY);
if (existingPack) {
  avatarPackInput.value = existingPack;
}
refreshStyleDropdown();
questionsList.appendChild(makeQuestionBlock(1));
updateAvatarPreview();
