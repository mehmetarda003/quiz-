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

function setStatus(text) {
  statusText.textContent = text;
}

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
  };
}

function renderAvatar(avatar) {
  const glasses = avatar.accessory === "glasses"
    ? `<rect x="20" y="40" width="22" height="12" fill="none" stroke="#111" stroke-width="2"/>
       <rect x="58" y="40" width="22" height="12" fill="none" stroke="#111" stroke-width="2"/>
       <line x1="42" y1="46" x2="58" y2="46" stroke="#111" stroke-width="2"/>`
    : "";
  const cap = avatar.accessory === "cap"
    ? `<path d="M12 30 C28 10, 72 10, 88 30 L88 36 L12 36 Z" fill="${avatar.hair}" />
       <rect x="34" y="34" width="32" height="8" fill="${avatar.hair}" />`
    : "";
  return `
    <svg viewBox="0 0 100 120" xmlns="http://www.w3.org/2000/svg" aria-label="avatar">
      <circle cx="50" cy="50" r="30" fill="${avatar.face}" />
      <path d="M20 42 C25 20, 75 20, 80 42 L80 30 C75 15, 25 15, 20 30 Z" fill="${avatar.hair}" />
      ${cap}
      ${glasses}
      <circle cx="40" cy="50" r="3" fill="#111" />
      <circle cx="60" cy="50" r="3" fill="#111" />
      <path d="M38 62 Q50 72 62 62" stroke="#111" stroke-width="2" fill="none" />
      <rect x="25" y="82" width="50" height="30" rx="8" fill="${avatar.shirt}" />
    </svg>
  `;
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

questionsList.appendChild(makeQuestionBlock(1));
updateAvatarPreview();
