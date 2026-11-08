// SPDX-License-Identifier: GPL-2.0-only
/**
 * Gorit - Course Content, Exams & Task Tracker
 * Design System: Material You Expressive (M3)
 * Internationalization: Strictly pt-BR and en-US
 */

import { t, getLanguage, setLanguage, applyDOMTranslations } from './i18n.js';
import {
  auth,
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  isUserPro,
  fetchUserProStatus,
  saveGoritToCloud,
  loadGoritFromCloud,
  listenGoritCloud,
  shareSubjectToCloud,
  loadSharedSubjectFromCloud
} from './firebase-client.js';

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

// User-selected Subject Emojis (Explicit exception for subject icons)
const PRESET_EMOJIS = [
  '📚', '🧠', '🩺', '🫀', '🔬', '🧬', '💊', '💉',
  '🧪', '📝', '💻', '🎨', '⚖️', '🌍', '📐', '📊',
  '⚡', '🎯', '💡', '🏅', '📌', '🎓', '🦴', '🏥'
];

function renderSubjectIcon(subject) {
  const icon = (subject && (subject.icon || subject.emoji)) || '📚';
  // If it's a legacy Material Symbol name
  if (/^[a-z0-9_]+$/.test(icon)) {
    return `<span class="material-symbols-rounded">${icon}</span>`;
  }
  return `<span class="subject-emoji-icon">${icon}</span>`;
}

// Fixed General Tasks Subject ID
const GENERAL_TASKS_ID = 'general-tasks';

function ensureGeneralTasksSubject() {
  let generalSubject = state.subjects.find(s => s.id === GENERAL_TASKS_ID || s.isGeneralTasks);
  if (!generalSubject) {
    generalSubject = {
      id: GENERAL_TASKS_ID,
      name: t('general_tasks_title') || 'General Tasks',
      code: '',
      color: '#3b82f7',
      icon: '📌',
      isPinned: true,
      isGeneralTasks: true,
      contents: [
        {
          id: 'general-content-default',
          title: t('general_tasks_default_content') || 'Quick & Daily To-Dos',
          examDate: null,
          isCompleted: false,
          notes: '',
          todos: []
        }
      ]
    };
    state.subjects.unshift(generalSubject);
  } else {
    generalSubject.id = GENERAL_TASKS_ID;
    generalSubject.isPinned = true;
    generalSubject.isGeneralTasks = true;
    if (!generalSubject.icon) generalSubject.icon = '📌';
  }
  return generalSubject;
}

// --- Application State ---
const state = {
  subjects: [],
  activeTab: 'studies', // 'studies' | 'semester'
  expandedSubjectIds: new Set([GENERAL_TASKS_ID]),
  expandedContentIds: new Set(['general-content-default']),
  searchQuery: '',
  selectedColor: PRESET_COLORS[0],
  selectedIcon: PRESET_EMOJIS[0],
  editingSubjectId: null,
  editingContentData: null,
  currentUser: null,
  isPro: false,
  lastCloudSync: null,
  cloudUnsubscribe: null,
  isSyncingCloud: false
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
  const lang = getLanguage();
  return d.toLocaleDateString(lang, { month: 'short', day: 'numeric', year: 'numeric' });
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
      text: passed === 1 ? t('passed_yesterday') : t('days_ago', { days: passed }),
      days: diffDays
    };
  } else if (diffDays === 0) {
    return {
      type: 'urgent',
      icon: 'priority_high',
      badgeClass: 'exam-urgent',
      text: t('exam_today'),
      days: 0
    };
  } else if (diffDays === 1) {
    return {
      type: 'urgent',
      icon: 'warning',
      badgeClass: 'exam-urgent',
      text: t('exam_tomorrow'),
      days: 1
    };
  } else if (diffDays <= 3) {
    return {
      type: 'urgent',
      icon: 'alarm',
      badgeClass: 'exam-urgent',
      text: `${t('exam_in_days', { days: diffDays })} (${formatDate(dateStr)})`,
      days: diffDays
    };
  } else if (diffDays <= 7) {
    return {
      type: 'soon',
      icon: 'event',
      badgeClass: 'exam-soon',
      text: `${t('exam_in_days', { days: diffDays })} (${formatDate(dateStr)})`,
      days: diffDays
    };
  } else {
    return {
      type: 'future',
      icon: 'event',
      badgeClass: 'exam-future',
      text: `${t('exam_in_days', { days: diffDays })} (${formatDate(dateStr)})`,
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

// --- Sorting Subjects Chronologically (Pinned items always at top) ---
function sortSubjectsChronologically(subjects) {
  const pinned = [];
  const unpinned = [];

  subjects.forEach(s => {
    if (s.isPinned || s.id === GENERAL_TASKS_ID || s.isGeneralTasks) {
      pinned.push(s);
    } else {
      unpinned.push(s);
    }
  });

  unpinned.sort((a, b) => {
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

  return [...pinned, ...unpinned];
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

// Hopeful model: assume success silently; only notify when an operation fails
function updateAutosaveBadge(status) {
  if (status === 'error') {
    showToast(t('autosave_error'), 'danger');
  }
}

async function syncToServer() {
  if (isSyncingToServer) {
    hasPendingServerSync = true;
    return;
  }
  isSyncingToServer = true;

  try {
    const isLocalServer = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
    if (isLocalServer) {
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
    }

    // If user is PRO, also push to Cloud Firestore silently
    if (state.currentUser && state.isPro) {
      saveGoritToCloud(state.subjects).then(cloudRes => {
        if (cloudRes && cloudRes.success) {
          state.lastCloudSync = cloudRes.timestamp;
        }
      }).catch(err => {
        console.warn('[Gorit Cloud] Sync warning:', err);
      });
    }
  } catch (err) {
    // Graceful offline fallback - silently keep browser storage safe
    console.warn('Autosave to server fallback to local browser storage:', err.message);

    // Still attempt Cloud sync for PRO users even if local Python server is unreachable
    if (state.currentUser && state.isPro) {
      saveGoritToCloud(state.subjects).then(cloudRes => {
        if (cloudRes && cloudRes.success) {
          state.lastCloudSync = cloudRes.timestamp;
        }
      }).catch(e => {});
    }
  } finally {
    isSyncingToServer = false;
    if (hasPendingServerSync) {
      hasPendingServerSync = false;
      syncToServer();
    }
  }
}

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
    ensureGeneralTasksSubject();
    renderApp();
  } else {
    ensureGeneralTasksSubject();
    renderApp();
  }

  // Fetch persisted data from the server hosting device (only when running local server)
  const isLocalServer = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  if (!isLocalServer) {
    return;
  }

  try {
    const res = await fetch('/api/data');
    if (res.ok) {
      const serverData = await res.json();
      const subjects = Array.isArray(serverData) ? serverData : (serverData.subjects || []);

      if (subjects && subjects.length > 0) {
        state.subjects = subjects;
        ensureGeneralTasksSubject();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
        renderApp();
        updateAutosaveBadge('saved');
      } else {
        state.subjects = [];
        ensureGeneralTasksSubject();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
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

  const isPt = getLanguage() === 'pt-BR';

  state.subjects = [
    {
      id: 'sub-anat',
      name: isPt ? 'Anatomia Humana & Embriologia' : 'Human Anatomy & Embryology',
      icon: '🫀',
      color: '#ef4444',
      code: 'ANAT101',
      contents: [
        {
          id: 'c-anat-1',
          title: isPt ? 'Sistemas Cardiovascular & Respiratório' : 'Cardiovascular & Respiratory Systems',
          examDate: getRelDate(3),
          notes: isPt ? 'Vasos coronários, câmaras cardíacas e segmentos broncopulmonares.' : 'Coronary vessels, heart chambers, and lung bronchopulmonary segments.',
          todos: [
            { id: 't1', title: isPt ? 'Revisar circulação coronariana e valvas cardíacas' : 'Review coronary circulation and cardiac valves', completed: true },
            { id: 't2', title: isPt ? 'Dissecação da cavidade torácica e trajeto venoso' : 'Dissect thoracic cavity and trace pulmonary veins', completed: true },
            { id: 't3', title: isPt ? 'Estudar árvore brônquica e inervação' : 'Study bronchial tree and innervation', completed: false },
            { id: 't4', title: isPt ? 'Revisar flashcards do atlas anatômico 3D' : 'Review 3D anatomy atlas flashcards', completed: false }
          ]
        },
        {
          id: 'c-anat-2',
          title: isPt ? 'Nervos Cranianos & Anatomia de Cabeça/Pescoço' : 'Cranial Nerves & Head/Neck Anatomy',
          examDate: getRelDate(25),
          notes: isPt ? 'Forames da base do crânio, componentes funcionais e lesões.' : 'Foramina, functional components, and lesion localizations.',
          todos: [
            { id: 't5', title: isPt ? 'Memorizar forames de saída dos pares cranianos I-XII' : 'Memorize cranial exit foramina for CN I-XII', completed: false },
            { id: 't6', title: isPt ? 'Mapear gânglios parassimpáticos cefálicos' : 'Map parasympathetic ganglia of the head', completed: false }
          ]
        }
      ]
    },
    {
      id: 'sub-phys',
      name: isPt ? 'Fisiologia Médica' : 'Medical Physiology',
      icon: '🧠',
      color: '#3b82f7',
      code: 'PHYS101',
      contents: [
        {
          id: 'c-phys-1',
          title: isPt ? 'Fisiologia Renal & Equilíbrio Ácido-Base' : 'Renal Physiology & Acid-Base Balance',
          examDate: getRelDate(7),
          notes: isPt ? 'Taxa de filtração glomerular, mecanismo contracorrente e Davenport.' : 'Glomerular filtration rate, countercurrent multiplication, Davenport diagram.',
          todos: [
            { id: 't7', title: isPt ? 'Calcular fórmulas de TFG e clearance renal' : 'Calculate GFR and clearance formulas', completed: true },
            { id: 't8', title: isPt ? 'Resolver questões de gasometria arterial' : 'Solve arterial blood gas practice problems', completed: false },
            { id: 't9', title: isPt ? 'Revisar eixo renina-angiotensina-aldosterona' : 'Review renin-angiotensin-aldosterone feedback', completed: false }
          ]
        }
      ]
    },
    {
      id: 'sub-pharm',
      name: isPt ? 'Farmacologia Médica' : 'Medical Pharmacology',
      icon: '💊',
      color: '#10b981',
      code: 'PHARM201',
      contents: [
        {
          id: 'c-pharm-1',
          title: isPt ? 'Drogas Autonômicas & Cardiovasculares' : 'Autonomic & Cardiovascular Drugs',
          examDate: getRelDate(14),
          notes: isPt ? 'Beta-bloqueadores, IECA e bloqueadores de canal de cálcio.' : 'Beta-blockers, ACE inhibitors, calcium channel blockers.',
          todos: [
            { id: 't11', title: isPt ? 'Tabela comparativa de receptores adrenérgicos' : 'Chart adrenergic receptors (alpha-1, alpha-2, beta-1, beta-2)', completed: true },
            { id: 't12', title: isPt ? 'Comparar efeitos colaterais de antiarrítmicos' : 'Compare side effect profiles of antiarrhythmics', completed: false }
          ]
        }
      ]
    }
  ];

  ensureGeneralTasksSubject();
  state.expandedSubjectIds.clear();
  state.expandedSubjectIds.add(GENERAL_TASKS_ID);
  state.expandedContentIds.clear();

  saveToStorage();
  renderApp();
  if (notify) showToast(t('toast_sample_loaded'));
}

// --- Toast Notifications (Hopeful Model: Quiet by default, notifies on failure) ---
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  else if (type === 'danger' || type === 'error') icon = 'error';
  else if (type === 'warning') icon = 'warning';

  toast.innerHTML = `<span class="material-symbols-rounded">${icon}</span><span>${escapeHtml(message)}</span>`;
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
  if (contentsEl) {
    contentsEl.textContent = stats.totalContents === 1 
      ? t('stat_content_count_singular') 
      : t('stat_contents_count', { count: stats.totalContents });
  }
  if (progressEl) {
    const todoRatio = stats.totalTodos > 0 
      ? `(${t('tasks_ratio', { completed: stats.completedTodos, total: stats.totalTodos })})` 
      : '(0)';
    progressEl.innerHTML = `${stats.percent}% <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">${todoRatio}</span>`;
  }
  if (nextExamEl) {
    if (stats.nextExam) {
      let icon = 'event';
      let daysText = t('stat_in_days', { days: stats.nextExam.days });
      if (stats.nextExam.days === 0) {
        icon = 'priority_high';
        daysText = t('stat_today');
      } else if (stats.nextExam.days === 1) {
        icon = 'warning';
        daysText = t('stat_tomorrow');
      }
      nextExamEl.innerHTML = `<span class="material-symbols-rounded icon-sm" style="color:var(--primary); vertical-align:middle; margin-right:3px;">${icon}</span><strong>${daysText}</strong> <span class="stat-hint">(${escapeHtml(stats.nextExam.subjectName)})</span>`;
    } else {
      nextExamEl.innerHTML = `<span style="color:var(--text-muted); font-size: 0.9rem;">${t('stat_none_scheduled')}</span>`;
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
          <h3 class="empty-state-title">${t('no_subjects_title')}</h3>
          <p class="empty-state-desc">${t('no_subjects_desc')}</p>
          <div style="display:flex; gap:0.5rem; justify-content:center; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="switchTab('semester')">
              ${PLUS_ICON} ${t('add_subject')}
            </button>
            <button class="btn btn-outline" onclick="loadSampleData(true)">
              <span class="material-symbols-rounded icon-sm">school</span>
              ${t('load_sample_courses')}
            </button>
          </div>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-rounded empty-state-icon">search_off</span>
          <h3 class="empty-state-title">${t('no_search_results_title')}</h3>
          <p class="empty-state-desc">${t('no_search_results_desc', { query: escapeHtml(state.searchQuery) })}</p>
          <button class="btn btn-secondary btn-sm" onclick="clearSearch()">${t('clear_search')}</button>
        </div>
      `;
    }
    return;
  }

  let html = '';
  const firstUpcomingExamSubject = filteredSubjects.find(s => !s.isPinned && s.id !== GENERAL_TASKS_ID && getSubjectNextExam(s).nearestUpcoming);

  filteredSubjects.forEach((subject, subIndex) => {
    const isPinned = subject.isPinned || subject.id === GENERAL_TASKS_ID;
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
        <span class="exam-badge exam-past" title="${t('no_upcoming_exams')}">
          <span class="material-symbols-rounded">history</span>
          ${t('no_upcoming_exams')}
        </span>
      `;
    } else {
      nextExamBadgeHtml = `
        <span class="exam-badge exam-past">
          <span class="material-symbols-rounded">event_busy</span>
          ${t('no_exams_scheduled')}
        </span>
      `;
    }

    const color = subject.color || '#3b82f7';
    let progressText = t('no_contents_yet');
    if (subProgress.contentsCount > 0) {
      if (subProgress.hasAnyTodos) {
        progressText = `${subProgress.percent}% (${t('tasks_ratio', { completed: subProgress.completed, total: subProgress.total })})`;
      } else {
        progressText = `${subProgress.percent}% (${t('completed_ratio', { completed: subProgress.completed, total: subProgress.total })})`;
      }
    }

    let subjectCompletedBadge = '';
    if (subProgress.percent === 100 && subProgress.total > 0) {
      subjectCompletedBadge = `
        <span class="exam-badge exam-completed" title="All contents completed!">
          <span class="material-symbols-rounded">check_circle</span>
          ${t('completed_badge')}
        </span>
      `;
    }

    // Build subject card with M3 Expressive animated drawer
    html += `
      <div class="subject-card ${isSubjectExpanded ? 'is-expanded' : ''} ${subject.isPinned || subject.id === GENERAL_TASKS_ID ? 'is-pinned' : ''}" 
           id="subject-card-${subject.id}"
           style="--subject-color: ${color}">
        
        <!-- Header (Click to toggle expansion) -->
        <div class="subject-header" onclick="toggleSubject('${subject.id}', event)">
          <div class="subject-icon-box">
            ${renderSubjectIcon(subject)}
          </div>

          <div class="subject-info">
            <div class="subject-title-row">
              <div class="subject-name">
                ${(subject.isPinned || subject.id === GENERAL_TASKS_ID) ? `<span class="pinned-badge"><span class="material-symbols-rounded">push_pin</span> ${t('pinned_badge')}</span>` : ''}
                ${!(subject.isPinned || subject.id === GENERAL_TASKS_ID) && firstUpcomingExamSubject && firstUpcomingExamSubject.id === subject.id ? `<span class="first-in-line-badge" title="${t('next_upcoming_exam_tooltip')}"><span class="material-symbols-rounded">grade</span> ${t('first_in_line')}</span>` : ''}
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

          <div style="display:flex; align-items:center; gap:0.4rem;">
            ${!isPinned ? `
              <button class="btn-icon btn-sm subject-share-btn" onclick="handleShareSubject('${subject.id}', event)" title="${t('share_subject_btn')}">
                <span class="material-symbols-rounded icon-sm">share</span>
              </button>
            ` : ''}
            <div class="subject-chevron">
              <span class="material-symbols-rounded">expand_more</span>
            </div>
          </div>
        </div>

        <!-- Subject Drawer (Expanded Content) -->
        <div class="subject-contents-drawer-wrapper">
          <div class="subject-contents-drawer">
            <div class="contents-header-bar">
              <div class="contents-count-text">
                <span class="material-symbols-rounded">folder</span>
                ${t('contents_header', { count: (subject.contents || []).length })}
              </div>
              <div class="contents-header-actions">
                ${!isPinned ? `
                  <button class="btn btn-outline btn-sm" onclick="handleShareSubject('${subject.id}', event)" title="${t('share_subject_btn')}">
                    <span class="material-symbols-rounded icon-sm">share</span>
                    <span>${t('share_subject_btn')}</span>
                  </button>
                ` : ''}
                ${(subject.contents || []).length > 0 ? `
                  <button class="btn btn-outline btn-sm" onclick="toggleAllSubjectContents('${subject.id}', event)" title="${t('toggle_all_tooltip')}">
                    <span class="material-symbols-rounded icon-sm">${isSubjectAllDone(subject) ? 'restart_alt' : 'done_all'}</span>
                    ${isSubjectAllDone(subject) ? t('reset_all') : t('complete_all')}
                  </button>
                ` : ''}
                <button class="btn btn-primary btn-sm" onclick="openAddContentModal('${subject.id}', event)">
                  ${PLUS_ICON} ${t('add_content')}
                </button>
              </div>
            </div>

            <!-- List of Contents -->
            <div class="contents-list-wrap">
              ${renderContentsList(subject)}
            </div>
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

  updateHeaderToggleAllBtn();
}

// --- Render: Contents inside a Subject ---
function renderContentsList(subject) {
  const contents = subject.contents || [];
  if (contents.length === 0) {
    return `
      <div style="text-align: center; padding: 1.5rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 0.875rem; color: var(--text-muted); margin-bottom: 0.6rem;">${t('no_contents_in_subject')}</p>
        <button class="btn btn-secondary btn-sm" onclick="openAddContentModal('${subject.id}', event)">
          ${PLUS_ICON} ${t('add_first_content')}
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
        <span class="exam-badge exam-past" title="${t('click_calendar_set_date')}">
          <span class="material-symbols-rounded">event_available</span>
          ${t('no_date_set')}
        </span>
      `;
    }

    const datePickerHtml = `
      <div class="content-date-wrapper" onclick="event.stopPropagation()">
        ${examBadgeHtml}
        <label class="date-picker-trigger" title="${t('change_exam_deadline')}">
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
        ? `${progress.percent}% (${t('tasks_ratio', { completed: progress.completed, total: progress.total })}) • ${t('completed_badge')}`
        : `${progress.percent}% (${t('tasks_ratio', { completed: progress.completed, total: progress.total })})`;
    } else {
      contentProgressText = isCompleted
        ? `100% • ${t('completed_badge')}`
        : `0% • ${t('mark_as_pending')}`;
    }

    return `
      <div class="content-item-card ${isExpanded ? 'is-expanded' : ''} ${isCompleted ? 'is-completed' : ''}" id="content-card-${content.id}">
        <!-- Content Header (Click to expand tasks) -->
        <div class="content-item-header" onclick="toggleContent('${content.id}', event)">
          <div class="content-header-main">
            <!-- Whole Content Completion Checkbox -->
            <div class="content-check-wrap" onclick="event.stopPropagation()" title="${isCompleted ? t('mark_as_pending') : t('mark_as_completed')}">
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
                  <span class="content-title-text ${isCompleted ? 'completed' : ''}">${escapeHtml(content.title)}</span>
                  ${isCompleted ? `<span class="content-completed-badge"><span class="material-symbols-rounded">check</span> ${t('completed_badge')}</span>` : ''}
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
            <button class="btn-icon btn-sm" title="${t('edit_content')}" onclick="openEditContentModal('${subject.id}', '${content.id}', event)" style="width:30px; height:30px;">
              <span class="material-symbols-rounded icon-sm">edit</span>
            </button>
            <button class="btn-icon btn-sm" title="${t('delete_content')}" onclick="deleteContent('${subject.id}', '${content.id}', event)" style="width:30px; height:30px;">
              <span class="material-symbols-rounded icon-sm">delete</span>
            </button>
            <div class="content-chevron">
              <span class="material-symbols-rounded">expand_more</span>
            </div>
          </div>
        </div>

        <!-- Content Tasks Drawer (To-Dos Animated with M3 Curves) -->
        <div class="content-tasks-drawer-wrapper">
          <div class="content-tasks-drawer">
            <!-- Content Drawer Completion & Actions Bar -->
            <div class="content-drawer-header-actions">
              <button 
                type="button" 
                class="btn ${isCompleted ? 'btn-outline' : 'btn-success-soft'} btn-sm" 
                onclick="toggleContentCompleted('${subject.id}', '${content.id}', ${!isCompleted}, event)"
                title="${isCompleted ? t('mark_as_pending') : t('mark_as_completed')}">
                <span class="material-symbols-rounded icon-sm">${isCompleted ? 'restart_alt' : 'check'}</span>
                ${isCompleted ? t('mark_as_pending') : t('mark_as_completed')}
              </button>
              
              <div class="content-drawer-status-summary">
                <span class="material-symbols-rounded icon-sm">checklist</span>
                ${hasTodos 
                  ? `<span>${t('tasks_progress_summary', { completed: completedTodosCount, total: totalTodosCount, percent: progress.percent })}</span>` 
                  : `<span>${isCompleted ? t('topic_completed_summary') : t('topic_pending_summary')}</span>`
                }
              </div>
            </div>

            <div class="content-notes-box">
              <div class="content-notes-header">
                <div class="content-notes-header-left">
                  <span class="material-symbols-rounded">lightbulb</span>
                  <span>${t('notes_and_tips')}</span>
                </div>
                <span class="autosave-micro-hint" id="hint-notes-${content.id}">autosaved</span>
              </div>
              <textarea 
                class="content-notes-textarea" 
                id="textarea-notes-${content.id}"
                placeholder="${t('notes_placeholder')}"
                rows="2"
                oninput="handleInlineNotesInput('${subject.id}', '${content.id}', this.value)"
                onblur="handleInlineNotesBlur('${subject.id}', '${content.id}', this.value)"
              >${escapeHtml(content.notes || '')}</textarea>
            </div>
            
            <div class="todo-list" id="todo-list-${content.id}">
              ${renderTodos(subject.id, content)}
            </div>

            <!-- Quick Inline Add Todo with optional priority & reminder controls -->
            <form class="add-todo-inline" onsubmit="handleInlineAddTodo('${subject.id}', '${content.id}', event)">
              <input 
                type="text" 
                class="add-todo-input" 
                id="input-todo-${content.id}"
                placeholder="${t('add_task_placeholder')}" 
                autocomplete="off"
              />
              <div class="add-todo-controls">
                <label class="todo-date-picker-label" title="${t('due_date_label')}">
                  <span class="material-symbols-rounded">alarm</span>
                  <input type="date" id="input-todo-date-${content.id}" class="todo-date-input" title="${t('due_date_label')}" />
                </label>
                <button 
                  type="button" 
                  class="todo-action-icon-btn todo-inline-daily-btn" 
                  id="input-todo-daily-${content.id}"
                  onclick="toggleInlineDailyReminderBtn('${content.id}')"
                  title="${t('daily_reminder_tooltip')}">
                  <span class="material-symbols-rounded">event_repeat</span>
                </button>
                <button type="submit" class="btn btn-primary btn-sm add-todo-submit-btn">
                  ${PLUS_ICON} <span>${t('add_task_btn')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// --- Prioritize / Sort Todos ---
function sortTodosByPriority(todos) {
  const todayStr = new Date().toISOString().slice(0, 10);
  return [...todos].sort((a, b) => {
    // 1. Incomplete items before completed items
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    // 2. Overdue or due today items first
    const aDueTodayOrPast = a.dueDate && a.dueDate <= todayStr;
    const bDueTodayOrPast = b.dueDate && b.dueDate <= todayStr;
    if (aDueTodayOrPast !== bDueTodayOrPast) return aDueTodayOrPast ? -1 : 1;

    // 3. Daily reminders next
    if (Boolean(a.dailyReminder) !== Boolean(b.dailyReminder)) {
      return a.dailyReminder ? -1 : 1;
    }

    // 4. Specific upcoming due dates (earliest first)
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate && !b.dueDate) return -1;
    if (!a.dueDate && b.dueDate) return 1;

    return 0;
  });
}

// --- Render: Todos inside a Content ---
function renderTodos(subjectId, content) {
  const todos = content.todos || [];
  if (todos.length === 0) {
    return `<div style="font-size:0.82rem; color:var(--text-muted); padding:0.4rem 0;">${t('no_tasks_placeholder')}</div>`;
  }

  const sortedTodos = sortTodosByPriority(todos);
  const todayStr = new Date().toISOString().slice(0, 10);

  return sortedTodos.map(todo => {
    let dueBadgeHtml = '';
    if (todo.dueDate) {
      let dueClass = '';
      let dueText = formatDate(todo.dueDate);
      let dueIcon = 'event';
      if (todo.dueDate === todayStr) {
        dueClass = 'due-today';
        dueText = t('due_today_badge');
        dueIcon = 'today';
      } else if (todo.dueDate < todayStr && !todo.completed) {
        dueClass = 'due-overdue';
        dueText = `${t('due_overdue_badge')} (${formatDate(todo.dueDate)})`;
        dueIcon = 'warning';
      }
      dueBadgeHtml = `<span class="todo-due-pill ${dueClass}"><span class="material-symbols-rounded">${dueIcon}</span> ${dueText}</span>`;
    }

    const dailyBadgeHtml = todo.dailyReminder 
      ? `<span class="todo-daily-pill" title="${t('daily_reminder_tooltip')}"><span class="material-symbols-rounded">event_repeat</span> ${t('daily_reminder_label')}</span>` 
      : '';

    return `
      <div class="todo-row ${todo.completed ? 'completed' : ''}">
        <input 
          type="checkbox" 
          class="todo-checkbox" 
          ${todo.completed ? 'checked' : ''} 
          onchange="toggleTodoStatus('${subjectId}', '${content.id}', '${todo.id}', this.checked)"
          aria-label="${escapeHtml(todo.title)}"
        />
        <span 
          class="todo-text" 
          contenteditable="true" 
          spellcheck="false"
          title="${t('click_to_edit_task')}"
          onblur="handleTodoTitleBlur('${subjectId}', '${content.id}', '${todo.id}', this)"
          onkeydown="handleTodoTitleKeydown(event, this)">${escapeHtml(todo.title)}</span>

        <div class="todo-actions-wrap">
          <!-- Daily reminder toggle -->
          <button 
            type="button" 
            class="todo-action-icon-btn ${todo.dailyReminder ? 'is-active' : ''}" 
            onclick="toggleTodoDailyReminder('${subjectId}', '${content.id}', '${todo.id}', event)" 
            title="${t('daily_reminder_tooltip')}">
            <span class="material-symbols-rounded">event_repeat</span>
          </button>

          <!-- Specific deadline date picker -->
          <label class="todo-date-picker-label" title="${t('due_date_label')}">
            <span class="material-symbols-rounded">alarm</span>
            <input 
              type="date" 
              class="todo-date-input" 
              value="${todo.dueDate || ''}" 
              onchange="handleTodoDueDateChange('${subjectId}', '${content.id}', '${todo.id}', this.value, event)" 
            />
          </label>

          <!-- Delete Task -->
          <button 
            class="todo-delete-btn" 
            title="${t('delete_task')}" 
            onclick="deleteTodo('${subjectId}', '${content.id}', '${todo.id}', event)">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        ${(dailyBadgeHtml || dueBadgeHtml) ? `
          <div class="todo-meta-badges">
            ${dailyBadgeHtml}
            ${dueBadgeHtml}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

// --- Render: Manage Semester Subjects View (Tab 2) ---
function renderSemesterView() {
  const container = document.getElementById('semester-subjects-list');
  if (!container) return;

  ensureGeneralTasksSubject();

  if (state.subjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded empty-state-icon">school</span>
        <h4 class="empty-state-title">${t('no_subjects_title')}</h4>
        <p class="empty-state-desc">${t('no_subjects_manage_desc')}</p>
      </div>
    `;
    return;
  }

  const sorted = sortSubjectsChronologically(state.subjects);
  let html = '';
  sorted.forEach(subject => {
    const progress = getSubjectProgress(subject);
    const examInfo = getSubjectNextExam(subject);

    let examDateText = t('no_date_set');
    if (examInfo.nearestUpcoming) {
      examDateText = `${t('exam_in_days', { days: examInfo.nearestUpcoming.days })} (${formatDate(examInfo.nearestUpcoming.dateStr)})`;
    }

    const isPinned = subject.isPinned || subject.id === GENERAL_TASKS_ID;

    html += `
      <div class="subject-manage-item ${isPinned ? 'is-pinned' : ''}" style="border-left: 6px solid ${subject.color || '#3b82f7'}">
        <div class="subject-manage-info">
          <div class="subject-icon-box" style="--subject-color: ${subject.color || '#3b82f7'}">
            ${renderSubjectIcon(subject)}
          </div>
          <div class="subject-manage-text">
            <div class="subject-manage-title-row">
              ${isPinned ? `<span class="pinned-badge"><span class="material-symbols-rounded">push_pin</span> ${t('pinned_badge')}</span>` : ''}
              <span class="subject-manage-name">${escapeHtml(subject.name)}</span>
              ${subject.code ? `<span class="subject-manage-code">(${escapeHtml(subject.code)})</span>` : ''}
            </div>
            <div class="subject-manage-meta">
              <span class="subject-meta-item">${t('stat_contents_count', { count: progress.contentsCount })}</span>
              <span class="meta-separator">•</span>
              <span class="subject-meta-item">${progress.percent}% (${progress.completed}/${progress.total} ${progress.hasAnyTodos ? 'tasks' : 'contents'})</span>
              <span class="meta-separator">•</span>
              <span class="subject-meta-item">${examDateText}</span>
            </div>
          </div>
        </div>

        <div class="subject-manage-actions">
          <button class="btn btn-secondary btn-sm" onclick="openAddContentModal('${subject.id}')" title="${t('content_btn')}">
            ${PLUS_ICON} <span>${t('content_btn')}</span>
          </button>
          <button class="btn btn-outline btn-sm" onclick="editSubject('${subject.id}')" title="${t('edit_btn')}">
            <span class="material-symbols-rounded icon-sm">edit</span>
            <span>${t('edit_btn')}</span>
          </button>
          ${!isPinned ? `
            <button class="btn btn-outline btn-sm" onclick="handleShareSubject('${subject.id}', event)" title="${t('share_subject_btn')}">
              <span class="material-symbols-rounded icon-sm">share</span>
              <span>${t('share_subject_btn')}</span>
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteSubject('${subject.id}')" title="${t('delete_btn')}">
              <span class="material-symbols-rounded icon-sm">delete</span>
              <span>${t('delete_btn')}</span>
            </button>
          ` : `
            <span class="pinned-badge" title="${t('general_tasks_cannot_delete')}"><span class="material-symbols-rounded">lock</span></span>
          `}
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

  container.innerHTML = PRESET_EMOJIS.map(emoji => `
    <button 
      type="button" 
      class="icon-opt-btn ${state.selectedIcon === emoji ? 'active' : ''}" 
      onclick="selectIcon('${emoji}')"
      title="Emoji ${emoji}">
      <span class="subject-emoji-icon">${emoji}</span>
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
  const customInput = document.getElementById('custom-emoji-input');
  if (customInput) {
    customInput.value = PRESET_EMOJIS.includes(iconName) ? '' : iconName;
  }
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

function selectCustomEmoji(val) {
  const emoji = (val || '').trim();
  if (!emoji) return;
  state.selectedIcon = emoji;
  const hiddenInput = document.getElementById('selected-icon-input');
  if (hiddenInput) hiddenInput.value = emoji;
  renderIconPalette();
  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.icon = emoji;
      subject.emoji = emoji;
      saveToStorage(true);
      renderSemesterView();
    }
  }
}

// --- Accordion Toggle Handlers (Material You Expressive Transitions) ---
function toggleSubject(subjectId, event) {
  if (event) {
    if (event.target.closest('button') || event.target.closest('input') || event.target.closest('a')) return;
  }

  const card = document.getElementById(`subject-card-${subjectId}`);
  if (state.expandedSubjectIds.has(subjectId)) {
    state.expandedSubjectIds.delete(subjectId);
    if (card) {
      card.classList.remove('is-expanded');
    } else {
      renderStudiesView();
    }
  } else {
    state.expandedSubjectIds.add(subjectId);
    if (card) {
      card.classList.add('is-expanded');
    } else {
      renderStudiesView();
    }
  }
  updateHeaderToggleAllBtn();
}

function toggleContent(contentId, event) {
  if (event) {
    if (event.target.closest('button') || event.target.closest('input') || event.target.closest('label') || event.target.closest('textarea')) return;
  }

  const card = document.getElementById(`content-card-${contentId}`);
  if (state.expandedContentIds.has(contentId)) {
    state.expandedContentIds.delete(contentId);
    if (card) {
      card.classList.remove('is-expanded');
    } else {
      renderStudiesView();
    }
  } else {
    state.expandedContentIds.add(contentId);
    if (card) {
      card.classList.add('is-expanded');
    } else {
      renderStudiesView();
    }
  }
  updateHeaderToggleAllBtn();
}

function updateHeaderToggleAllBtn() {
  const btn = document.getElementById('header-toggle-all-btn');
  const icon = document.getElementById('header-toggle-all-icon');
  const label = document.getElementById('header-toggle-all-label');
  if (!btn || !icon || !label) return;

  const hasExpanded = state.expandedSubjectIds.size > 0 || state.expandedContentIds.size > 0;
  if (hasExpanded) {
    icon.textContent = 'unfold_less';
    label.textContent = t('toggle_all_collapse');
  } else {
    icon.textContent = 'unfold_more';
    label.textContent = t('toggle_all_expand');
  }
}

function toggleExpandCollapseAll() {
  const hasExpanded = state.expandedSubjectIds.size > 0 || state.expandedContentIds.size > 0;
  if (hasExpanded) {
    collapseAll();
  } else {
    expandAll();
  }
  updateHeaderToggleAllBtn();
}

function expandAll() {
  state.subjects.forEach(s => {
    state.expandedSubjectIds.add(s.id);
    (s.contents || []).forEach(c => state.expandedContentIds.add(c.id));
  });
  document.querySelectorAll('.subject-card').forEach(card => card.classList.add('is-expanded'));
  document.querySelectorAll('.content-item-card').forEach(card => card.classList.add('is-expanded'));
  updateHeaderToggleAllBtn();
}

function collapseAll() {
  state.expandedSubjectIds.clear();
  state.expandedContentIds.clear();
  document.querySelectorAll('.subject-card').forEach(card => card.classList.remove('is-expanded'));
  document.querySelectorAll('.content-item-card').forEach(card => card.classList.remove('is-expanded'));
  updateHeaderToggleAllBtn();
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

// --- Language Management ---
function updateLanguageUI() {
  const currentLang = getLanguage();
  const labelEl = document.getElementById('current-lang-label');
  if (labelEl) {
    labelEl.textContent = currentLang === 'pt-BR' ? 'PT' : 'EN';
  }

  const pageTitle = document.getElementById('app-page-title');
  if (pageTitle) {
    pageTitle.textContent = `${t('app_name')} - ${t('app_tagline')}`;
  }

  const pageDesc = document.getElementById('app-page-desc');
  if (pageDesc) {
    pageDesc.setAttribute('content', t('app_description'));
  }

  applyDOMTranslations();
  renderAccountHeaderBtn();
  const accModal = document.getElementById('account-modal');
  if (accModal && accModal.classList.contains('active')) {
    renderAccountModal();
  }
}

function toggleLanguage() {
  const current = getLanguage();
  const next = current === 'pt-BR' ? 'en-US' : 'pt-BR';
  setLanguage(next);
  // Auto-translate default General Tasks name/content if unchanged
  const generalSubject = state.subjects.find(s => s.id === GENERAL_TASKS_ID || s.isGeneralTasks);
  if (generalSubject) {
    if (generalSubject.name === 'Tarefas Gerais' || generalSubject.name === 'General Tasks') {
      generalSubject.name = t('general_tasks_title');
    }
    const defContent = (generalSubject.contents || []).find(c => c.id === 'general-content-default');
    if (defContent && (defContent.title === 'Tarefas Rápidas & Diárias' || defContent.title === 'Quick & Daily To-Dos')) {
      defContent.title = t('general_tasks_default_content');
    }
  }
  updateLanguageUI();
  renderApp();
  showToast(next === 'pt-BR' ? 'Idioma alterado para Português (Brasil)' : 'Language switched to English (US)');
}

// --- Subject CRUD ---
function handleSaveSubject(event) {
  event.preventDefault();
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');

  const name = nameInput.value.trim();
  if (!name) {
    alert(t('alert_enter_subject_name'));
    return;
  }

  const icon = state.selectedIcon || '📚';
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
      showToast(t('toast_subject_updated', { name }));
    }
    state.editingSubjectId = null;
    document.getElementById('subject-form-title').innerHTML = `
      <span class="material-symbols-rounded" style="color:var(--primary);">library_add</span>
      <span>${t('add_new_subject')}</span>
    `;
    document.getElementById('subject-submit-btn').innerHTML = `${PLUS_ICON} ${t('add_subject')}`;
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
    showToast(t('toast_subject_added', { name }));
  }

  // Reset form
  nameInput.value = '';
  if (codeInput) codeInput.value = '';
  const customEmojiInput = document.getElementById('custom-emoji-input');
  if (customEmojiInput) customEmojiInput.value = '';
  selectIcon(PRESET_EMOJIS[0]);
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
  const icon = subject.icon || subject.emoji || '📚';
  selectIcon(icon);
  const customEmojiInput = document.getElementById('custom-emoji-input');
  if (customEmojiInput) {
    customEmojiInput.value = PRESET_EMOJIS.includes(icon) ? '' : icon;
  }

  document.getElementById('subject-form-title').innerHTML = `
    <span class="material-symbols-rounded" style="color:var(--primary);">edit</span>
    <span>${t('edit_subject')}</span>
  `;
  document.getElementById('subject-submit-btn').textContent = t('save_changes');
  document.getElementById('subject-cancel-btn').style.display = 'inline-flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cancelEditSubject() {
  state.editingSubjectId = null;
  document.getElementById('subject-name-input').value = '';
  if (document.getElementById('subject-code-input')) {
    document.getElementById('subject-code-input').value = '';
  }
  const customEmojiInput = document.getElementById('custom-emoji-input');
  if (customEmojiInput) customEmojiInput.value = '';
  selectIcon(PRESET_EMOJIS[0]);
  document.getElementById('subject-form-title').innerHTML = `
    <span class="material-symbols-rounded" style="color:var(--primary);">library_add</span>
    <span>${t('add_new_subject')}</span>
  `;
  document.getElementById('subject-submit-btn').innerHTML = `${PLUS_ICON} ${t('add_subject')}`;
  document.getElementById('subject-cancel-btn').style.display = 'none';
}

function deleteSubject(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  if (subject.isPinned || subject.id === GENERAL_TASKS_ID || subject.isGeneralTasks) {
    showToast(t('general_tasks_cannot_delete'), 'warning');
    return;
  }

  const confirmMsg = t('confirm_delete_subject', { name: subject.name });
  if (!confirm(confirmMsg)) return;

  state.subjects = state.subjects.filter(s => s.id !== subjectId);
  state.expandedSubjectIds.delete(subjectId);
  saveToStorage();
  renderApp();
  showToast(t('toast_subject_removed'));
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
  document.getElementById('content-modal-title').textContent = t('modal_add_content_title');
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
  document.getElementById('content-modal-title').textContent = t('modal_edit_content_title');
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
    alert(t('alert_enter_content_title'));
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
    showToast(t('toast_content_updated', { title }));
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
    showToast(t('toast_content_added', { title }));
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

  if (!confirm(t('confirm_delete_content', { title: content.title }))) return;

  subject.contents = subject.contents.filter(c => c.id !== contentId);
  state.expandedContentIds.delete(contentId);

  saveToStorage(true);
  renderApp();
  showToast(t('toast_content_removed'));
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
    showToast(t('toast_content_completed', { title: content.title }));
  } else {
    showToast(t('toast_content_pending', { title: content.title }));
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
    showToast(t('toast_all_contents_completed', { name: subject.name }));
  } else {
    showToast(t('toast_all_contents_reset', { name: subject.name }));
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

  const dateInput = document.getElementById(`input-todo-date-${contentId}`);
  const dailyBtn = document.getElementById(`input-todo-daily-${contentId}`);

  const dueDate = dateInput && dateInput.value ? dateInput.value : null;
  const dailyReminder = dailyBtn ? dailyBtn.classList.contains('is-active') : false;

  content.todos = content.todos || [];
  content.todos.push({
    id: 'td-' + Date.now(),
    title: text,
    completed: false,
    dueDate,
    dailyReminder
  });

  // Reset inputs
  input.value = '';
  if (dateInput) dateInput.value = '';
  if (dailyBtn) dailyBtn.classList.remove('is-active');

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

function toggleTodoDailyReminder(subjectId, contentId, todoId, event) {
  if (event) event.stopPropagation();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(t => t.id === todoId);
  if (!todo) return;

  todo.dailyReminder = !todo.dailyReminder;
  saveToStorage(true);
  renderApp();
}

function handleTodoDueDateChange(subjectId, contentId, todoId, newDate, event) {
  if (event) event.stopPropagation();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(t => t.id === todoId);
  if (!todo) return;

  todo.dueDate = newDate || null;
  saveToStorage(true);
  renderApp();
}

function toggleInlineDailyReminderBtn(contentId) {
  const btn = document.getElementById(`input-todo-daily-${contentId}`);
  if (btn) {
    btn.classList.toggle('is-active');
  }
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
    showToast(t('toast_tasks_100_percent', { title: content.title }));
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
  showToast(t('toast_backup_exported'));
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
        showToast(t('toast_data_restored'));
      } else {
        alert(t('alert_invalid_json'));
      }
    } catch (err) {
      alert(t('alert_error_reading_json', { error: err.message }));
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

// --- Expose Global Handlers for HTML Event Attributes ---
window.switchTab = switchTab;
window.exportData = exportData;
window.importData = importData;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.handleSaveSubject = handleSaveSubject;
window.editSubject = editSubject;
window.cancelEditSubject = cancelEditSubject;
window.deleteSubject = deleteSubject;
window.selectColor = selectColor;
window.selectIcon = selectIcon;
window.selectCustomEmoji = selectCustomEmoji;
window.openAddContentModal = openAddContentModal;
window.openEditContentModal = openEditContentModal;
window.closeContentModal = closeContentModal;
window.handleSaveContentModal = handleSaveContentModal;
window.deleteContent = deleteContent;
window.toggleSubject = toggleSubject;
window.toggleContent = toggleContent;
window.toggleContentCompleted = toggleContentCompleted;
window.toggleAllSubjectContents = toggleAllSubjectContents;
window.handleInlineDateChange = handleInlineDateChange;
window.handleInlineAddTodo = handleInlineAddTodo;
window.toggleTodoStatus = toggleTodoStatus;
window.deleteTodo = deleteTodo;
window.handleTodoTitleBlur = handleTodoTitleBlur;
window.handleTodoTitleKeydown = handleTodoTitleKeydown;
window.handleInlineNotesInput = handleInlineNotesInput;
window.handleInlineNotesBlur = handleInlineNotesBlur;
window.loadSampleData = loadSampleData;
window.toggleLanguage = toggleLanguage;
window.toggleExpandCollapseAll = toggleExpandCollapseAll;
window.toggleTodoDailyReminder = toggleTodoDailyReminder;
window.handleTodoDueDateChange = handleTodoDueDateChange;
window.toggleInlineDailyReminderBtn = toggleInlineDailyReminderBtn;

// --- User Account & Cloud Sync (Flashcards PRO Integration) ---

function renderAccountHeaderBtn() {
  const btn = document.getElementById('account-btn');
  const icon = document.getElementById('account-btn-icon');
  const label = document.getElementById('account-btn-label');
  const proPill = document.getElementById('account-pro-pill');
  if (!btn || !label) return;

  if (state.currentUser) {
    const firstName = (state.currentUser.displayName || state.currentUser.email || '').split(' ')[0] || 'Conta';
    label.textContent = firstName;

    if (state.currentUser.photoURL) {
      if (icon) {
        icon.outerHTML = `<img src="${state.currentUser.photoURL}" class="account-avatar-img" id="account-btn-icon" alt="${firstName}" />`;
      }
    } else {
      if (icon) {
        if (icon.tagName === 'IMG') {
          icon.outerHTML = `<span class="material-symbols-rounded icon-sm" id="account-btn-icon">account_circle</span>`;
        } else {
          icon.textContent = 'account_circle';
        }
      }
    }

    if (proPill) {
      proPill.style.display = state.isPro ? 'inline-flex' : 'none';
    }
  } else {
    if (icon) {
      if (icon.tagName === 'IMG') {
        icon.outerHTML = `<span class="material-symbols-rounded icon-sm" id="account-btn-icon">account_circle</span>`;
      } else {
        icon.textContent = 'account_circle';
      }
    }
    label.textContent = t('auth_sign_in');
    if (proPill) proPill.style.display = 'none';
  }
}

function renderAccountModal() {
  const body = document.getElementById('account-modal-body');
  if (!body) return;

  if (!state.currentUser) {
    body.innerHTML = `
      <div style="text-align: center; padding: 2rem 1rem; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <div style="width: 64px; height: 64px; border-radius: 50%; background: var(--primary-container); color: var(--primary); display: flex; align-items: center; justify-content: center;">
          <span class="material-symbols-rounded" style="font-size: 32px;">cloud_sync</span>
        </div>
        <div>
          <h4 style="font-weight: 700; font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">
            ${t('auth_sign_in')}
          </h4>
          <p style="font-size: 0.88rem; color: var(--text-muted); max-width: 360px; line-height: 1.5; margin: 0 auto;">
            Conecte sua conta Google para sincronizar seu progresso de estudos com a nuvem e ativar os benefícios do Flashcards PRO.
          </p>
        </div>
        <button class="btn btn-primary" onclick="handleGoogleSignIn()" style="margin-top: 0.5rem; padding: 0.65rem 1.4rem; gap: 0.5rem;">
          <span class="material-symbols-rounded">login</span>
          <span>${t('auth_sign_in')}</span>
        </button>
      </div>
    `;
    return;
  }

  const user = state.currentUser;
  const isPro = state.isPro;
  const photo = user.photoURL 
    ? `<img src="${user.photoURL}" class="account-user-avatar" alt="${user.displayName || 'Avatar'}" />`
    : `<div class="account-user-avatar-placeholder">${(user.displayName || user.email || 'U')[0].toUpperCase()}</div>`;

  body.innerHTML = `
    <!-- User Profile Card -->
    <div class="account-user-card">
      ${photo}
      <div class="account-user-details">
        <span class="account-user-name">${user.displayName || 'Estudante'}</span>
        <span class="account-user-email">${user.email || ''}</span>
      </div>
    </div>

    <!-- Plan Status Card -->
    <div class="account-plan-box ${isPro ? 'is-pro' : ''}">
      <div class="account-plan-header">
        <span class="account-plan-title">${t('account_status_label')}</span>
        ${isPro 
          ? `<span class="account-plan-badge-pro"><span class="material-symbols-rounded" style="font-size: 16px;">verified</span>${t('account_pro_badge')}</span>`
          : `<span class="account-plan-badge-free"><span class="material-symbols-rounded" style="font-size: 16px;">lock</span>${t('account_free_badge')}</span>`}
      </div>
      <p class="account-plan-desc">
        ${isPro ? t('account_pro_desc') : t('account_free_desc')}
      </p>
      ${!isPro ? `
        <a href="https://cparthur1.github.io/Flashcards/" target="_blank" class="btn btn-primary btn-sm" style="margin-top: 0.4rem; justify-content: center; gap: 0.4rem; text-decoration: none;">
          <span class="material-symbols-rounded icon-sm">star</span>
          <span>${t('account_upgrade_btn')}</span>
        </a>
      ` : ''}
    </div>

    <!-- Cloud Sync Section -->
    <div class="account-cloud-box">
      <div class="account-cloud-header">
        <div class="account-cloud-status">
          <span class="cloud-dot ${isPro ? (state.isSyncingCloud ? 'syncing' : 'active') : ''}"></span>
          <span>${isPro ? (state.isSyncingCloud ? t('cloud_sync_status_pending') : t('cloud_sync_status_synced')) : t('cloud_sync_status_offline')}</span>
        </div>
        ${isPro ? `
          <button class="btn btn-outline btn-sm" onclick="handleManualCloudSync()" style="gap: 0.35rem;" ${state.isSyncingCloud ? 'disabled' : ''}>
            <span class="material-symbols-rounded icon-sm">cloud_sync</span>
            <span>${t('cloud_sync_now_btn')}</span>
          </button>
        ` : ''}
      </div>
      <span class="account-cloud-time">
        ${state.lastCloudSync 
          ? t('cloud_last_synced').replace('{time}', new Date(state.lastCloudSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })) 
          : t('cloud_never_synced')}
      </span>
    </div>

    <!-- Sign Out Row -->
    <div class="account-actions-row">
      <button class="btn btn-outline btn-sm" onclick="handleGoogleSignOut()" style="gap: 0.4rem; color: var(--danger);">
        <span class="material-symbols-rounded icon-sm">logout</span>
        <span>${t('auth_sign_out')}</span>
      </button>
    </div>
  `;
}

function openAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) {
    renderAccountModal();
    modal.classList.add('is-open', 'active');
  }
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) modal.classList.remove('is-open', 'active');
}


async function handleGoogleSignIn() {
  try {
    const user = await signInWithGoogle();
    if (user) {
      await onUserAuthenticated(user);
      renderAccountModal();
      showToast(t('auth_signed_in_as').replace('{name}', user.displayName || user.email), 'success');
    }
  } catch (err) {
    console.error('Sign-in failed:', err);
    showToast('Falha no login com Google. Verifique sua conexão.', 'danger');
  }
}

async function handleGoogleSignOut() {
  try {
    if (state.cloudUnsubscribe) {
      state.cloudUnsubscribe();
      state.cloudUnsubscribe = null;
    }
    await signOutUser();
    state.currentUser = null;
    state.isPro = false;
    renderAccountHeaderBtn();
    renderAccountModal();
    updateAutosaveBadge('saved');
    showToast('Desconectado com sucesso.', 'info');
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
}

async function handleManualCloudSync() {
  if (!state.currentUser || !state.isPro) return;
  state.isSyncingCloud = true;
  renderAccountModal();
  updateAutosaveBadge('saving');

  const res = await saveGoritToCloud(state.subjects);
  state.isSyncingCloud = false;

  if (res && res.success) {
    state.lastCloudSync = res.timestamp;
    showToast(t('cloud_sync_success_toast'), 'success');
    updateAutosaveBadge('cloud', res.timestamp);
  } else {
    showToast(t('cloud_sync_error_toast'), 'danger');
  }
  renderAccountModal();
}

async function onUserAuthenticated(user) {
  state.currentUser = user;
  renderAccountHeaderBtn();

  // 1. Check PRO status
  await fetchUserProStatus(user);
  state.isPro = isUserPro(user);
  renderAccountHeaderBtn();

  if (state.isPro) {
    // 2. Always automatically sync from cloud in background
    const cloudGorit = await loadGoritFromCloud();
    if (cloudGorit && Array.isArray(cloudGorit.subjects) && cloudGorit.subjects.length > 0) {
      state.subjects = cloudGorit.subjects;
      ensureGeneralTasksSubject();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
      state.lastCloudSync = cloudGorit.updatedAt || new Date().toISOString();
      renderApp();
      syncToServer();
    } else if (state.subjects && state.subjects.length > 0) {
      // Cloud is empty: push local data to cloud
      saveGoritToCloud(state.subjects).then(res => {
        if (res && res.success) {
          state.lastCloudSync = res.timestamp;
        }
      });
    }

    // 3. Listen to remote changes
    if (state.cloudUnsubscribe) {
      state.cloudUnsubscribe();
      state.cloudUnsubscribe = null;
    }
    state.cloudUnsubscribe = listenGoritCloud((cloudData) => {
      if (cloudData && Array.isArray(cloudData.subjects)) {
        if (cloudData.updatedAt && cloudData.updatedAt !== state.lastCloudSync && !isSyncingToServer && !state.isSyncingCloud) {
          state.subjects = cloudData.subjects;
          state.lastCloudSync = cloudData.updatedAt;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
          renderApp();
          updateAutosaveBadge('cloud', state.lastCloudSync);
        }
      }
    });
  }
}

// --- PRO Subject Sharing via Direct Link ---
let currentShareUrl = '';
let pendingImportShareData = null;

async function handleShareSubject(subjectId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  // Check PRO status
  if (!state.currentUser || !state.isPro) {
    const proModal = document.getElementById('share-pro-modal');
    if (proModal) proModal.classList.add('is-open', 'active');
    return;
  }

  // Generate share link via Firestore
  const res = await shareSubjectToCloud(subject);
  if (res && res.success) {
    currentShareUrl = res.shareUrl;
    const titleEl = document.getElementById('share-link-modal-title');
    if (titleEl) titleEl.textContent = `${t('share_subject_btn')}: ${subject.name}`;
    const inputEl = document.getElementById('share-link-input');
    if (inputEl) inputEl.value = res.shareUrl;
    const btnText = document.getElementById('share-copy-btn-text');
    if (btnText) btnText.textContent = t('share_subject_copy_btn');

    if (navigator.clipboard) {
      navigator.clipboard.writeText(res.shareUrl).catch(() => {});
    }

    const modal = document.getElementById('share-link-modal');
    if (modal) modal.classList.add('is-open', 'active');
  } else {
    showToast(t('share_error_toast'), 'danger');
  }
}

function closeShareLinkModal() {
  const modal = document.getElementById('share-link-modal');
  if (modal) modal.classList.remove('is-open', 'active');
}

function closeShareProModal() {
  const modal = document.getElementById('share-pro-modal');
  if (modal) modal.classList.remove('is-open', 'active');
}

async function copyShareLink() {
  const inputEl = document.getElementById('share-link-input');
  const btnText = document.getElementById('share-copy-btn-text');
  if (!inputEl) return;

  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(inputEl.value);
    } else {
      inputEl.select();
      document.execCommand('copy');
    }
    if (btnText) btnText.textContent = t('share_subject_copied');
    setTimeout(() => {
      if (btnText) btnText.textContent = t('share_subject_copy_btn');
    }, 2500);
  } catch (err) {
    inputEl.select();
  }
}

async function checkForSharedSubjectUrl() {
  const params = new URLSearchParams(window.location.search);
  const shareSlug = params.get('share');
  if (!shareSlug) return;

  try {
    const sharedDoc = await loadSharedSubjectFromCloud(shareSlug);
    if (!sharedDoc || !sharedDoc.subjectData) {
      showToast(t('share_invalid_link_toast'), 'warning');
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    pendingImportShareData = sharedDoc.subjectData;
    const previewBox = document.getElementById('import-share-preview-box');
    const subtitle = document.getElementById('import-share-subtitle');
    if (subtitle && sharedDoc.sharedBy?.name) {
      subtitle.textContent = `Compartilhado por ${sharedDoc.sharedBy.name}`;
    }

    if (previewBox) {
      const sub = sharedDoc.subjectData;
      const contentsCount = (sub.contents || []).length;
      previewBox.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.85rem; margin-bottom:0.75rem;">
          <div class="subject-icon-box" style="--subject-color: ${sub.color || '#3b82f7'}">
            ${renderSubjectIcon(sub)}
          </div>
          <div>
            <div style="font-size:1.15rem; font-weight:700; color:var(--text-primary);">
              ${escapeHtml(sub.name)}
              ${sub.code ? `<span style="font-size:0.8rem; color:var(--text-muted); font-weight:normal;">(${escapeHtml(sub.code)})</span>` : ''}
            </div>
            <div style="font-size:0.82rem; color:var(--text-muted);">
              ${contentsCount} ${contentsCount === 1 ? 'conteúdo' : 'conteúdos e datas de provas'}
            </div>
          </div>
        </div>
        ${(sub.contents || []).slice(0, 4).map(c => `
          <div style="font-size:0.82rem; padding:0.25rem 0; color:var(--text-secondary); display:flex; justify-content:space-between;">
            <span>• ${escapeHtml(c.title)}</span>
            ${c.examDate ? `<span style="color:var(--primary); font-weight:600;">${formatDate(c.examDate)}</span>` : ''}
          </div>
        `).join('')}
        ${contentsCount > 4 ? `<div style="font-size:0.78rem; color:var(--text-muted); margin-top:0.35rem;">+ mais ${contentsCount - 4} tópicos...</div>` : ''}
      `;
    }

    const modal = document.getElementById('import-share-modal');
    if (modal) modal.classList.add('is-open', 'active');
  } catch (err) {
    console.error('Error checking shared link:', err);
  }
}

function closeImportShareModal() {
  const modal = document.getElementById('import-share-modal');
  if (modal) modal.classList.remove('is-open', 'active');
  pendingImportShareData = null;
  window.history.replaceState({}, '', window.location.pathname);
}

function confirmImportSharedSubject() {
  if (!pendingImportShareData) return;

  const newSubject = {
    ...pendingImportShareData,
    id: 'sub-' + Date.now(),
    contents: (pendingImportShareData.contents || []).map(c => ({
      ...c,
      id: 'cnt-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
      isCompleted: false,
      todos: []
    }))
  };

  state.subjects.push(newSubject);
  state.expandedSubjectIds.add(newSubject.id);
  saveToStorage(true);
  renderApp();

  closeImportShareModal();
  showToast(t('import_share_success', { name: newSubject.name }), 'success');
}

function initAuthSync() {
  onAuthChange(async (user) => {
    if (user) {
      await onUserAuthenticated(user);
    } else {
      if (state.cloudUnsubscribe) {
        state.cloudUnsubscribe();
        state.cloudUnsubscribe = null;
      }
      state.currentUser = null;
      state.isPro = false;
      renderAccountHeaderBtn();
    }
  });
}

window.openAccountModal = openAccountModal;
window.closeAccountModal = closeAccountModal;
window.handleGoogleSignIn = handleGoogleSignIn;
window.handleGoogleSignOut = handleGoogleSignOut;
window.handleManualCloudSync = handleManualCloudSync;
window.handleShareSubject = handleShareSubject;
window.closeShareLinkModal = closeShareLinkModal;
window.closeShareProModal = closeShareProModal;
window.copyShareLink = copyShareLink;
window.closeImportShareModal = closeImportShareModal;
window.confirmImportSharedSubject = confirmImportSharedSubject;


// Global Escape key handler to close any active modal dialog (M3 standard)
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeContentModal();
    closeAccountModal();
    closeShareLinkModal();
    closeShareProModal();
    closeImportShareModal();
  }
});

// --- Service Worker Registration ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => {
        console.log('[SW] Gorit Offline Service Worker active in scope:', reg.scope);
      })
      .catch(err => {
        console.warn('[SW] Service Worker registration failed:', err);
      });
  });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
  updateLanguageUI();
  renderColorSwatches();
  renderIconPalette();
  loadFromStorage();
  checkForSharedSubjectUrl();
  renderApp();
  initAuthSync();
});
