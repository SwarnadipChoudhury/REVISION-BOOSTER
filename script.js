/* ═══════════════════════ DOM REFS ═══════════════════════ */
const pdfUpload        = document.getElementById("pdfUpload");
const uploadSection    = document.getElementById("uploadSection");
const processingBar    = document.getElementById("processingBar");
const processingFill   = document.getElementById("processingFill");
const processingLabel  = document.getElementById("processingLabel");
const modeSwitch       = document.getElementById("modeSwitch");
const questionPicker   = document.getElementById("questionPicker");
const quizCard         = document.getElementById("quizCard");
const flashSection     = document.getElementById("flashSection");
const resultCard       = document.getElementById("resultCard");

const questionText     = document.getElementById("questionText");
const optionsContainer = document.getElementById("optionsContainer");
const questionNumber   = document.getElementById("questionNumber");
const timerText        = document.getElementById("timerText");
const progressFill     = document.getElementById("progressFill");

const flashFront        = document.getElementById("flashFront");
const flashBack         = document.getElementById("flashBack");
const flashcard         = document.getElementById("flashcard");
const nextFlash         = document.getElementById("nextFlash");
const flashCounter      = document.getElementById("flashCounter");
const flashProgressFill = document.getElementById("flashProgressFill");

const finalScore        = document.getElementById("finalScore");
const heatmapContainer  = document.getElementById("heatmapContainer");
const reviewSection     = document.getElementById("reviewSection");

const qSlider      = document.getElementById("qSlider");
const sliderVal    = document.getElementById("sliderVal");
const pickerTitle  = document.getElementById("pickerTitle");
const pickerModeIcon = document.getElementById("pickerModeIcon");
const sliderTicks  = document.getElementById("sliderTicks");

/* ═══════════════════════ STATE ═══════════════════════ */
let allQuestions   = [];
let questions      = [];
let wrongQuestions = [], reviewData = [];
let currentIndex = 0, score = 0, timeLeft = 15, timer;
let answered = false;
let selectedMode = "quiz";

const CIRCUMFERENCE = 238.76;

/* ═══════════════════════ PARALLAX ═══════════════════════ */
document.addEventListener("mousemove", (e) => {
  const x = (e.clientX / window.innerWidth  - 0.5) * 2;
  const y = (e.clientY / window.innerHeight - 0.5) * 2;
  const orbs = document.querySelectorAll(".p-orb");
  orbs.forEach((orb, i) => {
    const depth = (i + 1) * 12;
    orb.style.transform = `translate(${x * depth}px, ${y * depth}px)`;
  });
});

/* ═══════════════════════ AUDIO ═══════════════════════ */
let audioCtx = null;
function getAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function playTone(freq, type, dur, gain = 0.4, delay = 0) {
  try {
    const ctx = getAudio(), osc = ctx.createOscillator(), vol = ctx.createGain();
    osc.connect(vol); vol.connect(ctx.destination);
    osc.type = type; osc.frequency.setValueAtTime(freq, ctx.currentTime + delay);
    vol.gain.setValueAtTime(0, ctx.currentTime + delay);
    vol.gain.linearRampToValueAtTime(gain, ctx.currentTime + delay + 0.01);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + dur);
    osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + dur + 0.05);
  } catch (e) {}
}
const soundCorrect    = () => { playTone(523,'sine',0.15,0.35,0); playTone(659,'sine',0.15,0.35,0.10); playTone(784,'sine',0.25,0.40,0.20); };
const soundWrong      = () => { playTone(300,'sawtooth',0.18,0.25,0); playTone(220,'sawtooth',0.22,0.20,0.15); };
const soundTimerTick  = () => playTone(880,'square',0.04,0.07);
const soundTimeUp     = () => { playTone(200,'sawtooth',0.4,0.3,0); playTone(150,'sawtooth',0.4,0.25,0.2); };
const soundFlipCard   = () => playTone(440,'sine',0.08,0.15);
const soundResults    = () => [523,659,784,1047].forEach((f,i) => playTone(f,'sine',0.3,0.4,i*0.12));
const soundModeSelect = () => { playTone(600,'sine',0.12,0.3,0); playTone(800,'sine',0.12,0.3,0.1); };
const soundSlider     = () => playTone(660,'sine',0.05,0.1);
const soundClick      = () => playTone(500,'sine',0.08,0.2);

/* ═══════════════════════ PDF LOAD ═══════════════════════ */
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";

pdfUpload.addEventListener("change", async function () {
  const file = this.files[0]; if (!file) return;
  uploadSection.classList.add("hidden");
  processingBar.classList.remove("hidden");
  let progress = 0;
  const fake = setInterval(() => {
    progress = Math.min(progress + Math.random() * 12, 85);
    processingFill.style.width = progress + "%";
    processingLabel.innerText =
      progress < 40 ? "Reading PDF..." :
      progress < 70 ? "Extracting content..." :
      "Generating questions...";
  }, 200);
  const reader = new FileReader();
  reader.onload = async function () {
    const pdf = await pdfjsLib.getDocument(new Uint8Array(this.result)).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map(it => it.str).join(" ") + " ";
    }
    generateQuestions(text);
    clearInterval(fake);
    processingFill.style.width = "100%";
    processingLabel.innerText = "Done! Choose your mode ✓";
    setTimeout(() => {
      processingBar.classList.add("hidden");
      modeSwitch.classList.remove("hidden");
    }, 700);
  };
  reader.readAsArrayBuffer(file);
});

/* ═══════════════════════ QUESTION GENERATION ═══════════════════════ */
function generateQuestions(text) {
  allQuestions = []; wrongQuestions = []; reviewData = [];
  const sentences = text.split(/[.?!]/).map(s => s.trim()).filter(s => s.length > 50).slice(0, 30);
  sentences.forEach(s => {
    const words = [...new Set(s.split(/\s+/).filter(w => w.length > 4 && /^[a-zA-Z]+$/.test(w)))];
    if (words.length < 4) return;
    const ans = words[Math.floor(words.length / 2)];
    const distractors = shuffle(words.filter(w => w !== ans));
    const wrongOpts = distractors.slice(0, 3);
    const fallbacks = ["concept", "method", "theory", "process", "system"];
    while (wrongOpts.length < 3) { const fb = fallbacks.shift(); if (fb && fb !== ans) wrongOpts.push(fb); }
    allQuestions.push({ question: s.replace(ans, "______"), answer: ans, options: shuffle([ans, ...wrongOpts]) });
  });
  setupPicker();
}

/* ═══════════════════════ PICKER SETUP ═══════════════════════ */
function setupPicker() {
  const max = allQuestions.length;
  qSlider.min = 1;
  qSlider.max = max;
  qSlider.value = Math.min(5, max);
  sliderVal.innerText = qSlider.value;
  updateSliderFill();

  // Build tick marks
  sliderTicks.innerHTML = "";
  const step = max <= 20 ? 1 : Math.ceil(max / 20);
  for (let i = 1; i <= max; i += step) {
    const s = document.createElement("span");
    s.innerText = i;
    sliderTicks.appendChild(s);
  }
  const last = sliderTicks.lastElementChild;
  if (last && parseInt(last.innerText) !== max) {
    const s = document.createElement("span");
    s.innerText = max;
    sliderTicks.appendChild(s);
  }

  // Quick pick buttons
  document.querySelectorAll(".qp-btn").forEach(btn => {
    const raw = btn.dataset.val;
    if (raw === "all") {
      btn.dataset.val = max;
      btn.innerText = `All (${max})`;
      btn.disabled = false;
      btn.style.opacity = "1";
    } else {
      const v = parseInt(raw);
      btn.disabled = v > max;
      btn.style.opacity = v > max ? "0.35" : "1";
    }
    btn.classList.toggle("active", parseInt(btn.dataset.val) == qSlider.value);
  });
}

function updateSliderFill() {
  const pct = ((qSlider.value - qSlider.min) / (qSlider.max - qSlider.min)) * 100;
  qSlider.style.setProperty("--fill-pct", pct + "%");
}

/* ═══════════════════════ MODE → PICKER ═══════════════════════ */
document.getElementById("quizModeBtn").onclick = () => {
  soundModeSelect();
  selectedMode = "quiz";
  pickerTitle.innerText = "Quiz Mode";
  pickerModeIcon.innerText = "🧠";
  modeSwitch.classList.add("hidden");
  questionPicker.classList.remove("hidden");
};

document.getElementById("flashModeBtn").onclick = () => {
  soundModeSelect();
  selectedMode = "flash";
  pickerTitle.innerText = "Flashcard Mode";
  pickerModeIcon.innerText = "⚡";
  modeSwitch.classList.add("hidden");
  questionPicker.classList.remove("hidden");
};

document.getElementById("backToMode").onclick = () => {
  questionPicker.classList.add("hidden");
  modeSwitch.classList.remove("hidden");
};

/* Slider */
qSlider.addEventListener("input", () => {
  sliderVal.innerText = qSlider.value;
  soundSlider();
  updateSliderFill();
  document.querySelectorAll(".qp-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.val == qSlider.value);
  });
});

/* Quick picks */
document.querySelectorAll(".qp-btn").forEach(btn => {
  btn.onclick = () => {
    if (btn.disabled) return;
    const val = parseInt(btn.dataset.val);
    qSlider.value = val;
    sliderVal.innerText = val;
    soundSlider();
    updateSliderFill();
    document.querySelectorAll(".qp-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
  };
});

/* START SESSION */
document.getElementById("startSession").onclick = () => {
  const count = parseInt(qSlider.value);
  questions = shuffle([...allQuestions]).slice(0, count);
  wrongQuestions = []; reviewData = [];
  currentIndex = 0; score = 0;
  soundModeSelect();
  questionPicker.classList.add("hidden");
  if (selectedMode === "quiz") {
    quizCard.classList.remove("hidden");
    showQuestion();
  } else {
    flashSection.classList.remove("hidden");
    showFlashcard();
  }
};

/* ═══════════════════════ QUIZ ═══════════════════════ */
function showQuestion() {
  if (currentIndex >= questions.length) return showResults();
  answered = false;
  const q = questions[currentIndex];
  questionText.innerText = q.question;
  questionNumber.innerText = `Question ${currentIndex + 1} of ${questions.length}`;
  optionsContainer.innerHTML = "";
  ["A","B","C","D"].forEach((label, i) => {
    const btn = document.createElement("button");
    btn.innerHTML = `<span class="opt-label">${label}</span><span class="opt-text">${q.options[i]}</span>`;
    btn.classList.add("option-btn");
    btn.dataset.value = q.options[i];
    btn.onclick = () => checkAnswer(q.options[i]);
    optionsContainer.appendChild(btn);
  });
  updateProgress();
  startTimer();
}

function startTimer() {
  timeLeft = 15; updateCircle(); clearInterval(timer);
  timer = setInterval(() => {
    timeLeft--;
    if (timeLeft <= 5 && timeLeft > 0) soundTimerTick();
    updateCircle();
    if (timeLeft <= 0) {
      clearInterval(timer);
      if (!answered) {
        answered = true; soundTimeUp();
        revealAnswers(null, questions[currentIndex].answer);
        wrongQuestions.push(questions[currentIndex]);
        reviewData.push({ q: questions[currentIndex], selected: "⏰ Time Up" });
        setTimeout(() => { currentIndex++; showQuestion(); }, 1500);
      }
    }
  }, 1000);
}

function updateCircle() {
  timerText.innerText = timeLeft;
  const circle = document.querySelector(".progress-ring-circle");
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * (timeLeft / 15));
  circle.style.strokeDashoffset = offset;
  circle.style.stroke = timeLeft <= 5 ? "#ef4444" : timeLeft <= 10 ? "#f59e0b" : "#a855f7";
}

function updateProgress() {
  progressFill.style.width = ((currentIndex / questions.length) * 100) + "%";
}

function checkAnswer(selected) {
  if (answered) return;
  answered = true; clearInterval(timer);
  const q = questions[currentIndex];
  if (selected === q.answer) { score++; soundCorrect(); }
  else { soundWrong(); wrongQuestions.push(q); }
  reviewData.push({ q, selected });
  revealAnswers(selected, q.answer);
  setTimeout(() => { currentIndex++; showQuestion(); }, 1500);
}

function revealAnswers(selected, correctAnswer) {
  optionsContainer.querySelectorAll(".option-btn").forEach(btn => {
    btn.disabled = true;
    const val = btn.dataset.value;
    if (val === correctAnswer)                              btn.classList.add("correct");
    else if (val === selected && selected !== correctAnswer) btn.classList.add("wrong");
    else                                                    btn.classList.add("dimmed");
  });
}

/* ═══════════════════════ FLASHCARDS ═══════════════════════ */
function showFlashcard() {
  if (currentIndex >= questions.length) {
    flashSection.classList.add("hidden");
    resultCard.classList.remove("hidden");
    finalScore.innerHTML = `<span class="score-num">${questions.length}</span><span class="score-sep"> / </span><span class="score-tot">${questions.length}</span>`;
    document.getElementById("scorePct").innerText = "Done!";
    heatmapContainer.innerHTML = `<div class="flash-done-msg">🎉 You reviewed all <strong>${questions.length}</strong> flashcards!</div>`;
    reviewSection.innerHTML = "";
    setTimeout(soundResults, 300);
    return;
  }
  const q = questions[currentIndex];
  flashFront.innerText = q.question;
  flashBack.innerText  = q.answer;
  flashCounter.innerText = `Card ${currentIndex + 1} of ${questions.length}`;
  flashProgressFill.style.width = ((currentIndex / questions.length) * 100) + "%";
  flashcard.classList.remove("flip");
  flashcard.onclick = () => { flashcard.classList.toggle("flip"); soundFlipCard(); };
}

nextFlash.onclick = () => { currentIndex++; showFlashcard(); };

/* ═══════════════════════ RESULTS ═══════════════════════ */
function showResults() {
  quizCard.classList.add("hidden");
  resultCard.classList.remove("hidden");
  const pct = Math.round((score / questions.length) * 100);
  finalScore.innerHTML = `<span class="score-num">${score}</span><span class="score-sep"> / </span><span class="score-tot">${questions.length}</span>`;
  document.getElementById("scorePct").innerText = pct + "%";
  setTimeout(soundResults, 300);
  generateHeatmap(pct);
  generateReview();
}

/* ═══════════════════════ PERFORMANCE CARD ═══════════════════════ */
function getPerformanceFeedback(pct) {
  if (pct === 100) return { emoji:"🌟", verdict:"Perfect!",    color:"#16a34a", title:"Outstanding!",   feedback:"You aced every single question. Complete mastery — nothing to revise here!" };
  if (pct >= 80)   return { emoji:"🔥", verdict:"Excellent",   color:"#22c55e", title:"Great Work!",    feedback:"You have a strong command of this material. Just a quick skim of the missed ones and you're golden." };
  if (pct >= 60)   return { emoji:"⚡", verdict:"Good",        color:"#f59e0b", title:"Keep Going!",    feedback:"Solid foundation, but a few gaps exist. Review the incorrect answers carefully and you'll level up fast." };
  if (pct >= 40)   return { emoji:"📖", verdict:"Fair",        color:"#f97316", title:"Almost There!",  feedback:"You're getting there! Focus on the questions you missed and re-read those sections of your notes." };
  if (pct >= 20)   return { emoji:"💪", verdict:"Needs Work",  color:"#ef4444", title:"Don't Give Up!", feedback:"This topic needs more time. Break it into smaller chunks, study one concept at a time, and retry." };
  return               { emoji:"🆘", verdict:"Revise All",  color:"#dc2626", title:"Start Fresh!",   feedback:"Very few correct answers — revisit the material from scratch. Use flashcard mode first to build familiarity." };
}

function generateHeatmap(pct) {
  heatmapContainer.innerHTML = "";
  const fb = getPerformanceFeedback(pct);
  const card = document.createElement("div");
  card.className = "perf-card";
  card.style.cssText = `border-color:${fb.color}33;background:${fb.color}0d`;
  card.innerHTML = `
    <div class="perf-card-top">
      <div class="perf-emoji-wrap" style="background:${fb.color}18;border-color:${fb.color}33">
        <span class="perf-emoji">${fb.emoji}</span>
      </div>
      <div class="perf-card-info">
        <div class="perf-title" style="color:${fb.color}">${fb.title}</div>
        <div class="perf-verdict-badge" style="background:${fb.color}18;color:${fb.color};border-color:${fb.color}33">${fb.verdict}</div>
      </div>
      <div class="perf-big-pct" style="color:${fb.color}">${pct}%</div>
    </div>
    <div class="perf-bar-wrap">
      <div class="perf-bar-track">
        <div class="perf-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${fb.color},${fb.color}99)"></div>
      </div>
      <div class="perf-bar-labels"><span>0%</span><span>50%</span><span>100%</span></div>
    </div>
    <div class="perf-feedback-box" style="border-color:${fb.color}33;background:${fb.color}0a">
      <span class="perf-feedback-dot" style="background:${fb.color}"></span>
      <p class="perf-feedback-text">${fb.feedback}</p>
    </div>
    <div class="perf-stats-row">
      <div class="perf-stat" style="border-color:${fb.color}22">
        <span class="perf-stat-num" style="color:#22c55e">${score}</span>
        <span class="perf-stat-label">Correct</span>
      </div>
      <div class="perf-stat" style="border-color:${fb.color}22">
        <span class="perf-stat-num" style="color:#ef4444">${questions.length - score}</span>
        <span class="perf-stat-label">Wrong</span>
      </div>
      <div class="perf-stat" style="border-color:${fb.color}22">
        <span class="perf-stat-num" style="color:#a855f7">${questions.length}</span>
        <span class="perf-stat-label">Total</span>
      </div>
    </div>`;
  heatmapContainer.appendChild(card);
}

/* ═══════════════════════ DETAILED REVIEW ═══════════════════════ */
function generateReview() {
  const wrap = document.getElementById("reviewSection");
  if (!reviewData.length) { wrap.innerHTML = ""; return; }

  wrap.innerHTML = `
    <div class="rv-header">
      <span class="rv-header-icon">📋</span>
      <span class="rv-header-title">Detailed Review</span>
      <span class="rv-header-count">${reviewData.length} Questions</span>
    </div>
    <div class="rv-list" id="rvList"></div>
  `;

  const list = document.getElementById("rvList");

  reviewData.forEach((item, i) => {
    const correct = item.selected === item.q.answer;
    const isTimeout = item.selected === "⏰ Time Up";

    const card = document.createElement("div");
    card.className = `rv-card ${correct ? "rv-correct" : "rv-wrong"}`;
    card.style.animationDelay = (i * 0.06) + "s";

    card.innerHTML = `
      <div class="rv-card-head" role="button" tabindex="0">
        <div class="rv-card-left">
          <div class="rv-index-badge ${correct ? "badge-c" : "badge-w"}">${i + 1}</div>
          <div class="rv-status-icon">${correct ? "✓" : isTimeout ? "⏰" : "✗"}</div>
          <p class="rv-question-preview">${item.q.question.length > 70 ? item.q.question.slice(0,70)+"…" : item.q.question}</p>
        </div>
        <div class="rv-expand-arrow">›</div>
      </div>
      <div class="rv-card-body">
        <p class="rv-full-question">${item.q.question}</p>
        <div class="rv-answer-row">
          <div class="rv-answer-box rv-your-ans ${correct ? "ans-correct" : "ans-wrong"}">
            <span class="rv-ans-label">Your Answer</span>
            <span class="rv-ans-value">${item.selected}</span>
          </div>
          ${!correct ? `
          <div class="rv-answer-box rv-correct-ans">
            <span class="rv-ans-label">Correct Answer</span>
            <span class="rv-ans-value">${item.q.answer}</span>
          </div>` : ""}
        </div>
      </div>
    `;

    const head = card.querySelector(".rv-card-head");
    const arrow = card.querySelector(".rv-expand-arrow");
    head.addEventListener("click", () => {
      const open = card.classList.toggle("rv-open");
      arrow.style.transform = open ? "rotate(90deg)" : "rotate(0deg)";
      soundClick();
    });
    head.addEventListener("keydown", e => { if(e.key==="Enter"||e.key===" ") head.click(); });

    list.appendChild(card);
  });
}

/* ═══════════════════════ TOAST HELPER ═══════════════════════ */
function showToast(message) {
  // Remove any existing toast
  const existing = document.querySelector(".all-correct-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "all-correct-toast";
  toast.innerText = message;
  document.body.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("show"));
  });

  // Auto-remove after 3.5s
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 600);
  }, 3500);
}

/* ═══════════════════════ END SCREEN ACTIONS ═══════════════════════ */

// ① Try Again → back to question picker (quiz mode)
document.getElementById("endRestart").onclick = () => {
  soundModeSelect();
  resultCard.classList.add("hidden");
  selectedMode = "quiz";
  pickerTitle.innerText = "Quiz Mode";
  pickerModeIcon.innerText = "🧠";
  wrongQuestions = []; reviewData = [];
  currentIndex = 0; score = 0;
  setupPicker();
  questionPicker.classList.remove("hidden");
};

// ② Retry Wrong Questions
document.getElementById("endRetryWrong").onclick = () => {
  if (wrongQuestions.length === 0) {
    soundCorrect();
    showToast("🎉 You answered all questions correctly!");
    return;
  }
  soundModeSelect();
  resultCard.classList.add("hidden");

  // Use wrongQuestions as the new question pool
  questions = shuffle([...wrongQuestions]);
  wrongQuestions = [];
  reviewData = [];
  currentIndex = 0;
  score = 0;
  selectedMode = "quiz";

  quizCard.classList.remove("hidden");
  showQuestion();
};

// ③ Upload new PDF
document.getElementById("endUpload").onclick = () => {
  location.reload();
};

// ④ Try Flashcards
document.getElementById("endFlash").onclick = () => {
  soundModeSelect();
  resultCard.classList.add("hidden");
  selectedMode = "flash";
  pickerTitle.innerText = "Flashcard Mode";
  pickerModeIcon.innerText = "⚡";
  wrongQuestions = []; reviewData = [];
  currentIndex = 0; score = 0;
  setupPicker();
  questionPicker.classList.remove("hidden");
};

/* ═══════════════════════ UTILS ═══════════════════════ */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
