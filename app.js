/**
 * FLUX — Dynamic Habit & Task Tracker
 * app.js — Frontend logic with Firebase Firestore
 *
 * HOW THIS WORKS:
 * - Reads/writes tasks from Firestore in real-time
 * - Groups tasks by date automatically
 * - Updates charts (Chart.js) on every data change
 * - Uses Firebase Anonymous Auth so each browser gets its own data
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, deleteDoc, doc,
  updateDoc, onSnapshot, query, where, orderBy, Timestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ════════════════════════════════
   1. FIREBASE CONFIG
   Replace these values with YOUR Firebase project config.
   Get it from: Firebase Console → Project Settings → Your apps → SDK setup
   ════════════════════════════════ */
const firebaseConfig = {
  apiKey: "AIzaSyAfQogt4eGWWh8x_lC08D3-obVNDrRY9b8",
  authDomain: "sdhari.firebaseapp.com",
  projectId: "sdhari",
  storageBucket: "sdhari.firebasestorage.app",
  messagingSenderId: "843053621856",
  appId: "1:843053621856:web:906669e25f259f626d5905"
};

/* ── INIT FIREBASE ── */
const app   = initializeApp(firebaseConfig);
const db    = getFirestore(app);
const auth  = getAuth(app);

/* ════════════════════════════════
   2. STATE
   ════════════════════════════════ */
let currentUser  = null;
let allTasks     = [];        // All tasks from Firestore
let currentFilter = "all";   // "all" | "pending" | "done"
let ringChartInstance        = null;
let consistencyChartInstance = null;
let barChartInstance         = null;
let unsubscribeTasks         = null;  // Firestore listener cleanup

/* ════════════════════════════════
   3. DOM REFS
   ════════════════════════════════ */
const $ = id => document.getElementById(id);

const DOM = {
  todayDate:    $("todayDate"),
  streakCount:  $("streakCount"),
  statAdded:    $("stat-added"),
  statDone:     $("stat-done"),
  ringPct:      $("ringPct"),
  taskGroups:   $("taskGroups"),
  emptyState:   $("emptyState"),
  fabBtn:       $("fabBtn"),
  modalOverlay: $("modalOverlay"),
  modalClose:   $("modalClose"),
  btnCancel:    $("btnCancel"),
  btnAdd:       $("btnAdd"),
  taskInput:    $("taskInput"),
  toast:        $("toast"),
  monthlyTotal: $("monthlyTotal"),
  monthlyActiveDays: $("monthlyActiveDays"),
  yearlyTotal:  $("yearlyTotal"),
  yearlyBest:   $("yearlyBest"),
};

/* ════════════════════════════════
   4. AUTH — Anonymous Sign In
   Each browser gets its own isolated task list via UID
   ════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    startListening();
  } else {
    // Not signed in → sign in anonymously
    signInAnonymously(auth).catch(err => {
      console.error("Auth error:", err);
      showToast("⚠ Auth failed. Using local mode.");
      // Fallback: still run app without auth (will fail Firestore writes if rules require auth)
    });
  }
});

/* ════════════════════════════════
   5. FIRESTORE REAL-TIME LISTENER
   ════════════════════════════════ */
function startListening() {
  if (!currentUser) return;

  // Clean up any existing listener
  if (unsubscribeTasks) unsubscribeTasks();

  // Query tasks belonging to this user, sorted by creation date
  const q = query(
    collection(db, "tasks"),
    where("uid", "==", currentUser.uid),
    orderBy("createdAt", "desc")
  );

  unsubscribeTasks = onSnapshot(q, snapshot => {
    allTasks = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data(),
      // Convert Firestore Timestamp to JS Date
      createdAt: d.data().createdAt?.toDate() || new Date()
    }));

    render();
  }, err => {
    console.error("Firestore error:", err);
    showToast("⚠ DB error: " + err.code);
  });
}

/* ════════════════════════════════
   6. TASK CRUD
   ════════════════════════════════ */

/** Add a new task to Firestore */
async function addTask(name) {
  if (!currentUser) { showToast("⚠ Not signed in yet"); return; }
  const trimmed = name.trim();
  if (!trimmed) return;

  try {
    await addDoc(collection(db, "tasks"), {
      uid:       currentUser.uid,
      name:      trimmed,
      done:      false,
      createdAt: Timestamp.now()
    });
    showToast("✦ Task added");
  } catch (e) {
    console.error(e);
    showToast("⚠ Failed to add task");
  }
}

/** Toggle completion status */
async function toggleTask(taskId, currentDone) {
  try {
    await updateDoc(doc(db, "tasks", taskId), { done: !currentDone });
  } catch (e) {
    console.error(e);
  }
}

/** Delete a task */
async function deleteTask(taskId) {
  try {
    await deleteDoc(doc(db, "tasks", taskId));
    showToast("✕ Task removed");
  } catch (e) {
    console.error(e);
  }
}

/* ════════════════════════════════
   7. RENDER — Main update function
   Called every time Firestore data changes
   ════════════════════════════════ */
function render() {
  renderHeader();
  renderDailyTab();
  renderMonthlyTab();
  renderYearlyTab();
}

/* ─ Header date & streak ─ */
function renderHeader() {
  const now = new Date();
  DOM.todayDate.textContent = now.toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric"
  }).toUpperCase();

  DOM.streakCount.textContent = calcStreak();
}

/** Calculate current daily streak (consecutive days with ≥1 completed task) */
function calcStreak() {
  const doneTasks = allTasks.filter(t => t.done);
  if (!doneTasks.length) return 0;

  // Get unique date strings of completion
  const dateSets = new Set(
    doneTasks.map(t => toDateKey(t.createdAt))
  );

  let streak = 0;
  let d = new Date();

  while (true) {
    const key = toDateKey(d);
    if (dateSets.has(key)) {
      streak++;
      d.setDate(d.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

/* ─ Daily Tab ─ */
function renderDailyTab() {
  const todayKey = toDateKey(new Date());
  const todayTasks = allTasks.filter(t => toDateKey(t.createdAt) === todayKey);

  const added = todayTasks.length;
  const done  = todayTasks.filter(t => t.done).length;
  const pct   = added > 0 ? Math.round((done / added) * 100) : 0;

  DOM.statAdded.textContent = added;
  DOM.statDone.textContent  = done;
  DOM.ringPct.textContent   = pct + "%";

  updateRingChart(pct);

  // Apply filter
  const filtered = currentFilter === "all"     ? allTasks
                 : currentFilter === "pending"  ? allTasks.filter(t => !t.done)
                 : allTasks.filter(t => t.done);

  renderTaskGroups(filtered);
}

/** Render tasks grouped by date */
function renderTaskGroups(tasks) {
  DOM.taskGroups.innerHTML = "";

  if (!tasks.length) {
    DOM.taskGroups.appendChild(DOM.emptyState);
    DOM.emptyState.style.display = "block";
    return;
  }

  // Group tasks by date key
  const groups = {};
  tasks.forEach(t => {
    const key = toDateKey(t.createdAt);
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  // Sort groups newest first
  const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));

  sortedKeys.forEach(key => {
    const groupEl = document.createElement("div");
    groupEl.className = "task-group";

    // Date label
    const label = document.createElement("div");
    label.className = "group-date-label";
    label.textContent = formatGroupDate(key);
    groupEl.appendChild(label);

    // Task list
    const listEl = document.createElement("div");
    listEl.className = "task-list";

    groups[key].forEach(task => {
      listEl.appendChild(buildTaskEl(task));
    });

    groupEl.appendChild(listEl);
    DOM.taskGroups.appendChild(groupEl);
  });
}

/** Build a single task DOM element */
function buildTaskEl(task) {
  const item = document.createElement("div");
  item.className = "task-item" + (task.done ? " done" : "");
  item.dataset.id = task.id;

  item.innerHTML = `
    <div class="task-check">
      <div class="task-check-inner"></div>
      <span class="check-tick">✓</span>
    </div>
    <span class="task-name">${escapeHtml(task.name)}</span>
    <button class="task-delete" title="Delete task" aria-label="Delete">✕</button>
  `;

  // Toggle on click (anywhere except delete btn)
  item.addEventListener("click", e => {
    if (e.target.closest(".task-delete")) return;
    toggleTask(task.id, task.done);
  });

  // Delete button
  item.querySelector(".task-delete").addEventListener("click", e => {
    e.stopPropagation();
    deleteTask(task.id);
  });

  return item;
}

/* ─ Monthly Tab ─ */
function renderMonthlyTab() {
  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth();

  // Tasks completed this month
  const monthlyDone = allTasks.filter(t => {
    const d = t.createdAt;
    return t.done && d.getFullYear() === thisYear && d.getMonth() === thisMonth;
  });

  DOM.monthlyTotal.textContent = monthlyDone.length;

  // Active days (days with at least 1 completed task)
  const activeDays = new Set(monthlyDone.map(t => toDateKey(t.createdAt)));
  DOM.monthlyActiveDays.textContent = activeDays.size;

  // Build last-30-days consistency data
  const last30 = buildLast30Days();
  updateConsistencyChart(last30);
}

/** Returns array of {label, count} for last 30 days */
function buildLast30Days() {
  const result = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = toDateKey(d);
    const count = allTasks.filter(
      t => t.done && toDateKey(t.createdAt) === key
    ).length;
    result.push({
      label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      count
    });
  }
  return result;
}

/* ─ Yearly Tab ─ */
function renderYearlyTab() {
  const thisYear = new Date().getFullYear();

  const yearlyDone = allTasks.filter(t =>
    t.done && t.createdAt.getFullYear() === thisYear
  );

  DOM.yearlyTotal.textContent = yearlyDone.length;

  // Monthly counts
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const monthlyCounts = Array(12).fill(0);

  yearlyDone.forEach(t => {
    monthlyCounts[t.createdAt.getMonth()]++;
  });

  // Best month
  const maxVal = Math.max(...monthlyCounts);
  if (maxVal > 0) {
    DOM.yearlyBest.textContent = MONTHS[monthlyCounts.indexOf(maxVal)];
  } else {
    DOM.yearlyBest.textContent = "—";
  }

  updateBarChart(MONTHS, monthlyCounts);
}

/* ════════════════════════════════
   8. CHARTS (Chart.js)
   ════════════════════════════════ */

const CHART_DEFAULTS = {
  color:        "rgba(240,237,230,0.6)",
  gridColor:    "rgba(255,255,255,0.06)",
  accentColor:  "#ffb900",
  accentFade:   "rgba(255,185,0,0.15)",
  greenColor:   "#39d98a",
};

/* Ring (Doughnut) Chart — daily completion % */
function updateRingChart(pct) {
  const ctx = $("ringChart").getContext("2d");
  const rest = 100 - pct;

  if (ringChartInstance) {
    ringChartInstance.data.datasets[0].data = [pct, rest];
    ringChartInstance.update("none");
    return;
  }

  ringChartInstance = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [{
        data: [pct, rest],
        backgroundColor: [CHART_DEFAULTS.greenColor, "rgba(255,255,255,0.05)"],
        borderWidth: 0,
        borderRadius: 4,
        spacing: 2,
      }]
    },
    options: {
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      animation: { animateRotate: true, duration: 600 }
    }
  });
}

/* Line Chart — consistency over 30 days */
function updateConsistencyChart(data) {
  const ctx = $("consistencyChart").getContext("2d");
  const labels = data.map(d => d.label);
  const counts  = data.map(d => d.count);

  // Gradient fill
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0,   "rgba(255,185,0,0.35)");
  grad.addColorStop(1,   "rgba(255,185,0,0)");

  if (consistencyChartInstance) {
    consistencyChartInstance.data.labels = labels;
    consistencyChartInstance.data.datasets[0].data = counts;
    consistencyChartInstance.update();
    return;
  }

  consistencyChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        data: counts,
        borderColor:     CHART_DEFAULTS.accentColor,
        backgroundColor: grad,
        borderWidth:     2,
        pointRadius:     3,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_DEFAULTS.accentColor,
        tension:         0.4,
        fill:            true,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,10,15,0.9)",
          borderColor:     CHART_DEFAULTS.accentColor,
          borderWidth:     1,
          titleColor:      CHART_DEFAULTS.accentColor,
          bodyColor:       CHART_DEFAULTS.color,
          callbacks: {
            title: items => items[0].label,
            label: item  => ` ${item.raw} tasks completed`
          }
        }
      },
      scales: {
        x: {
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: {
            color: CHART_DEFAULTS.color,
            maxTicksLimit: 6,
            font: { size: 10, family: "'DM Sans'" }
          }
        },
        y: {
          beginAtZero: true,
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: {
            color: CHART_DEFAULTS.color,
            stepSize: 1,
            font: { size: 10, family: "'DM Sans'" }
          }
        }
      }
    }
  });
}

/* Bar Chart — monthly performance */
function updateBarChart(labels, data) {
  const ctx = $("monthlyBarChart").getContext("2d");

  // Gradient per bar
  const grad = ctx.createLinearGradient(0, 0, 0, 200);
  grad.addColorStop(0, "#ffb900");
  grad.addColorStop(1, "rgba(255,107,53,0.6)");

  if (barChartInstance) {
    barChartInstance.data.datasets[0].data = data;
    barChartInstance.update();
    return;
  }

  barChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: grad,
        borderRadius:    6,
        borderSkipped:   false,
        maxBarThickness: 28,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: "rgba(10,10,15,0.9)",
          borderColor:     CHART_DEFAULTS.accentColor,
          borderWidth:     1,
          titleColor:      CHART_DEFAULTS.accentColor,
          bodyColor:       CHART_DEFAULTS.color,
          callbacks: {
            label: item => ` ${item.raw} completed`
          }
        }
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: CHART_DEFAULTS.color, font: { size: 10 } }
        },
        y: {
          beginAtZero: true,
          grid: { color: CHART_DEFAULTS.gridColor },
          ticks: {
            color: CHART_DEFAULTS.color,
            stepSize: 1,
            font: { size: 10 }
          }
        }
      }
    }
  });
}

/* ════════════════════════════════
   9. UI EVENTS
   ════════════════════════════════ */

/* Tab switching */
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    $("tab-" + btn.dataset.tab).classList.add("active");
  });
});

/* Filter pills */
document.querySelectorAll(".pill").forEach(pill => {
  pill.addEventListener("click", () => {
    document.querySelectorAll(".pill").forEach(p => p.classList.remove("active"));
    pill.classList.add("active");
    currentFilter = pill.dataset.filter;
    renderDailyTab();
  });
});

/* FAB — open modal */
DOM.fabBtn.addEventListener("click", openModal);

/* Close modal */
DOM.modalClose.addEventListener("click", closeModal);
DOM.btnCancel.addEventListener("click",  closeModal);
DOM.modalOverlay.addEventListener("click", e => {
  if (e.target === DOM.modalOverlay) closeModal();
});

/* Add task on button click */
DOM.btnAdd.addEventListener("click", submitTask);

/* Add task on Enter key */
DOM.taskInput.addEventListener("keydown", e => {
  if (e.key === "Enter") submitTask();
});

/* ─ Modal helpers ─ */
function openModal() {
  DOM.modalOverlay.classList.add("open");
  DOM.fabBtn.classList.add("open");
  setTimeout(() => DOM.taskInput.focus(), 100);
}

function closeModal() {
  DOM.modalOverlay.classList.remove("open");
  DOM.fabBtn.classList.remove("open");
  DOM.taskInput.value = "";
}

async function submitTask() {
  const val = DOM.taskInput.value.trim();
  if (!val) {
    DOM.taskInput.style.borderColor = "rgba(255,79,79,0.5)";
    setTimeout(() => DOM.taskInput.style.borderColor = "", 800);
    return;
  }
  closeModal();
  await addTask(val);
}

/* ════════════════════════════════
   10. UTILITIES
   ════════════════════════════════ */

/** Convert Date to "YYYY-MM-DD" string for grouping */
function toDateKey(d) {
  return d.toISOString().slice(0, 10);
}

/** Format date key to human-readable string */
function formatGroupDate(key) {
  const todayKey     = toDateKey(new Date());
  const yesterdayKey = toDateKey(new Date(Date.now() - 86400000));

  if (key === todayKey)     return "Today";
  if (key === yesterdayKey) return "Yesterday";

  return new Date(key + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric"
  });
}

/** Escape HTML to prevent XSS */
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Toast notification */
let toastTimer;
function showToast(msg) {
  DOM.toast.textContent = msg;
  DOM.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => DOM.toast.classList.remove("show"), 2200);
}

/* ── INIT ── */
renderHeader();

// Auto sign in (triggers startListening → render)
signInAnonymously(auth).catch(console.error);
