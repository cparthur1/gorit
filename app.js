/**
 * Gorit - Course Content, Exams & Task Tracker
 * Design System: Material You Expressive (M3)
 */

// --- Vector / Symbol Helpers ---
const PLUS_ICON = `<span class="material-symbols-rounded icon-sm">add</span>`;

// --- Designated Palette & Material Symbol Icons ---
const PRESET_COLORS = [
  '#3b82f7', // Gorit Primary Blue (designated)
  '#2563eb', // Deep Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink
  '#8b5cf6', // Purple
  '#64748b'  // Slate
];

const PRESET_ICONS = [
  'medical_services', 'cardiology', 'psychology', 'respiratory_rate', 'orthopedics',
  'visibility', 'dentistry', 'bloodtype', 'medication', 'vaccines',
  'science', 'biotech', 'radiology', 'healing', 'local_hospital',
  'school', 'menu_book', 'assignment', 'calculate', 'laptop_mac'
];

// Compatibility map: gracefully convert any legacy emojis to official Material Symbols
const EMOJI_TO_SYMBOL_MAP = {
  '🩺': 'medical_services',
  '🫀': 'cardiology',
  '🧠': 'psychology',
  '🫁': 'respiratory_rate',
  '🦴': 'orthopedics',
  '👁️': 'visibility',
  '👁': 'visibility',
  '🦷': 'dentistry',
  '👂': 'hearing',
  '🩸': 'bloodtype',
  '💊': 'medication',
  '💉': 'vaccines',
  '🔬': 'science',
  '🧬': 'biotech',
  '🧫': 'biotech',
  '🦠': 'coronavirus',
  '🩻': 'radiology',
  '🩹': 'healing',
  '🌡️': 'device_thermostat',
  '🌡': 'device_thermostat',
  '⚕️': 'medical_services',
  '⚕': 'medical_services',
  '🏥': 'local_hospital',
  '👶': 'child_care',
  '🧤': 'clean_hands',
  '📚': 'school',
  '📝': 'edit_note'
};

function getSubjectSymbol(subject) {
  if (subject && subject.icon && !EMOJI_TO_SYMBOL_MAP[subject.icon]) {
    return subject.icon;
  }
  if (subject && subject.emoji && EMOJI_TO_SYMBOL_MAP[subject.emoji]) {
    return EMOJI_TO_SYMBOL_MAP[subject.emoji];
  }
  return 'medical_services';
}

// --- Application State ---
const state = {
  subjects: [],
  activeTab: 'studies', // 'studies' | 'semester'
  expandedSubjectIds: new Set(),
  expandedContentIds: new Set(),
  searchQuery: '',
  selectedColor: PRESET_COLORS[0],
  selectedIcon: PRESET_ICONS[0],
  editingSubjectId: null,
  editingContentData: null
};

// Storage Keys: smoothly migrate from studyflow_data_v1 to gorit_data_v1
const STORAGE_KEY = 'gorit_data_v1';
const LEGACY_STORAGE_KEY = 'studyflow_data_v1';

// --- Date Utilities ---
function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function formatDate(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getExamStatus(dateStr) {
  const examDate = parseLocalDate(dateStr);
  if (!examDate) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = examDate.getTime() - today.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const passed = Math.abs(diffDays);
    return {
      type: 'past',
      icon: 'history',
      badgeClass: 'exam-past',
      text: passed === 1 ? 'Passed yesterday' : `${passed} days ago`,
      days: diffDays
    };
  } else if (diffDays === 0) {
    return {
      type: 'urgent',
      icon: 'priority_high',
      badgeClass: 'exam-urgent',
      text: 'Exam Today!',
      days: 0
    };
  } else if (diffDays === 1) {
    return {
      type: 'urgent',
      icon: 'warning',
      badgeClass: 'exam-urgent',
      text: 'Exam Tomorrow!',
      days: 1
    };
  } else if (diffDays <= 3) {
    return {
      type: 'urgent',
      icon: 'alarm',
      badgeClass: 'exam-urgent',
      text: `Exam in ${diffDays} days (${formatDate(dateStr)})`,
      days: diffDays
    };
  } else if (diffDays <= 7) {
    return {
      type: 'soon',
      icon: 'event',
      badgeClass: 'exam-soon',
      text: `Exam in ${diffDays} days (${formatDate(dateStr)})`,
      days: diffDays
    };
  } else {
    return {
      type: 'future',
      icon: 'event',
      badgeClass: 'exam-future',
      text: `Exam in ${diffDays} days (${formatDate(dateStr)})`,
      days: diffDays
    };
  }
}

// --- Next Exam Calculation for a Subject ---
function getSubjectNextExam(subject) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let nearestUpcoming = null;
  let nearestUpcomingDiff = Infinity;
  let latestPast = null;
  let latestPastDiff = -Infinity;

  (subject.contents || []).forEach(content => {
    if (!content.examDate) return;
    const d = parseLocalDate(content.examDate);
    if (!d) return;

    const diff = d.getTime() - today.getTime();
    if (diff >= 0) {
      if (diff < nearestUpcomingDiff) {
        nearestUpcomingDiff = diff;
        nearestUpcoming = {
          dateStr: content.examDate,
          date: d,
          contentTitle: content.title,
          days: Math.round(diff / (1000 * 60 * 60 * 24))
        };
      }
    } else {
      if (diff > latestPastDiff) {
        latestPastDiff = diff;
        latestPast = {
          dateStr: content.examDate,
          date: d,
          contentTitle: content.title,
          days: Math.round(diff / (1000 * 60 * 60 * 24))
        };
      }
    }
  });

  return { nearestUpcoming, latestPast };
}

// --- Sorting Subjects Chronologically ---
function sortSubjectsChronologically(subjects) {
  return [...subjects].sort((a, b) => {
    const examA = getSubjectNextExam(a);
    const examB = getSubjectNextExam(b);

    const hasUpcomingA = Boolean(examA.nearestUpcoming);
    const hasUpcomingB = Boolean(examB.nearestUpcoming);

    // 1. Subjects with upcoming exam dates come first, ordered ascending
    if (hasUpcomingA && hasUpcomingB) {
      const diff = examA.nearestUpcoming.date.getTime() - examB.nearestUpcoming.date.getTime();
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }
    if (hasUpcomingA && !hasUpcomingB) return -1;
    if (!hasUpcomingA && hasUpcomingB) return 1;

    // 2. Neither has upcoming exams: check if they have past exams
    const hasPastA = Boolean(examA.latestPast);
    const hasPastB = Boolean(examB.latestPast);

    if (hasPastA && hasPastB) {
      // More recent past exam first
      const diff = examB.latestPast.date.getTime() - examA.latestPast.date.getTime();
      if (diff !== 0) return diff;
    } else if (hasPastA && !hasPastB) {
      return -1;
    } else if (!hasPastA && hasPastB) {
      return 1;
    }

    // 3. Fallback: alphabetical
    return a.name.localeCompare(b.name);
  });
}

// --- Sort Contents chronologically inside a Subject ---
function sortContentsChronologically(contents) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return [...contents].sort((a, b) => {
    const dateA = parseLocalDate(a.examDate);
    const dateB = parseLocalDate(b.examDate);

    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime();
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return a.title.localeCompare(b.title);
  });
}

// --- Progress Calculation ---
function isContentCompleted(content) {
  if (!content) return false;
  if (content.todos && content.todos.length > 0) {
    return content.todos.every(t => t.completed);
  }
  return Boolean(content.completed);
}

function getContentProgress(content) {
  const todos = content.todos || [];
  const total = todos.length;
  if (total === 0) {
    const isDone = Boolean(content.completed);
    return {
      total: 1,
      completed: isDone ? 1 : 0,
      percent: isDone ? 100 : 0,
      hasTodos: false
    };
  }

  const completed = todos.filter(t => t.completed).length;
  const percent = Math.round((completed / total) * 100);
  return {
    total,
    completed,
    percent,
    hasTodos: true
  };
}

function getSubjectProgress(subject) {
  const contents = subject.contents || [];
  let total = 0;
  let completed = 0;
  let hasAnyTodos = false;

  contents.forEach(c => {
    const p = getContentProgress(c);
    total += p.total;
    completed += p.completed;
    if (p.hasTodos) hasAnyTodos = true;
  });

  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, percent, contentsCount: contents.length, hasAnyTodos };
}

function isSubjectAllDone(subject) {
  const contents = subject.contents || [];
  if (contents.length === 0) return false;
  return contents.every(c => isContentCompleted(c));
}

function getOverallStats() {
  let totalSubjects = state.subjects.length;
  let totalContents = 0;
  let totalItems = 0;
  let completedItems = 0;
  let nextExam = null;
  let nextExamDiff = Infinity;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  state.subjects.forEach(subject => {
    (subject.contents || []).forEach(content => {
      totalContents++;
      const p = getContentProgress(content);
      totalItems += p.total;
      completedItems += p.completed;

      if (content.examDate) {
        const d = parseLocalDate(content.examDate);
        if (d && d.getTime() >= today.getTime()) {
          const diff = d.getTime() - today.getTime();
          if (diff < nextExamDiff) {
            nextExamDiff = diff;
            nextExam = {
              subjectName: subject.name,
              contentTitle: content.title,
              dateStr: content.examDate,
              days: Math.round(diff / (1000 * 60 * 60 * 24))
            };
          }
        }
      }
    });
  });

  const percent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  return { totalSubjects, totalContents, totalTodos: totalItems, completedTodos: completedItems, percent, nextExam };
}

// --- Continuous Autosave & Persistence ---
let isSyncingToServer = false;
let hasPendingServerSync = false;
let autosaveDebounceTimer = null;
let lastSavedTimestamp = null;

function updateAutosaveBadge(status, timestamp) {
  const badge = document.getElementById('autosave-badge');
  const dot = document.getElementById('autosave-dot');
  const text = document.getElementById('autosave-text');
  if (!badge || !dot || !text) return;

  dot.className = 'autosave-dot';
  if (status === 'saving') {
    dot.classList.add('saving');
    text.textContent = 'Saving to device...';
    badge.title = 'Writing changes to local server storage (data.json)...';
  } else if (status === 'saved') {
    if (timestamp) lastSavedTimestamp = timestamp;
    let timeStr = '';
    if (lastSavedTimestamp) {
      const d = new Date(lastSavedTimestamp);
      timeStr = ` (${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })})`;
    }
    text.textContent = `Autosaved to device${timeStr}`;
    badge.title = 'All changes are permanently saved locally on the hosting device (server.py)';
  } else if (status === 'offline') {
    dot.classList.add('offline');
    text.textContent = 'Saved locally (browser)';
    badge.title = 'Running offline or directly via file://. Changes saved in browser storage.';
  } else if (status === 'error') {
    dot.classList.add('error');
    text.textContent = 'Autosave error';
    badge.title = 'Could not reach server.py. Please verify the server is running.';
  }
}

async function syncToServer() {
  if (isSyncingToServer) {
    hasPendingServerSync = true;
    return;
  }
  isSyncingToServer = true;
  updateAutosaveBadge('saving');

  try {
    const payload = JSON.stringify(state.subjects);
    const res = await fetch('/api/data', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payload
    });

    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }

    const data = await res.json();
    updateAutosaveBadge('saved', data.saved_at || new Date().toISOString());
  } catch (err) {
    console.warn('Autosave to server failed (using browser offline storage):', err.message);
    updateAutosaveBadge('offline');
  } finally {
    isSyncingToServer = false;
    if (hasPendingServerSync) {
      hasPendingServerSync = false;
      syncToServer();
    }
  }
}

/**
 * Main autosave entrypoint for every interaction in Gorit.
 * Updates browser localStorage immediately and continuously syncs to server.py.
 */
function saveToStorage(immediate = true) {
  // 1. Instant local storage write
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
  }

  // 2. Continuous autosave to server.py on hosting device
  if (immediate) {
    if (autosaveDebounceTimer) {
      clearTimeout(autosaveDebounceTimer);
      autosaveDebounceTimer = null;
    }
    syncToServer();
  } else {
    updateAutosaveBadge('saving');
    if (autosaveDebounceTimer) clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = setTimeout(() => {
      autosaveDebounceTimer = null;
      syncToServer();
    }, 450);
  }
}

// Flush any pending debounced autosave immediately on tab close or navigation
window.addEventListener('beforeunload', () => {
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = null;
  }
  try {
    const payload = JSON.stringify(state.subjects);
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: 'application/json' });
      navigator.sendBeacon('/api/data', blob);
    } else {
      fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true
      });
    }
  } catch (e) {
    // ignore
  }
});

async function loadFromStorage() {
  let localData = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const isOldMockData = Array.isArray(parsed) && parsed.some(s => s.id === 'sub-calculo');
      if (!isOldMockData && Array.isArray(parsed)) {
        localData = parsed;
      }
    }
  } catch (e) {
    console.error('Error loading from localStorage:', e);
  }

  if (localData && localData.length > 0) {
    state.subjects = localData;
    renderApp();
  }

  // Fetch persisted data from the server hosting device
  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const serverData = await res.json();
      const subjects = Array.isArray(serverData) ? serverData : (serverData.subjects || []);

      if (subjects && subjects.length > 0) {
        state.subjects = subjects;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(subjects));
        renderApp();
        updateAutosaveBadge('saved');
      } else if (localData && localData.length > 0) {
        // Migrate existing browser data to host file
        await syncToServer();
      } else {
        state.subjects = [];
        renderApp();
        updateAutosaveBadge('saved');
      }
    } else {
      updateAutosaveBadge('offline');
    }
  } catch (e) {
    console.warn('Server offline or running standalone file. Using browser storage.', e);
    updateAutosaveBadge('offline');
  }
}

// --- Sample Data Generator (Medical School Theme) ---
function loadSampleData(notify = true) {
  const today = new Date();
  
  function getRelDate(daysOffset) {
    const d = new Date(today);
    d.setDate(today.getDate() + daysOffset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  state.subjects = [
    {
      id: 'sub-anat',
      name: 'Human Anatomy & Embryology',
      icon: 'cardiology',
      color: '#ef4444',
      code: 'ANAT101',
      contents: [
        {
          id: 'c-anat-1',
          title: 'Cardiovascular & Respiratory Systems',
          examDate: getRelDate(3),
          notes: 'Coronary vessels, heart chambers, and lung bronchopulmonary segments.',
          todos: [
            { id: 't1', title: 'Review coronary circulation and cardiac valves', completed: true },
            { id: 't2', title: 'Dissect thoracic cavity and trace pulmonary veins', completed: true },
            { id: 't3', title: 'Study bronchial tree and innervation', completed: false },
            { id: 't4', title: 'Review 3D anatomy atlas flashcards', completed: false }
          ]
        },
        {
          id: 'c-anat-2',
          title: 'Cranial Nerves & Head/Neck Anatomy',
          examDate: getRelDate(25),
          notes: 'Foramina, functional components, and lesion localizations.',
          todos: [
            { id: 't5', title: 'Memorize cranial exit foramina for CN I-XII', completed: false },
            { id: 't6', title: 'Map parasympathetic ganglia of the head', completed: false }
          ]
        }
      ]
    },
    {
      id: 'sub-phys',
      name: 'Medical Physiology',
      icon: 'psychology',
      color: '#3b82f7',
      code: 'PHYS101',
      contents: [
        {
          id: 'c-phys-1',
          title: 'Renal Physiology & Acid-Base Balance',
          examDate: getRelDate(7),
          notes: 'Glomerular filtration rate, countercurrent multiplication, Davenport diagram.',
          todos: [
            { id: 't7', title: 'Calculate GFR and clearance formulas', completed: true },
            { id: 't8', title: 'Solve arterial blood gas practice problems', completed: false },
            { id: 't9', title: 'Review renin-angiotensin-aldosterone feedback', completed: false }
          ]
        },
        {
          id: 'c-phys-2',
          title: 'Endocrine Regulation & Metabolism',
          examDate: getRelDate(35),
          notes: 'HPA axis, thyroid hormones, and glucose homeostasis.',
          todos: [
            { id: 't10', title: 'Diagram hypothalamic releasing hormones and feedback loops', completed: false }
          ]
        }
      ]
    },
    {
      id: 'sub-pharm',
      name: 'Medical Pharmacology',
      icon: 'medication',
      color: '#10b981',
      code: 'PHARM201',
      contents: [
        {
          id: 'c-pharm-1',
          title: 'Autonomic & Cardiovascular Drugs',
          examDate: getRelDate(14),
          notes: 'Beta-blockers, ACE inhibitors, calcium channel blockers.',
          todos: [
            { id: 't11', title: 'Chart adrenergic receptors (alpha-1, alpha-2, beta-1, beta-2)', completed: true },
            { id: 't12', title: 'Compare side effect profiles of antiarrhythmics', completed: false }
          ]
        }
      ]
    },
    {
      id: 'sub-path',
      name: 'General Pathology',
      icon: 'science',
      color: '#8b5cf6',
      code: 'PATH201',
      contents: [
        {
          id: 'c-path-1',
          title: 'Cellular Injury & Hemodynamic Disorders',
          examDate: getRelDate(21),
          notes: 'Apoptosis vs necrosis patterns, thrombosis and embolism.',
          todos: [
            { id: 't13', title: 'Review histological markers of coagulative necrosis', completed: false }
          ]
        }
      ]
    }
  ];

  state.expandedSubjectIds.clear();
  state.expandedContentIds.clear();

  saveToStorage();
  renderApp();
  if (notify) showToast('Sample courses loaded successfully!');
}

// --- Toast Notifications ---
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span class="material-symbols-rounded">check_circle</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'all 0.25s var(--m3-easing-standard)';
    setTimeout(() => toast.remove(), 250);
  }, 3200);
}

// --- Confetti Effect for 100% completion ---
function fireCelebration() {
  try {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 75,
        spread: 65,
        origin: { y: 0.7 }
      });
    }
  } catch (e) {
    // optional confetti fallback
  }
}

// --- Utility: escape HTML ---
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// --- Render: Stats Header ---
function renderStats() {
  const stats = getOverallStats();
  
  const subjectsEl = document.getElementById('stat-total-subjects');
  const contentsEl = document.getElementById('stat-total-contents');
  const progressEl = document.getElementById('stat-total-progress');
  const nextExamEl = document.getElementById('stat-next-exam');

  if (subjectsEl) subjectsEl.textContent = stats.totalSubjects;
  if (contentsEl) contentsEl.textContent = `${stats.totalContents} ${stats.totalContents === 1 ? 'content' : 'contents'}`;
  if (progressEl) {
    const todoRatio = stats.totalTodos > 0 ? `(${stats.completedTodos}/${stats.totalTodos})` : '(0 items)';
    progressEl.innerHTML = `${stats.percent}% <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">${todoRatio}</span>`;
  }
  if (nextExamEl) {
    if (stats.nextExam) {
      let icon = 'event';
      let daysText = `in ${stats.nextExam.days} days`;
      if (stats.nextExam.days === 0) {
        icon = 'priority_high';
        daysText = 'Today!';
      } else if (stats.nextExam.days === 1) {
        icon = 'warning';
        daysText = 'Tomorrow';
      }
      nextExamEl.innerHTML = `<span class="material-symbols-rounded icon-sm" style="color:var(--primary); vertical-align:middle; margin-right:3px;">${icon}</span><strong>${daysText}</strong> <span class="stat-hint">(${escapeHtml(stats.nextExam.subjectName)})</span>`;
    } else {
      nextExamEl.innerHTML = `<span style="color:var(--text-muted); font-size: 0.9rem;">None scheduled</span>`;
    }
  }
}

// --- Render: Main Collapsible Studies View (Tab 1) ---
function renderStudiesView() {
  const container = document.getElementById('studies-list-container');
  if (!container) return;

  const sortedSubjects = sortSubjectsChronologically(state.subjects);

  // Search filter
  const q = state.searchQuery.trim().toLowerCase();
  const filteredSubjects = sortedSubjects.filter(sub => {
    if (!q) return true;
    const matchSub = sub.name.toLowerCase().includes(q) || (sub.code && sub.code.toLowerCase().includes(q));
    const matchContent = (sub.contents || []).some(c => c.title.toLowerCase().includes(q));
    return matchSub || matchContent;
  });

  if (filteredSubjects.length === 0) {
    if (state.subjects.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded empty-state-icon">menu_book</span>
          <h3 class="empty-state-title">No subjects registered yet</h3>
          <p class="empty-state-desc">Add your semester subjects to start organizing course contents, exam deadlines, and tasks.</p>
          <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="switchTab('semester')">
              ${PLUS_ICON} Add Semester Subject
            </button>
            <button class="btn btn-outline" onclick="loadSampleData(true)">
              <span class="material-symbols-rounded icon-sm">school</span>
              Load Sample Courses
            </button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded empty-state-icon">search_off</span>
          <h3 class="empty-state-title">No content found</h3>
          <p class="empty-state-desc">No subjects or contents match "${escapeHtml(state.searchQuery)}".</p>
          <button class="btn btn-secondary btn-sm" onclick="clearSearch()">Clear Search</button>
        </div>
      `;
    }
    return;
  }

  let html = '';

  filteredSubjects.forEach((subject, subIndex) => {
    const isSubjectExpanded = state.expandedSubjectIds.has(subject.id);
    const subProgress = getSubjectProgress(subject);
    const examInfo = getSubjectNextExam(subject);

    let nextExamBadgeHtml = '';
    if (examInfo.nearestUpcoming) {
      const u = examInfo.nearestUpcoming;
      const status = getExamStatus(u.dateStr);
      nextExamBadgeHtml = `
        <span class="exam-badge ${status.badgeClass}" title="Next exam: ${escapeHtml(u.contentTitle)}">
          <span class="material-symbols-rounded">${status.icon}</span>
          ${status.text}
        </span>
      `;
    } else if (examInfo.latestPast) {
      nextExamBadgeHtml = `
        <span class="exam-badge exam-past" title="Last exam completed">
          <span class="material-symbols-rounded">history</span>
          No upcoming exams
        </span>
      `;
    } else {
      nextExamBadgeHtml = `
        <span class="exam-badge exam-past">
          <span class="material-symbols-rounded">event_busy</span>
          No exams scheduled
        </span>
      `;
    }

    const color = subject.color || '#3b82f7';
    let progressText = '0% (no contents)';
    if (subProgress.contentsCount > 0) {
      if (subProgress.hasAnyTodos) {
        progressText = `${subProgress.percent}% (${subProgress.completed}/${subProgress.total} tasks)`;
      } else {
        progressText = `${subProgress.percent}% (${subProgress.completed}/${subProgress.total} completed)`;
      }
    }

    let subjectCompletedBadge = '';
    if (subProgress.percent === 100 && subProgress.total > 0) {
      subjectCompletedBadge = `
        <span class="exam-badge exam-completed" title="All contents in this subject completed!">
          <span class="material-symbols-rounded">check_circle</span>
          Completed
        </span>
      `;
    }

    const symbol = getSubjectSymbol(subject);

    // Build subject card
    html += `
      <div class="subject-card ${isSubjectExpanded ? 'is-expanded' : ''}" 
           id="subject-card-${subject.id}"
           style="--subject-color: ${color}">
        
        <!-- Header (Click to toggle expansion) -->
        <div class="subject-header" onclick="toggleSubject('${subject.id}', event)">
          <div class="subject-icon-box">
            <span class="material-symbols-rounded">${symbol}</span>
          </div>

          <div class="subject-info">
            <div class="subject-title-row">
              <div class="subject-name">
                ${subIndex === 0 && examInfo.nearestUpcoming ? '<span class="first-in-line-badge" title="Next upcoming exam of the semester!"><span class="material-symbols-rounded">grade</span> 1st in line</span>' : ''}
                ${escapeHtml(subject.name)}
                ${subject.code ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${escapeHtml(subject.code)})</span>` : ''}
              </div>
              <div class="subject-meta-chips">
                ${nextExamBadgeHtml}
                ${subjectCompletedBadge}
              </div>
            </div>

            <!-- Subject Progress Bar -->
            <div class="progress-wrap">
              <div class="progress-track" title="${subProgress.completed}/${subProgress.total} completed">
                <div class="progress-fill" style="width: ${subProgress.percent}%"></div>
              </div>
              <div class="progress-meta">
                ${progressText}
              </div>
            </div>
          </div>

          <div class="subject-chevron">
            <span class="material-symbols-rounded">expand_more</span>
          </div>
        </div>

        <!-- Subject Drawer (Expanded Content) -->
        <div class="subject-contents-drawer">
          <div class="contents-header-bar">
            <div class="contents-count-text">
              <span class="material-symbols-rounded">folder</span>
              Contents (${(subject.contents || []).length})
            </div>
            <div style="display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
              ${(subject.contents || []).length > 0 ? `
                <button class="btn btn-outline btn-sm" onclick="toggleAllSubjectContents('${subject.id}', event)" title="Toggle all contents in this subject as completed or pending">
                  <span class="material-symbols-rounded icon-sm">${isSubjectAllDone(subject) ? 'restart_alt' : 'done_all'}</span>
                  ${isSubjectAllDone(subject) ? 'Reset All' : 'Complete All'}
                </button>
              ` : ''}
              <button class="btn btn-primary btn-sm" onclick="openAddContentModal('${subject.id}', event)">
                ${PLUS_ICON} Add Content
              </button>
            </div>
          </div>

          <!-- List of Contents -->
          <div class="contents-list-wrap">
            ${renderContentsList(subject)}
          </div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;

  // Set indeterminate state on checkboxes for contents with partial todos completed
  container.querySelectorAll('.content-checkbox[data-indeterminate="true"]').forEach(el => {
    el.indeterminate = true;
  });
}

// --- Render: Contents inside a Subject ---
function renderContentsList(subject) {
  const contents = subject.contents || [];
  if (contents.length === 0) {
    return `
      <div style="text-align: center; padding: 1.5rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.6rem;">No contents added to this subject yet.</p>
        <button class="btn btn-secondary btn-sm" onclick="openAddContentModal('${subject.id}', event)">
          ${PLUS_ICON} Add 1st Content
        </button>
      </div>
    `;
  }

  const sorted = sortContentsChronologically(contents);

  return sorted.map(content => {
    const isExpanded = state.expandedContentIds.has(content.id);
    const progress = getContentProgress(content);
    const examStatus = content.examDate ? getExamStatus(content.examDate) : null;
    const isCompleted = isContentCompleted(content);
    const hasTodos = (content.todos || []).length > 0;
    const completedTodosCount = (content.todos || []).filter(t => t.completed).length;
    const totalTodosCount = (content.todos || []).length;
    const isIndeterminate = hasTodos && completedTodosCount > 0 && completedTodosCount < totalTodosCount;

    let examBadgeHtml = '';
    if (examStatus) {
      examBadgeHtml = `
        <span class="exam-badge ${examStatus.badgeClass}" title="Exam date: ${formatDate(content.examDate)}">
          <span class="material-symbols-rounded">${examStatus.icon}</span>
          ${examStatus.text}
        </span>
      `;
    } else {
      examBadgeHtml = `
        <span class="exam-badge exam-past" title="Click calendar to set exam date">
          <span class="material-symbols-rounded">event_available</span>
          No date set
        </span>
      `;
    }

    const datePickerHtml = `
      <div class="content-date-wrapper" onclick="event.stopPropagation()">
        ${examBadgeHtml}
        <label class="date-picker-trigger" title="Change exam deadline (autosaves)">
          <span class="material-symbols-rounded">calendar_today</span>
          <input 
            type="date" 
            class="quick-date-input" 
            value="${content.examDate || ''}" 
            onchange="handleInlineDateChange('${subject.id}', '${content.id}', this.value)" 
          />
        </label>
      </div>
    `;

    let contentProgressText = '';
    if (progress.hasTodos) {
      contentProgressText = isCompleted
        ? `${progress.percent}% (${progress.completed}/${progress.total} tasks) • Completed`
        : `${progress.percent}% (${progress.completed}/${progress.total} tasks)`;
    } else {
      contentProgressText = isCompleted
        ? `100% • Completed`
        : `0% • Pending`;
    }

    return `
      <div class="content-item-card ${isExpanded ? 'is-expanded' : ''} ${isCompleted ? 'is-completed' : ''}" id="content-card-${content.id}">
        <!-- Content Header (Click to expand tasks) -->
        <div class="content-item-header" onclick="toggleContent('${content.id}', event)">
          <div class="content-header-main">
            <!-- Whole Content Completion Checkbox -->
            <div class="content-check-wrap" onclick="event.stopPropagation()" title="${isCompleted ? 'Mark content as pending' : 'Check whole content as completed'}">
              <input 
                type="checkbox" 
                class="content-checkbox" 
                id="content-chk-${content.id}"
                ${isCompleted ? 'checked' : ''}
                ${isIndeterminate ? 'data-indeterminate="true"' : ''}
                onclick="event.stopPropagation()"
                onchange="toggleContentCompleted('${subject.id}', '${content.id}', this.checked, event)"
                aria-label="Mark ${escapeHtml(content.title)} as completed"
              />
            </div>

            <div class="content-item-info">
              <div class="content-title-row">
                <div class="content-title">
                  <span class="material-symbols-rounded content-status-icon ${isCompleted ? 'done' : ''}">${isCompleted ? 'check_circle' : 'radio_button_unchecked'}</span>
                  <span class="content-title-text ${isCompleted ? 'completed' : ''}">${escapeHtml(content.title)}</span>
                  ${isCompleted ? '<span class="content-completed-badge"><span class="material-symbols-rounded">check</span> Completed</span>' : ''}
                </div>
                <div>
                  ${datePickerHtml}
                </div>
              </div>

              <!-- Content Progress Bar -->
              <div class="progress-wrap" style="margin-top: 0.35rem;">
                <div class="progress-track" style="height: 6px;" title="${progress.completed}/${progress.total} completed">
                  <div class="progress-fill ${isCompleted ? 'is-completed' : ''}" style="width: ${progress.percent}%"></div>
                </div>
                <div class="progress-meta" style="font-size: 0.72rem;">
                  ${contentProgressText}
                </div>
              </div>
            </div>
          </div>

          <div class="content-header-actions">
            <button class="btn-icon btn-sm" title="Edit Content" onclick="openEditContentModal('${subject.id}', '${content.id}', event)" style="width:30px; height:30px;">
              <span class="material-symbols-rounded icon-sm">edit</span>
            </button>
            <button class="btn-icon btn-sm" title="Delete Content" onclick="deleteContent('${subject.id}', '${content.id}', event)" style="width:30px; height:30px;">
              <span class="material-symbols-rounded icon-sm">delete</span>
            </button>
            <div class="content-chevron">
              <span class="material-symbols-rounded">expand_more</span>
            </div>
          </div>
        </div>

        <!-- Content Tasks Drawer (To-Dos) -->
        <div class="content-tasks-drawer">
          <!-- Content Drawer Completion & Actions Bar -->
          <div class="content-drawer-header-actions">
            <button 
              type="button" 
              class="btn ${isCompleted ? 'btn-outline' : 'btn-success-soft'} btn-sm" 
              onclick="toggleContentCompleted('${subject.id}', '${content.id}', ${!isCompleted}, event)"
              title="${isCompleted ? 'Mark content as pending' : 'Check whole content and all its tasks as completed'}">
              <span class="material-symbols-rounded icon-sm">${isCompleted ? 'restart_alt' : 'check'}</span>
              ${isCompleted ? 'Mark as Pending' : 'Check as Completed'}
            </button>
            
            <div class="content-drawer-status-summary">
              <span class="material-symbols-rounded icon-sm">checklist</span>
              ${hasTodos 
                ? `<span>${completedTodosCount}/${totalTodosCount} tasks completed (${progress.percent}%)</span>` 
                : `<span>${isCompleted ? 'Content topic completed' : 'Content topic (mark complete above)'}</span>`
              }
            </div>
          </div>

          <div class="content-notes-box">
            <div class="content-notes-header">
              <div class="content-notes-header-left">
                <span class="material-symbols-rounded">lightbulb</span>
                <span>Notes &amp; Tips</span>
              </div>
              <span class="autosave-micro-hint" id="hint-notes-${content.id}">autosaved</span>
            </div>
            <textarea 
              class="content-notes-textarea" 
              id="textarea-notes-${content.id}"
              placeholder="Add notes, textbook chapters, formulas (autosaves as you type)..."
              rows="2"
              oninput="handleInlineNotesInput('${subject.id}', '${content.id}', this.value)"
              onblur="handleInlineNotesBlur('${subject.id}', '${content.id}', this.value)"
            >${escapeHtml(content.notes || '')}</textarea>
          </div>
          
          <div class="todo-list" id="todo-list-${content.id}">
            ${renderTodos(subject.id, content)}
          </div>

          <!-- Quick Inline Add Todo -->
          <form class="add-todo-inline" onsubmit="handleInlineAddTodo('${subject.id}', '${content.id}', event)">
            <input 
              type="text" 
              class="add-todo-input" 
              id="input-todo-${content.id}"
              placeholder="Add task (e.g. Read chapter 2, Flashcards, Practice questions...)" 
              autocomplete="off"
            />
            <button type="submit" class="btn btn-primary btn-sm">
              ${PLUS_ICON} Task
            </button>
          </form>
        </div>
      </div>
    `;
  }).join('');
}

// --- Render: Todos inside a Content ---
function renderTodos(subjectId, content) {
  const todos = content.todos || [];
  if (todos.length === 0) {
    return `<div style="font-size:0.82rem; color:var(--text-muted); padding:0.4rem 0;">No tasks added yet. Type below and press Enter to add a task!</div>`;
  }

  return todos.map(todo => {
    return `
      <div class="todo-row ${todo.completed ? 'completed' : ''}">
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''} 
          onchange="toggleTodoStatus('${subjectId}', '${content.id}', '${todo.id}', this.checked)"
        />
        <span 
          class="todo-text" 
          contenteditable="true" 
          spellcheck="false"
          title="Click to edit task (autosaves)"
          onblur="handleTodoTitleBlur('${subjectId}', '${content.id}', '${todo.id}', this)"
          onkeydown="handleTodoTitleKeydown(event, this)">${escapeHtml(todo.title)}</span>
        <button 
          class="todo-delete-btn" 
          title="Delete task" 
          onclick="deleteTodo('${subjectId}', '${content.id}', '${todo.id}', event)">
          <span class="material-symbols-rounded">close</span>
        </button>
      </div>
    `;
  }).join('');
}

// --- Render: Manage Semester Subjects View (Tab 2) ---
function renderSemesterView() {
  const container = document.getElementById('semester-subjects-list');
  if (!container) return;

  if (state.subjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded empty-state-icon">school</span>
        <h4 class="empty-state-title">No subjects added yet</h4>
        <p class="empty-state-desc">Use the form on the left to register your first semester subject with a custom name, icon, and color.</p>
      </div>
    `;
    return;
  }

  let html = '';
  state.subjects.forEach(subject => {
    const progress = getSubjectProgress(subject);
    const examInfo = getSubjectNextExam(subject);

    let examDateText = 'No date set';
    if (examInfo.nearestUpcoming) {
      examDateText = `Next exam in ${examInfo.nearestUpcoming.days} days (${formatDate(examInfo.nearestUpcoming.dateStr)})`;
    }

    const symbol = getSubjectSymbol(subject);

    html += `
      <div class="subject-manage-item" style="border-left: 6px solid ${subject.color || '#3b82f7'}">
        <div style="display:flex; align-items:center; gap:0.85rem; min-width:0;">
          <div class="subject-icon-box" style="--subject-color: ${subject.color || '#3b82f7'}">
            <span class="material-symbols-rounded">${symbol}</span>
          </div>
          <div style="min-width:0;">
            <div style="font-size:1.05rem; font-weight:700; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem;">
              ${escapeHtml(subject.name)}
              ${subject.code ? `<span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;">(${escapeHtml(subject.code)})</span>` : ''}
            </div>
            <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.2rem; display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
              <span>${progress.contentsCount} contents</span> • 
              <span>${progress.percent}% (${progress.completed}/${progress.total} ${progress.hasAnyTodos ? 'tasks' : 'contents'})</span> • 
              <span>${examDateText}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:0.45rem;">
          <button class="btn btn-secondary btn-sm" onclick="openAddContentModal('${subject.id}')">
            ${PLUS_ICON} Content
          </button>
          <button class="btn btn-outline btn-sm" onclick="editSubject('${subject.id}')">
            <span class="material-symbols-rounded icon-sm">edit</span>
            Edit
          </button>
          <button class="btn btn-danger btn-sm" onclick="deleteSubject('${subject.id}')">
            <span class="material-symbols-rounded icon-sm">delete</span>
            Delete
          </button>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// --- Render Material Symbol Icon & Color Pickers ---
function renderColorSwatches() {
  const container = document.getElementById('color-swatches-container');
  if (!container) return;

  container.innerHTML = PRESET_COLORS.map(color => `
    <button 
      type="button" 
      class="color-swatch-circle ${state.selectedColor === color ? 'active' : ''}" 
      style="background-color: ${color};" 
      onclick="selectColor('${color}')"
      title="Choose color ${color}">
    </button>
  `).join('') + `
    <input 
      type="color" 
      class="color-picker-input" 
      id="custom-color-input"
      value="${state.selectedColor}" 
      onchange="selectColor(this.value)" 
      title="Custom color"
    />
  `;
}

function renderIconPalette() {
  const container = document.getElementById('icon-palette-container');
  if (!container) return;

  container.innerHTML = PRESET_ICONS.map(iconName => `
    <button 
      type="button" 
      class="icon-opt-btn ${state.selectedIcon === iconName ? 'active' : ''}" 
      onclick="selectIcon('${iconName}')"
      title="${iconName.replace(/_/g, ' ')}">
      <span class="material-symbols-rounded">${iconName}</span>
    </button>
  `).join('');
}

function selectColor(color) {
  state.selectedColor = color;
  const customColorInput = document.getElementById('custom-color-input');
  if (customColorInput) customColorInput.value = color;
  renderColorSwatches();
  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.color = color;
      saveToStorage(true);
      renderSemesterView();
    }
  }
}

function selectIcon(iconName) {
  state.selectedIcon = iconName;
  const hiddenInput = document.getElementById('selected-icon-input');
  if (hiddenInput) hiddenInput.value = iconName;
  renderIconPalette();
  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.icon = iconName;
      subject.emoji = iconName;
      saveToStorage(true);
      renderSemesterView();
    }
  }
}

// --- Accordion Toggle Handlers ---
function toggleSubject(subjectId, event) {
  if (event) {
    if (event.target.closest('button') || event.target.closest('input')) return;
  }

  if (state.expandedSubjectIds.has(subjectId)) {
    state.expandedSubjectIds.delete(subjectId);
  } else {
    state.expandedSubjectIds.add(subjectId);
  }
  renderStudiesView();
}

function toggleContent(contentId, event) {
  if (event) {
    if (event.target.closest('button') || event.target.closest('input')) return;
  }

  if (state.expandedContentIds.has(contentId)) {
    state.expandedContentIds.delete(contentId);
  } else {
    state.expandedContentIds.add(contentId);
  }
  renderStudiesView();
}

function expandAll() {
  state.subjects.forEach(s => {
    state.expandedSubjectIds.add(s.id);
    (s.contents || []).forEach(c => state.expandedContentIds.add(c.id));
  });
  renderStudiesView();
  showToast('All items expanded.');
}

function collapseAll() {
  state.expandedSubjectIds.clear();
  state.expandedContentIds.clear();
  renderStudiesView();
  showToast('All items collapsed.');
}

// --- Tab Switching ---
function switchTab(tabName) {
  state.activeTab = tabName;
  
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-view').forEach(view => {
    view.classList.toggle('active', view.id === `view-${tabName}`);
  });

  if (tabName === 'studies') {
    renderStudiesView();
  } else if (tabName === 'semester') {
    renderSemesterView();
  }
}

// --- Subject CRUD ---
function handleSaveSubject(event) {
  event.preventDefault();
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');

  const name = nameInput.value.trim();
  if (!name) {
    alert('Please enter a subject name.');
    return;
  }

  const icon = state.selectedIcon || 'medical_services';
  const color = state.selectedColor || '#3b82f7';
  const code = codeInput ? codeInput.value.trim() : '';

  if (state.editingSubjectId) {
    // Update existing subject
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.name = name;
      subject.icon = icon;
      subject.emoji = icon;
      subject.color = color;
      subject.code = code;
      showToast(`Subject "${name}" updated successfully!`);
    }
    state.editingSubjectId = null;
    document.getElementById('subject-form-title').innerHTML = `
      <span class="material-symbols-rounded" style="color:var(--primary);">library_add</span>
      Add New Subject
    `;
    document.getElementById('subject-submit-btn').innerHTML = `${PLUS_ICON} Add Subject`;
    document.getElementById('subject-cancel-btn').style.display = 'none';
  } else {
    // Create new subject
    const newSubject = {
      id: 'sub-' + Date.now(),
      name,
      icon,
      emoji: icon,
      color,
      code,
      contents: []
    };
    state.subjects.push(newSubject);
    showToast(`Subject "${name}" added to semester!`);
  }

  // Reset form
  nameInput.value = '';
  if (codeInput) codeInput.value = '';
  saveToStorage();
  renderApp();
}

function editSubject(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  state.editingSubjectId = subject.id;
  document.getElementById('subject-name-input').value = subject.name;
  if (document.getElementById('subject-code-input')) {
    document.getElementById('subject-code-input').value = subject.code || '';
  }
  selectColor(subject.color || PRESET_COLORS[0]);
  selectIcon(getSubjectSymbol(subject));

  document.getElementById('subject-form-title').innerHTML = `
    <span class="material-symbols-rounded" style="color:var(--primary);">edit</span>
    Edit Subject
  `;
  document.getElementById('subject-submit-btn').textContent = 'Save Changes';
  document.getElementById('subject-cancel-btn').style.display = 'inline-flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditSubject() {
  state.editingSubjectId = null;
  document.getElementById('subject-name-input').value = '';
  if (document.getElementById('subject-code-input')) {
    document.getElementById('subject-code-input').value = '';
  }
  document.getElementById('subject-form-title').innerHTML = `
    <span class="material-symbols-rounded" style="color:var(--primary);">library_add</span>
    Add New Subject
  `;
  document.getElementById('subject-submit-btn').innerHTML = `${PLUS_ICON} Add Subject`;
  document.getElementById('subject-cancel-btn').style.display = 'none';
}

function deleteSubject(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const confirmMsg = `Are you sure you want to delete "${subject.name}" and all its contents and tasks?`;
  if (!confirm(confirmMsg)) return;

  state.subjects = state.subjects.filter(s => s.id !== subjectId);
  state.expandedSubjectIds.delete(subjectId);
  saveToStorage();
  renderApp();
  showToast('Subject removed.');
}

// --- Content CRUD ---
function openAddContentModal(subjectId, event) {
  if (event) event.stopPropagation();

  const subjectSelect = document.getElementById('content-modal-subject-select');
  if (subjectSelect) {
    subjectSelect.innerHTML = state.subjects.map(s => `
      <option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>
        ${escapeHtml(s.name)}
      </option>
    `).join('');
  }

  state.editingContentData = null;
  document.getElementById('content-modal-title').textContent = 'Add Content';
  document.getElementById('content-title-input').value = '';
  document.getElementById('content-date-input').value = '';
  document.getElementById('content-notes-input').value = '';

  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.add('is-open');
}

function openEditContentModal(subjectId, contentId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const subjectSelect = document.getElementById('content-modal-subject-select');
  if (subjectSelect) {
    subjectSelect.innerHTML = state.subjects.map(s => `
      <option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>
        ${escapeHtml(s.name)}
      </option>
    `).join('');
  }

  state.editingContentData = { subjectId, contentId };
  document.getElementById('content-modal-title').textContent = 'Edit Content';
  document.getElementById('content-title-input').value = content.title;
  document.getElementById('content-date-input').value = content.examDate || '';
  document.getElementById('content-notes-input').value = content.notes || '';

  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.add('is-open');
}

function closeContentModal() {
  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.remove('is-open');
  state.editingContentData = null;
}

function handleSaveContentModal(event) {
  event.preventDefault();
  const subjectId = document.getElementById('content-modal-subject-select').value;
  const title = document.getElementById('content-title-input').value.trim();
  const examDate = document.getElementById('content-date-input').value; // YYYY-MM-DD
  const notes = document.getElementById('content-notes-input').value.trim();

  if (!title) {
    alert('Please enter a content title.');
    return;
  }

  if (state.editingContentData) {
    // Edit existing
    const { subjectId: origSubjectId, contentId } = state.editingContentData;
    const origSubject = state.subjects.find(s => s.id === origSubjectId);
    if (origSubject) {
      const content = origSubject.contents.find(c => c.id === contentId);
      if (content) {
        content.title = title;
        content.examDate = examDate;
        content.notes = notes;

        // If subject changed
        if (origSubjectId !== subjectId) {
          origSubject.contents = origSubject.contents.filter(c => c.id !== contentId);
          const targetSubject = state.subjects.find(s => s.id === subjectId);
          if (targetSubject) {
            targetSubject.contents = targetSubject.contents || [];
            targetSubject.contents.push(content);
          }
        }
      }
    }
    showToast(`Content "${title}" updated!`);
  } else {
    // Create new content
    const targetSubject = state.subjects.find(s => s.id === subjectId);
    if (!targetSubject) {
      alert('Subject not found.');
      return;
    }

    const newContent = {
      id: 'cnt-' + Date.now(),
      title,
      examDate,
      notes,
      todos: [],
      completed: false
    };

    targetSubject.contents = targetSubject.contents || [];
    targetSubject.contents.push(newContent);
    // Expand subject and content so user can immediately see and add todos
    state.expandedSubjectIds.add(subjectId);
    state.expandedContentIds.add(newContent.id);
    showToast(`Content "${title}" added!`);
  }

  closeContentModal();
  saveToStorage(true);
  renderApp();
}

function deleteContent(subjectId, contentId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  if (!confirm(`Are you sure you want to delete "${content.title}" and its tasks?`)) return;

  subject.contents = subject.contents.filter(c => c.id !== contentId);
  state.expandedContentIds.delete(contentId);

  saveToStorage(true);
  renderApp();
  showToast('Content removed.');
}

// --- Whole Content Completion Functions ---
function toggleContentCompleted(subjectId, contentId, markCompleted, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const currentCompleted = isContentCompleted(content);
  const targetCompleted = typeof markCompleted === 'boolean' ? markCompleted : !currentCompleted;

  content.completed = targetCompleted;

  // If content has sub-tasks, update all of them
  if (content.todos && content.todos.length > 0) {
    content.todos.forEach(t => {
      t.completed = targetCompleted;
    });
  }

  if (targetCompleted) {
    fireCelebration();
    showToast(`"${content.title}" marked as completed!`);
  } else {
    showToast(`"${content.title}" marked as pending.`);
  }

  saveToStorage(true);
  renderApp();
}

function toggleAllSubjectContents(subjectId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const contents = subject.contents || [];
  if (contents.length === 0) return;

  const allDone = isSubjectAllDone(subject);
  const targetCompleted = !allDone;

  contents.forEach(content => {
    content.completed = targetCompleted;
    if (content.todos && content.todos.length > 0) {
      content.todos.forEach(t => {
        t.completed = targetCompleted;
      });
    }
  });

  if (targetCompleted) {
    fireCelebration();
    showToast(`All contents in "${subject.name}" marked as completed!`);
  } else {
    showToast(`All contents in "${subject.name}" reset to pending.`);
  }

  saveToStorage(true);
  renderApp();
}

// --- To-Do Tasks ---
function handleInlineAddTodo(subjectId, contentId, event) {
  event.preventDefault();
  const input = document.getElementById(`input-todo-${contentId}`);
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.todos = content.todos || [];
  content.todos.push({
    id: 'td-' + Date.now(),
    title: text,
    completed: false
  });

  // Adding a new incomplete task means the content as a whole is incomplete
  content.completed = false;

  saveToStorage(true);
  renderApp();

  // Focus re-applied for fast sequential entry
  setTimeout(() => {
    const nextInput = document.getElementById(`input-todo-${contentId}`);
    if (nextInput) nextInput.focus();
  }, 40);
}

function toggleTodoStatus(subjectId, contentId, todoId, completed) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const todo = (content.todos || []).find(t => t.id === todoId);
  if (!todo) return;

  todo.completed = completed;

  // Sync content completion status with todos
  const allCompleted = content.todos.length > 0 && content.todos.every(t => t.completed);
  content.completed = allCompleted;

  // Check if content is 100% completed
  const progress = getContentProgress(content);
  if (completed && progress.percent === 100 && progress.total > 0) {
    fireCelebration();
    showToast(`Completed all tasks for "${content.title}"!`);
  }

  saveToStorage(true);
  renderApp();
}

function deleteTodo(subjectId, contentId, todoId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.todos = (content.todos || []).filter(t => t.id !== todoId);

  // Sync content completion status with remaining todos
  if (content.todos.length > 0) {
    content.completed = content.todos.every(t => t.completed);
  }

  saveToStorage(true);
  renderApp();
}

// --- Inline Editing & Autosave Handlers ---
function handleTodoTitleBlur(subjectId, contentId, todoId, el) {
  const newTitle = el.textContent.trim();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(t => t.id === todoId);
  if (!todo) return;

  if (newTitle && newTitle !== todo.title) {
    todo.title = newTitle;
    saveToStorage(true);
  } else if (!newTitle) {
    el.textContent = todo.title;
  }
}

function handleTodoTitleKeydown(event, el) {
  if (event.key === 'Enter') {
    event.preventDefault();
    el.blur();
  }
}

function handleInlineNotesInput(subjectId, contentId, value) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.notes = value;
  const hint = document.getElementById(`hint-notes-${contentId}`);
  if (hint) hint.textContent = 'saving...';

  saveToStorage(false); // Debounced continuous autosave
}

function handleInlineNotesBlur(subjectId, contentId, value) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.notes = value;
  const hint = document.getElementById(`hint-notes-${contentId}`);
  if (hint) hint.textContent = 'autosaved';

  saveToStorage(true); // Immediate flush to host
}

function handleInlineDateChange(subjectId, contentId, newDate) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.examDate = newDate;
  saveToStorage(true);
  renderApp();
  showToast(`Exam deadline updated to ${formatDate(newDate) || 'none'} (autosaved)`);
}

// --- Search & Filters ---
function handleSearch(event) {
  state.searchQuery = event.target.value;
  renderStudiesView();
}

function clearSearch() {
  state.searchQuery = '';
  const input = document.getElementById('search-input');
  if (input) input.value = '';
  renderStudiesView();
}

// --- Export & Import ---
function exportData() {
  const jsonStr = JSON.stringify(state.subjects, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gorit_backup_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup exported successfully!');
}

function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        state.subjects = data;
        state.expandedSubjectIds.clear();
        state.expandedContentIds.clear();
        saveToStorage(true);
        renderApp();
        showToast('Data restored and autosaved to device!');
      } else {
        alert('Invalid file format.');
      }
    } catch (err) {
      alert('Error reading JSON file: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// --- Master Render Function ---
function renderApp() {
  renderStats();
  if (state.activeTab === 'studies') {
    renderStudiesView();
  } else if (state.activeTab === 'semester') {
    renderSemesterView();
  }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  renderColorSwatches();
  renderIconPalette();
  loadFromStorage();
  renderApp();
});
