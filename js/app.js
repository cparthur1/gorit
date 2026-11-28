// SPDX-License-Identifier: GPL-2.0-only
/**
 * Gorit - Course Content, Exams & Task Tracker
 * Design System: Material Design 3 Expressive + 2.5D Tactile + One UI
 * Internationalization: Strictly pt-BR and en-US
 */

import { t, getLanguage, setLanguage, applyDOMTranslations } from './i18n.js';
import { appAlert, appConfirm } from './dialogs.js';
import {
  signInWithGoogle,
  signOutUser,
  onAuthChange,
  isUserPro,
  getUserProStatus,
  fetchUserProStatus,
  saveGoritToCloud,
  loadGoritFromCloud,
  listenGoritCloud,
  shareSubjectToCloud,
  loadSharedSubjectFromCloud
} from './firebase-client.js';

// --- Icon Constants ---
const PLUS_ICON = `<span class="material-symbols-rounded icon-sm">add</span>`;

// --- Designated Palette & User-Selected Subject Emojis ---
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

// User-selected Subject Emojis (Explicit user preference for subject icons)
const PRESET_EMOJIS = [
  '📚', '🧠', '🩺', '🫀', '🔬', '🧬', '💊', '💉',
  '🧪', '📝', '💻', '🎨', '⚖️', '🌍', '📐', '📊',
  '⚡', '🎯', '💡', '🏅', '📌', '🎓', '🦴', '🏥'
];

// Fixed General Tasks Subject ID
const GENERAL_TASKS_ID = 'general-tasks';

// Storage Keys
const STORAGE_KEY = 'gorit_data_v1';
const LEGACY_STORAGE_KEY = 'studyflow_data_v1';
const LOCAL_UPDATED_AT_KEY = 'gorit_local_updated_at';
const CHRONO_HINT_DISMISSED_KEY = 'gorit_chrono_hint_dismissed';

// --- Application State ---
const state = {
  subjects: [],
  activeTab: 'studies', // 'studies' | 'semester'
  expandedSubjectIds: new Set(),
  expandedContentIds: new Set(),
  searchQuery: '',
  selectedColor: PRESET_COLORS[0],
  selectedIcon: PRESET_EMOJIS[0],
  editingSubjectId: null,
  editingContentData: null,
  nextExamTarget: null,
  currentUser: null,
  isPro: false,
  localUpdatedAt: null,
  lastCloudSync: null,
  cloudUnsubscribe: null,
  isSyncingCloud: false
};

// Deferred per-content todo re-sort timers (lets checkbox spring bounce finish before reordering)
const todoResortTimers = new Map();

// Dirty flags per tab view so switching back to an unchanged tab is instant (0ms DOM rebuild!)
const viewDirty = {
  studies: true,
  semester: true
};

// --- Helper Predicates & Security Utilities ---
function isGeneralSubject(subject) {
  return Boolean(subject && (subject.isPinned || subject.id === GENERAL_TASKS_ID || subject.isGeneralTasks));
}

function hasMeaningfulUserData(subjects) {
  if (!Array.isArray(subjects) || subjects.length === 0) return false;
  return subjects.some(sub => {
    if (!isGeneralSubject(sub)) return true;
    const contents = sub.contents || [];
    if (contents.length > 1) return true;
    return contents.some(c => (c.todos && c.todos.length > 0) || Boolean(c.completed));
  });
}

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url.trim(), window.location.origin);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    // invalid URL
  }
  return null;
}

function sanitizeColor(color) {
  if (!color || typeof color !== 'string') return '#3b82f7';
  const trimmed = color.trim();
  if (/^#[0-9a-fA-F]{3,8}$/.test(trimmed)) return trimmed;
  return '#3b82f7';
}

function renderSubjectIcon(subject) {
  const icon = (subject && (subject.icon || subject.emoji)) || '📚';
  if (/^[a-z0-9_]+$/.test(icon)) {
    return `<span class="material-symbols-rounded">${escapeHtml(icon)}</span>`;
  }
  return `<span class="subject-emoji-icon">${escapeHtml(icon)}</span>`;
}

function ensureGeneralTasksSubject() {
  let generalSubject = state.subjects.find(s => s.id === GENERAL_TASKS_ID || s.isGeneralTasks);
  if (!generalSubject) {
    generalSubject = {
      id: GENERAL_TASKS_ID,
      name: t('general_tasks_title'),
      code: '',
      color: '#3b82f7',
      icon: '📌',
      isPinned: true,
      isGeneralTasks: true,
      contents: [
        {
          id: 'general-content-default',
          title: t('general_tasks_default_content'),
          examDate: null,
          completed: false,
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
    // Normalize any legacy isCompleted field cleanly
    (generalSubject.contents || []).forEach(c => {
      if (c.completed === undefined && c.isCompleted !== undefined) {
        c.completed = Boolean(c.isCompleted);
      }
      delete c.isCompleted;
    });
  }
  return generalSubject;
}

// --- Local Date Utilities (Strictly LocalDate — never UTC toISOString slice!) ---
function getLocalTodayDateStr() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
}

function formatDate(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString(getLanguage(), { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr) {
  const d = parseLocalDate(dateStr);
  if (!d) return '';
  return d.toLocaleDateString(getLanguage(), { day: '2-digit', month: '2-digit' });
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
          contentId: content.id,
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
          contentId: content.id,
          contentTitle: content.title,
          days: Math.round(diff / (1000 * 60 * 60 * 24))
        };
      }
    }
  });

  return { nearestUpcoming, latestPast };
}

// --- Chronological Sorting ---
function sortSubjectsChronologically(subjects) {
  const pinned = [];
  const unpinned = [];

  subjects.forEach(s => {
    if (isGeneralSubject(s)) {
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

    if (hasUpcomingA && hasUpcomingB) {
      const diff = examA.nearestUpcoming.date.getTime() - examB.nearestUpcoming.date.getTime();
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    }
    if (hasUpcomingA && !hasUpcomingB) return -1;
    if (!hasUpcomingA && hasUpcomingB) return 1;

    const hasPastA = Boolean(examA.latestPast);
    const hasPastB = Boolean(examB.latestPast);

    if (hasPastA && hasPastB) {
      const diff = examB.latestPast.date.getTime() - examA.latestPast.date.getTime();
      if (diff !== 0) return diff;
    } else if (hasPastA && !hasPastB) {
      return -1;
    } else if (!hasPastA && hasPastB) {
      return 1;
    }

    return a.name.localeCompare(b.name);
  });

  return [...pinned, ...unpinned];
}

function sortContentsChronologically(contents) {
  return [...contents].sort((a, b) => {
    const dateA = parseLocalDate(a.examDate);
    const dateB = parseLocalDate(b.examDate);

    if (dateA && dateB) {
      return dateA.getTime() - dateB.getTime();
    }
    if (dateA && !dateB) return -1;
    if (!dateA && dateB) return 1;
    return (a.title || '').localeCompare(b.title || '');
  });
}

// --- Progress Calculation ---
function isContentCompleted(content) {
  if (!content) return false;
  if (content.todos && content.todos.length > 0) {
    return content.todos.every(td => td.completed);
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

  const completed = todos.filter(td => td.completed).length;
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

// Overall Semester KPIs — strictly excludes General Tasks (pinned subject)
function getOverallStats() {
  const academicSubjects = state.subjects.filter(s => !isGeneralSubject(s));
  const totalSubjects = academicSubjects.length;
  let totalContents = 0;
  let totalItems = 0;
  let completedItems = 0;
  let nextExam = null;
  let nextExamDiff = Infinity;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  academicSubjects.forEach(subject => {
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
              subjectId: subject.id,
              subjectName: subject.name,
              contentId: content.id,
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

// --- Continuous Autosave, Local Persistence & Timestamped Cloud Sync ---
let isSyncingToServer = false;
let hasPendingServerSync = false;
let autosaveDebounceTimer = null;

function isLocalServerHost() {
  return ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
}

function stampLocalUpdatedAt(timestamp = null) {
  const ts = timestamp || new Date().toISOString();
  state.localUpdatedAt = ts;
  try {
    localStorage.setItem(LOCAL_UPDATED_AT_KEY, ts);
  } catch {
    // ignore storage quota errors
  }
  return ts;
}

function updateAutosaveBadge(status) {
  if (status === 'error') {
    showToast(t('autosave_error'), 'danger');
  }
}

async function syncToServer(skipCloud = false) {
  if (isSyncingToServer) {
    hasPendingServerSync = true;
    return;
  }
  isSyncingToServer = true;

  const syncTimestamp = state.localUpdatedAt || stampLocalUpdatedAt();

  try {
    if (isLocalServerHost()) {
      const payload = JSON.stringify(state.subjects);
      const res = await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }
    }

    if (!skipCloud && state.currentUser && state.isPro) {
      saveGoritToCloud(state.subjects, syncTimestamp).then(cloudRes => {
        if (cloudRes && cloudRes.success) {
          state.lastCloudSync = cloudRes.timestamp;
        }
      }).catch(err => {
        console.warn('[Gorit Cloud] Sync warning:', err);
      });
    }
  } catch (err) {
    console.warn('Autosave to server fallback to local browser storage:', err.message);

    if (!skipCloud && state.currentUser && state.isPro) {
      saveGoritToCloud(state.subjects, syncTimestamp).then(cloudRes => {
        if (cloudRes && cloudRes.success) {
          state.lastCloudSync = cloudRes.timestamp;
        }
      }).catch(() => {});
    }
  } finally {
    isSyncingToServer = false;
    if (hasPendingServerSync) {
      hasPendingServerSync = false;
      syncToServer(false);
    }
  }
}

function saveToStorage(immediate = true) {
  stampLocalUpdatedAt();

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
  } catch (e) {
    console.error('Error saving to localStorage:', e);
    updateAutosaveBadge('error');
  }

  if (immediate) {
    if (autosaveDebounceTimer) {
      clearTimeout(autosaveDebounceTimer);
      autosaveDebounceTimer = null;
    }
    syncToServer(false);
  } else {
    if (autosaveDebounceTimer) clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = setTimeout(() => {
      autosaveDebounceTimer = null;
      syncToServer(false);
    }, 450);
  }
}

// Flush pending debounced autosave immediately on tab close
window.addEventListener('beforeunload', () => {
  if (autosaveDebounceTimer) {
    clearTimeout(autosaveDebounceTimer);
    autosaveDebounceTimer = null;
  }
  if (!isLocalServerHost()) return;
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
  } catch {
    // ignore
  }
});

async function loadFromStorage() {
  let localData = null;
  try {
    state.localUpdatedAt = localStorage.getItem(LOCAL_UPDATED_AT_KEY) || null;
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
  }
  ensureGeneralTasksSubject();
  renderApp();

  if (!isLocalServerHost()) {
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
        if (!state.localUpdatedAt && hasMeaningfulUserData(state.subjects)) {
          stampLocalUpdatedAt();
        }
        renderApp();
      } else if (hasMeaningfulUserData(state.subjects)) {
        // Never wipe meaningful browser data if server data.json is empty
        syncToServer(true);
      }
    }
  } catch (e) {
    console.warn('Server offline or running standalone file. Using browser storage.', e);
  }
}

// --- One UI Frosted Floating Toast Pill (Top-Center + Inline Undo Support) ---
function dismissToast(toastEl) {
  if (!toastEl || toastEl.dataset.dismissed === '1') return;
  toastEl.dataset.dismissed = '1';
  toastEl.classList.add('is-exiting');
  setTimeout(() => toastEl.remove(), 200);
}

function showToast(message, type = 'info', options = {}) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  // Keep at most 2 visible toasts so screen never clutters
  const activeToasts = Array.from(container.querySelectorAll('.toast:not(.is-exiting)'));
  while (activeToasts.length >= 2) {
    const oldest = activeToasts.shift();
    dismissToast(oldest);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let icon = 'info';
  if (type === 'success') icon = 'check_circle';
  else if (type === 'danger' || type === 'error') icon = 'error';
  else if (type === 'warning') icon = 'warning';

  const iconEl = document.createElement('span');
  iconEl.className = 'material-symbols-rounded';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;

  const textEl = document.createElement('span');
  textEl.textContent = String(message || '');

  toast.appendChild(iconEl);
  toast.appendChild(textEl);

  let timerId = null;

  if (options && options.actionLabel && typeof options.onAction === 'function') {
    const actionBtn = document.createElement('button');
    actionBtn.type = 'button';
    actionBtn.className = 'toast-undo-btn';
    actionBtn.textContent = options.actionLabel;
    actionBtn.addEventListener('click', () => {
      if (timerId) clearTimeout(timerId);
      options.onAction();
      dismissToast(toast);
    });
    toast.appendChild(actionBtn);
  }

  container.appendChild(toast);

  const duration = Number(options?.duration) || (options?.actionLabel ? 5000 : 3200);
  timerId = setTimeout(() => {
    dismissToast(toast);
  }, duration);
}

// --- Confetti Celebration for 100% Completion ---
function fireCelebration() {
  try {
    if (typeof confetti === 'function') {
      confetti({
        particleCount: 75,
        spread: 65,
        origin: { y: 0.7 }
      });
    }
  } catch {
    // optional confetti fallback
  }
}

// --- Render: Stats Header (Excludes General Tasks + Dynamic Urgency + Jump-to-Exam) ---
function renderStats() {
  const stats = getOverallStats();
  state.nextExamTarget = stats.nextExam;

  const subjectsEl = document.getElementById('stat-total-subjects');
  const contentsEl = document.getElementById('stat-total-contents');
  const progressEl = document.getElementById('stat-total-progress');
  const progressBarEl = document.getElementById('stat-total-progress-bar');
  const nextExamBox = document.getElementById('stat-box-next-exam');
  const nextExamEl = document.getElementById('stat-next-exam');
  const nextExamArrow = document.getElementById('stat-next-exam-arrow');

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
    progressEl.innerHTML = `${stats.percent}% <span class="stat-ratio-sub">${todoRatio}</span>`;
  }

  if (progressBarEl) {
    progressBarEl.style.width = `${stats.percent}%`;
    progressBarEl.classList.toggle('is-complete', stats.percent === 100 && stats.totalTodos > 0);
  }

  if (nextExamEl) {
    nextExamEl.classList.remove('stat-exam-urgent', 'stat-exam-soon', 'stat-exam-future');

    if (stats.nextExam) {
      let icon = 'event';
      let daysText = t('stat_in_days', { days: stats.nextExam.days });
      let urgencyClass = 'stat-exam-future';

      if (stats.nextExam.days === 0) {
        icon = 'priority_high';
        daysText = t('stat_today');
        urgencyClass = 'stat-exam-urgent';
      } else if (stats.nextExam.days === 1) {
        icon = 'warning';
        daysText = t('stat_tomorrow');
        urgencyClass = 'stat-exam-urgent';
      } else if (stats.nextExam.days <= 3) {
        icon = 'alarm';
        urgencyClass = 'stat-exam-urgent';
      } else if (stats.nextExam.days <= 7) {
        icon = 'event';
        urgencyClass = 'stat-exam-soon';
      }

      nextExamEl.classList.add(urgencyClass);
      nextExamEl.innerHTML = `
        <span class="material-symbols-rounded icon-sm">${icon}</span>
        <strong>${escapeHtml(daysText)}</strong>
        <span class="stat-hint">(${escapeHtml(stats.nextExam.subjectName)})</span>
      `;

      if (nextExamBox) {
        nextExamBox.classList.add('is-interactive');
        nextExamBox.setAttribute('role', 'button');
        nextExamBox.setAttribute('tabindex', '0');
        nextExamBox.title = t('stat_next_exam_jump_hint');
      }
      if (nextExamArrow) nextExamArrow.style.display = 'inline-flex';
    } else {
      nextExamEl.innerHTML = `<span class="stat-empty-text">${t('stat_none_scheduled')}</span>`;
      if (nextExamBox) {
        nextExamBox.classList.remove('is-interactive');
        nextExamBox.removeAttribute('role');
        nextExamBox.removeAttribute('tabindex');
        nextExamBox.removeAttribute('title');
      }
      if (nextExamArrow) nextExamArrow.style.display = 'none';
    }
  }
}

function jumpToNextExam() {
  const target = state.nextExamTarget;
  if (!target || !target.subjectId) return;

  if (state.searchQuery) {
    state.searchQuery = '';
    const searchInput = document.getElementById('search-input');
    if (searchInput) searchInput.value = '';
    syncSearchClearBtn();
  }

  state.expandedSubjectIds.add(target.subjectId);
  if (target.contentId) {
    state.expandedContentIds.add(target.contentId);
  }
  viewDirty.studies = true;

  if (state.activeTab !== 'studies') {
    switchTab('studies');
  } else {
    renderStudiesView();
  }

  requestAnimationFrame(() => {
    const cardEl = document.getElementById(`content-card-${target.contentId}`)
      || document.getElementById(`subject-card-${target.subjectId}`);
    if (cardEl) {
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      cardEl.classList.remove('is-jump-highlight');
      void cardEl.offsetWidth; // trigger highlight pulse
      cardEl.classList.add('is-jump-highlight');
      setTimeout(() => cardEl.classList.remove('is-jump-highlight'), 1450);
    }
  });
}

// --- Compact Chronological Hint Chip ---
function applyChronoHintVisibility() {
  const row = document.getElementById('chrono-hint-row');
  if (!row) return;
  const dismissed = localStorage.getItem(CHRONO_HINT_DISMISSED_KEY) === '1';
  const academicCount = state.subjects.filter(s => !isGeneralSubject(s)).length;
  row.classList.toggle('is-hidden', dismissed || academicCount < 2);
}

function dismissChronoHint() {
  try {
    localStorage.setItem(CHRONO_HINT_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
  applyChronoHintVisibility();
}

// --- Shared Card Snippet Helpers (Used by Both Full Render & In-Place DOM Updates) ---
function buildSubjectProgressText(subProgress) {
  if (subProgress.contentsCount === 0) return t('no_contents_yet');
  if (subProgress.hasAnyTodos) {
    return `${subProgress.percent}% (${t('tasks_ratio', { completed: subProgress.completed, total: subProgress.total })})`;
  }
  return `${subProgress.percent}% (${t('completed_ratio', { completed: subProgress.completed, total: subProgress.total })})`;
}

function buildSubjectMetaChipsHtml(subject, subProgress) {
  const examInfo = getSubjectNextExam(subject);
  let nextExamBadgeHtml = '';

  if (examInfo.nearestUpcoming) {
    const u = examInfo.nearestUpcoming;
    const status = getExamStatus(u.dateStr);
    nextExamBadgeHtml = `
      <span class="exam-badge ${status.badgeClass}" title="${escapeHtml(t('next_exam_tooltip', { title: u.contentTitle }))}">
        <span class="material-symbols-rounded">${status.icon}</span>
        ${escapeHtml(status.text)}
      </span>
    `;
  } else if (examInfo.latestPast) {
    nextExamBadgeHtml = `
      <span class="exam-badge exam-past" title="${escapeHtml(t('no_upcoming_exams'))}">
        <span class="material-symbols-rounded">history</span>
        ${t('no_upcoming_exams')}
      </span>
    `;
  } else if (!isGeneralSubject(subject)) {
    nextExamBadgeHtml = `
      <span class="exam-badge exam-past">
        <span class="material-symbols-rounded">event_busy</span>
        ${t('no_exams_scheduled')}
      </span>
    `;
  }

  let subjectCompletedBadge = '';
  if (subProgress.percent === 100 && subProgress.total > 0) {
    subjectCompletedBadge = `
      <span class="exam-badge exam-completed" title="${escapeHtml(t('all_contents_completed_tooltip'))}">
        <span class="material-symbols-rounded">check_circle</span>
        ${t('completed_badge')}
      </span>
    `;
  }

  return `${nextExamBadgeHtml}${subjectCompletedBadge}`;
}

function buildContentProgressText(content, progress, isCompleted) {
  if (progress.hasTodos) {
    return isCompleted
      ? `${progress.percent}% (${t('tasks_ratio', { completed: progress.completed, total: progress.total })}) • ${t('completed_badge')}`
      : `${progress.percent}% (${t('tasks_ratio', { completed: progress.completed, total: progress.total })})`;
  }
  return isCompleted
    ? `100% • ${t('completed_badge')}`
    : `0% • ${t('status_pending')}`;
}

// --- Render: Main Collapsible Studies View (Tab 1) ---
function renderStudiesView() {
  const container = document.getElementById('studies-list-container');
  if (!container) return;
  viewDirty.studies = false;

  applyChronoHintVisibility();
  syncSearchClearBtn();

  const sortedSubjects = sortSubjectsChronologically(state.subjects);
  const q = state.searchQuery.trim().toLowerCase();

  // Deep Search: matches subject name/code, content titles, AND individual task titles!
  const filteredSubjects = sortedSubjects.filter(sub => {
    if (!q) return true;
    const matchSub = (sub.name || '').toLowerCase().includes(q)
      || (sub.code && sub.code.toLowerCase().includes(q));
    const matchContentOrTodo = (sub.contents || []).some(c =>
      (c.title || '').toLowerCase().includes(q)
      || (c.todos || []).some(td => (td.title || '').toLowerCase().includes(q))
    );
    return matchSub || matchContentOrTodo;
  });

  if (filteredSubjects.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-rounded empty-state-icon">search_off</span>
        <h3 class="empty-state-title">${t('no_search_results_title')}</h3>
        <p class="empty-state-desc">${t('no_search_results_desc', { query: escapeHtml(state.searchQuery) })}</p>
        <button type="button" class="btn btn-tonal btn-sm" onclick="clearSearch()">${t('clear_search')}</button>
      </div>
    `;
    updateToggleAllBtn();
    return;
  }

  let html = '';
  const firstUpcomingExamSubject = filteredSubjects.find(
    s => !isGeneralSubject(s) && getSubjectNextExam(s).nearestUpcoming
  );
  const academicCount = state.subjects.filter(s => !isGeneralSubject(s)).length;

  filteredSubjects.forEach(subject => {
    const isPinned = isGeneralSubject(subject);
    const hasInnerSearchMatch = Boolean(q) && (subject.contents || []).some(c =>
      (c.title || '').toLowerCase().includes(q)
      || (c.todos || []).some(td => (td.title || '').toLowerCase().includes(q))
    );
    const isSubjectExpanded = state.expandedSubjectIds.has(subject.id) || hasInnerSearchMatch;
    const subProgress = getSubjectProgress(subject);
    const color = sanitizeColor(subject.color);
    const progressText = buildSubjectProgressText(subProgress);
    const metaChipsHtml = buildSubjectMetaChipsHtml(subject, subProgress);
    const allDone = isSubjectAllDone(subject);
    const contentsCount = (subject.contents || []).length;

    html += `
      <div class="subject-card ${isSubjectExpanded ? 'is-expanded' : ''} ${isPinned ? 'is-pinned' : ''}"
           id="subject-card-${subject.id}"
           style="--subject-color: ${color}">

        <!-- Subject Header (Click / Keyboard to expand) — Share button lives ONLY inside drawer -->
        <div
          class="subject-header"
          role="button"
          tabindex="0"
          aria-expanded="${isSubjectExpanded}"
          onclick="toggleSubject('${subject.id}', event)"
          onkeydown="if((event.key==='Enter'||event.key===' ') && event.target===this){event.preventDefault();toggleSubject('${subject.id}', event);}">
          <div class="subject-icon-box">
            ${renderSubjectIcon(subject)}
          </div>

          <div class="subject-info">
            <div class="subject-title-row">
              <div class="subject-name">
                ${isPinned ? `<span class="pinned-badge"><span class="material-symbols-rounded">push_pin</span> ${t('pinned_badge')}</span>` : ''}
                ${!isPinned && firstUpcomingExamSubject && firstUpcomingExamSubject.id === subject.id
                  ? `<span class="first-in-line-badge" title="${escapeHtml(t('next_upcoming_exam_tooltip'))}"><span class="material-symbols-rounded">grade</span> ${t('first_in_line')}</span>`
                  : ''}
                <span>${escapeHtml(subject.name)}</span>
                ${subject.code ? `<span class="subject-code-tag">(${escapeHtml(subject.code)})</span>` : ''}
              </div>
              <div class="subject-meta-chips">
                ${metaChipsHtml}
              </div>
            </div>

            <!-- Subject Progress Bar -->
            <div class="progress-wrap">
              <div class="progress-track" title="${escapeHtml(t('completed_ratio', { completed: subProgress.completed, total: subProgress.total }))}">
                <div class="progress-fill" style="width: ${subProgress.percent}%"></div>
              </div>
              <div class="progress-meta">
                ${progressText}
              </div>
            </div>
          </div>

          <div class="subject-chevron" aria-hidden="true">
            <span class="material-symbols-rounded">expand_more</span>
          </div>
        </div>

        <!-- Subject Drawer (Zero padding-thrashing inner wrapper) -->
        <div class="subject-contents-drawer-wrapper">
          <div class="subject-contents-drawer">
            <div class="subject-contents-drawer-inner">
              <div class="contents-header-bar">
                <div class="contents-count-text">
                  <span class="material-symbols-rounded">folder</span>
                  <span>${t('contents_header', { count: contentsCount })}</span>
                </div>

                <!-- M3 Expressive Connected Button Group -->
                <div class="m3-btn-group contents-header-group">
                  ${!isPinned ? `
                    <button type="button" class="m3-btn-group-item m3-group-sky" onclick="handleShareSubject('${subject.id}', event, this)" title="${escapeHtml(t('share_subject_btn'))}">
                      <span class="material-symbols-rounded icon-sm">share</span>
                      <span>${t('share_subject_btn')}</span>
                    </button>
                  ` : ''}
                  ${contentsCount > 0 ? `
                    <button type="button" class="m3-btn-group-item ${allDone ? 'm3-group-orange' : 'm3-group-emerald'}" data-role="toggle-all-subject" onclick="toggleAllSubjectContents('${subject.id}', event)" title="${escapeHtml(t('toggle_subject_all_tooltip'))}">
                      <span class="material-symbols-rounded icon-sm">${allDone ? 'restart_alt' : 'done_all'}</span>
                      <span>${allDone ? t('reset_all') : t('complete_all')}</span>
                    </button>
                  ` : ''}
                  <button type="button" class="m3-btn-group-item m3-group-blue" onclick="openAddContentModal('${subject.id}', event)">
                    ${PLUS_ICON}
                    <span>${t('add_content')}</span>
                  </button>
                </div>
              </div>

              <!-- List of Contents -->
              <div class="contents-list-wrap">
                ${renderContentsList(subject, q)}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  });

  // Clean empty state below General Tasks when no academic subjects exist yet (no sample courses!)
  if (!q && academicCount === 0) {
    html += `
      <div class="empty-state" style="margin-top: 0.75rem;">
        <span class="material-symbols-rounded empty-state-icon">menu_book</span>
        <h3 class="empty-state-title">${t('no_subjects_title')}</h3>
        <p class="empty-state-desc">${t('no_subjects_desc')}</p>
        <button type="button" class="btn btn-primary" onclick="switchTab('semester')">
          ${PLUS_ICON}
          <span>${t('add_subject')}</span>
        </button>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.content-checkbox[data-indeterminate="true"]').forEach(el => {
    el.indeterminate = true;
  });

  updateToggleAllBtn();
}

// --- Render: Contents inside a Subject ---
function renderContentsList(subject, searchQueryLower = '') {
  const contents = subject.contents || [];
  if (contents.length === 0) {
    return `
      <div style="text-align: center; padding: 1.4rem; background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-color);">
        <p style="font-size: 0.86rem; color: var(--text-muted); margin-bottom: 0.65rem;">${t('no_contents_in_subject')}</p>
        <button type="button" class="btn btn-tonal btn-sm" onclick="openAddContentModal('${subject.id}', event)">
          ${PLUS_ICON} <span>${t('add_first_content')}</span>
        </button>
      </div>
    `;
  }

  const sorted = sortContentsChronologically(contents);

  return sorted.map(content => {
    const matchesTodoSearch = Boolean(searchQueryLower) && (content.todos || []).some(
      td => (td.title || '').toLowerCase().includes(searchQueryLower)
    );
    const isExpanded = state.expandedContentIds.has(content.id) || matchesTodoSearch;
    const progress = getContentProgress(content);
    const examStatus = content.examDate ? getExamStatus(content.examDate) : null;
    const isCompleted = isContentCompleted(content);
    const hasTodos = (content.todos || []).length > 0;
    const completedTodosCount = (content.todos || []).filter(td => td.completed).length;
    const totalTodosCount = (content.todos || []).length;
    const isIndeterminate = hasTodos && completedTodosCount > 0 && completedTodosCount < totalTodosCount;

    let examBadgeHtml = '';
    if (examStatus) {
      examBadgeHtml = `
        <span class="exam-badge ${examStatus.badgeClass}" title="${escapeHtml(t('exam_date_tooltip', { date: formatDate(content.examDate) }))}">
          <span class="material-symbols-rounded">${examStatus.icon}</span>
          <span>${escapeHtml(examStatus.text)}</span>
          <button
            type="button"
            class="pill-clear-date-btn"
            onclick="clearContentExamDate('${subject.id}', '${content.id}', event)"
            title="${escapeHtml(t('clear_date_tooltip'))}"
            aria-label="${escapeHtml(t('clear_date_tooltip'))}">
            <span class="material-symbols-rounded">close</span>
          </button>
        </span>
      `;
    } else {
      examBadgeHtml = `
        <span class="exam-badge exam-past" title="${escapeHtml(t('click_calendar_set_date'))}">
          <span class="material-symbols-rounded">event_available</span>
          <span>${t('no_date_set')}</span>
        </span>
      `;
    }

    const datePickerHtml = `
      <div class="content-date-wrapper" onclick="event.stopPropagation()">
        ${examBadgeHtml}
        <label class="date-picker-trigger" title="${escapeHtml(t('change_exam_deadline'))}">
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

    const contentProgressText = buildContentProgressText(content, progress, isCompleted);

    return `
      <div class="content-item-card ${isExpanded ? 'is-expanded' : ''} ${isCompleted ? 'is-completed' : ''}" id="content-card-${content.id}">
        <!-- Content Header (Single checkbox control — no redundant button inside drawer!) -->
        <div
          class="content-item-header"
          role="button"
          tabindex="0"
          aria-expanded="${isExpanded}"
          onclick="toggleContent('${content.id}', event)"
          onkeydown="if((event.key==='Enter'||event.key===' ') && event.target===this){event.preventDefault();toggleContent('${content.id}', event);}">
          <div class="content-header-main">
            <div class="content-check-wrap" onclick="event.stopPropagation()" title="${escapeHtml(isCompleted ? t('mark_as_pending') : t('mark_as_completed'))}">
              <input
                type="checkbox"
                class="content-checkbox"
                id="content-chk-${content.id}"
                ${isCompleted ? 'checked' : ''}
                ${isIndeterminate ? 'data-indeterminate="true"' : ''}
                onclick="event.stopPropagation()"
                onchange="toggleContentCompleted('${subject.id}', '${content.id}', this.checked, event)"
                aria-label="${escapeHtml(t('mark_content_aria', { title: content.title }))}"
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
                <div class="progress-track" style="height: 6px;" title="${escapeHtml(t('completed_ratio', { completed: progress.completed, total: progress.total }))}">
                  <div class="progress-fill ${isCompleted ? 'is-completed' : ''}" style="width: ${progress.percent}%"></div>
                </div>
                <div class="progress-meta" style="font-size: 0.72rem;">
                  ${contentProgressText}
                </div>
              </div>
            </div>
          </div>

          <div class="content-header-actions">
            <button type="button" class="btn-icon" title="${escapeHtml(t('edit_content'))}" aria-label="${escapeHtml(t('edit_content'))}" onclick="openEditContentModal('${subject.id}', '${content.id}', event)">
              <span class="material-symbols-rounded icon-sm">edit</span>
            </button>
            <button type="button" class="btn-icon btn-icon-danger" title="${escapeHtml(t('delete_content'))}" aria-label="${escapeHtml(t('delete_content'))}" onclick="deleteContent('${subject.id}', '${content.id}', event)">
              <span class="material-symbols-rounded icon-sm">delete</span>
            </button>
            <div class="content-chevron" aria-hidden="true">
              <span class="material-symbols-rounded">expand_more</span>
            </div>
          </div>
        </div>

        <!-- Content Tasks Drawer (Clean & Focused — Notes box & duplicate complete bar removed) -->
        <div class="content-tasks-drawer-wrapper">
          <div class="content-tasks-drawer">
            <div class="content-tasks-drawer-inner">
              <div class="todo-list" id="todo-list-${content.id}">
                ${renderTodos(subject.id, content)}
              </div>

              <!-- Quick Inline Add Todo with Visual Date Feedback & Daily Reminder Toggle -->
              <form class="add-todo-inline" onsubmit="handleInlineAddTodo('${subject.id}', '${content.id}', event)">
                <input
                  type="text"
                  class="add-todo-input"
                  id="input-todo-${content.id}"
                  placeholder="${escapeHtml(t('add_task_placeholder'))}"
                  autocomplete="off"
                />
                <div class="add-todo-controls">
                  <label class="todo-date-picker-label" id="label-todo-date-${content.id}" title="${escapeHtml(t('due_date_label'))}">
                    <span class="material-symbols-rounded">alarm</span>
                    <span class="todo-date-preview-text" id="preview-todo-date-${content.id}" style="display:none;"></span>
                    <input
                      type="date"
                      id="input-todo-date-${content.id}"
                      class="todo-date-input"
                      title="${escapeHtml(t('due_date_label'))}"
                      onchange="handleInlineTodoDateChange('${content.id}', this.value)"
                    />
                  </label>
                  <button
                    type="button"
                    class="todo-action-icon-btn todo-inline-daily-btn"
                    id="input-todo-daily-${content.id}"
                    onclick="toggleInlineDailyReminderBtn('${content.id}')"
                    title="${escapeHtml(t('daily_reminder_tooltip'))}"
                    aria-label="${escapeHtml(t('daily_reminder_tooltip'))}">
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
      </div>
    `;
  }).join('');
}

// --- Prioritize / Sort Todos (Strictly LocalDate!) ---
function sortTodosByPriority(todos) {
  const todayStr = getLocalTodayDateStr();
  return [...todos].sort((a, b) => {
    if (a.completed !== b.completed) return a.completed ? 1 : -1;

    const aDueTodayOrPast = Boolean(a.dueDate && a.dueDate <= todayStr);
    const bDueTodayOrPast = Boolean(b.dueDate && b.dueDate <= todayStr);
    if (aDueTodayOrPast !== bDueTodayOrPast) return aDueTodayOrPast ? -1 : 1;

    if (Boolean(a.dailyReminder) !== Boolean(b.dailyReminder)) {
      return a.dailyReminder ? -1 : 1;
    }

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
    return `<div style="font-size:0.82rem; color:var(--text-muted); padding:0.35rem 0;">${t('no_tasks_placeholder')}</div>`;
  }

  const sortedTodos = sortTodosByPriority(todos);
  const todayStr = getLocalTodayDateStr();

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
      dueBadgeHtml = `
        <span class="todo-due-pill ${dueClass}">
          <span class="material-symbols-rounded">${dueIcon}</span>
          <span>${escapeHtml(dueText)}</span>
          <button
            type="button"
            class="pill-clear-date-btn"
            onclick="clearTodoDueDate('${subjectId}', '${content.id}', '${todo.id}', event)"
            title="${escapeHtml(t('clear_date_tooltip'))}"
            aria-label="${escapeHtml(t('clear_date_tooltip'))}">
            <span class="material-symbols-rounded">close</span>
          </button>
        </span>
      `;
    }

    const dailyBadgeHtml = todo.dailyReminder
      ? `<span class="todo-daily-pill" title="${escapeHtml(t('daily_reminder_tooltip'))}"><span class="material-symbols-rounded">event_repeat</span> ${t('daily_reminder_label')}</span>`
      : '';

    return `
      <div class="todo-row ${todo.completed ? 'completed' : ''}" data-todo-id="${todo.id}">
        <input
          type="checkbox"
          class="todo-checkbox"
          ${todo.completed ? 'checked' : ''}
          onchange="toggleTodoStatus('${subjectId}', '${content.id}', '${todo.id}', this.checked, this)"
          aria-label="${escapeHtml(todo.title)}"
        />
        <span
          class="todo-text"
          contenteditable="true"
          spellcheck="false"
          title="${escapeHtml(t('click_to_edit_task'))}"
          onblur="handleTodoTitleBlur('${subjectId}', '${content.id}', '${todo.id}', this)"
          onkeydown="handleTodoTitleKeydown(event, this)">${escapeHtml(todo.title)}</span>

        <div class="todo-actions-wrap">
          <button
            type="button"
            class="todo-action-icon-btn ${todo.dailyReminder ? 'is-active' : ''}"
            onclick="toggleTodoDailyReminder('${subjectId}', '${content.id}', '${todo.id}', event)"
            title="${escapeHtml(t('daily_reminder_tooltip'))}"
            aria-label="${escapeHtml(t('daily_reminder_tooltip'))}">
            <span class="material-symbols-rounded">event_repeat</span>
          </button>

          <label class="todo-date-picker-label ${todo.dueDate ? 'has-date' : ''}" title="${escapeHtml(t('due_date_label'))}">
            <span class="material-symbols-rounded">alarm</span>
            <input
              type="date"
              class="todo-date-input"
              value="${todo.dueDate || ''}"
              onchange="handleTodoDueDateChange('${subjectId}', '${content.id}', '${todo.id}', this.value, event)"
            />
          </label>

          <!-- Unified Delete Icon across all entities -->
          <button
            type="button"
            class="todo-delete-btn"
            title="${escapeHtml(t('delete_task'))}"
            aria-label="${escapeHtml(t('delete_task'))}"
            onclick="deleteTodo('${subjectId}', '${content.id}', '${todo.id}', event)">
            <span class="material-symbols-rounded">delete</span>
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

// --- In-Place DOM Synchronization (Preserves Smooth Progress Transitions & Focus!) ---
function syncContentCardInPlace(subject, content, reRenderTodos = false) {
  const contentCard = document.getElementById(`content-card-${content.id}`);
  if (!contentCard) return;

  const progress = getContentProgress(content);
  const isCompleted = isContentCompleted(content);
  const hasTodos = (content.todos || []).length > 0;
  const completedCount = (content.todos || []).filter(td => td.completed).length;
  const totalCount = (content.todos || []).length;
  const isIndeterminate = hasTodos && completedCount > 0 && completedCount < totalCount;

  contentCard.classList.toggle('is-completed', isCompleted);

  const chk = document.getElementById(`content-chk-${content.id}`);
  if (chk) {
    chk.checked = isCompleted;
    chk.indeterminate = isIndeterminate;
  }

  const checkWrap = contentCard.querySelector('.content-check-wrap');
  if (checkWrap) {
    checkWrap.title = isCompleted ? t('mark_as_pending') : t('mark_as_completed');
  }

  const titleText = contentCard.querySelector('.content-title-text');
  if (titleText) {
    titleText.classList.toggle('completed', isCompleted);
  }

  const titleContainer = contentCard.querySelector('.content-title');
  if (titleContainer) {
    let badge = titleContainer.querySelector('.content-completed-badge');
    if (isCompleted && !badge) {
      badge = document.createElement('span');
      badge.className = 'content-completed-badge';
      badge.innerHTML = `<span class="material-symbols-rounded">check</span> ${t('completed_badge')}`;
      titleContainer.appendChild(badge);
    } else if (!isCompleted && badge) {
      badge.remove();
    }
  }

  const fill = contentCard.querySelector('.content-item-header .progress-fill');
  if (fill) {
    fill.style.width = `${progress.percent}%`;
    fill.classList.toggle('is-completed', isCompleted);
  }

  const track = contentCard.querySelector('.content-item-header .progress-track');
  if (track) {
    track.title = t('completed_ratio', { completed: progress.completed, total: progress.total });
  }

  const meta = contentCard.querySelector('.content-item-header .progress-meta');
  if (meta) {
    meta.textContent = buildContentProgressText(content, progress, isCompleted);
  }

  if (reRenderTodos) {
    const todoList = document.getElementById(`todo-list-${content.id}`);
    if (todoList) {
      todoList.innerHTML = renderTodos(subject.id, content);
    }
  }
}

function syncSubjectCardInPlace(subjectId, targetContentId = null, options = {}) {
  viewDirty.semester = true;
  renderStats();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const subjectCard = document.getElementById(`subject-card-${subjectId}`);
  if (!subjectCard) {
    if (state.activeTab === 'studies') renderStudiesView();
    return;
  }

  const subProgress = getSubjectProgress(subject);
  const subFill = subjectCard.querySelector('.subject-header .progress-fill');
  if (subFill) subFill.style.width = `${subProgress.percent}%`;

  const subTrack = subjectCard.querySelector('.subject-header .progress-track');
  if (subTrack) {
    subTrack.title = t('completed_ratio', { completed: subProgress.completed, total: subProgress.total });
  }

  const subMeta = subjectCard.querySelector('.subject-header .progress-meta');
  if (subMeta) subMeta.textContent = buildSubjectProgressText(subProgress);

  const subChips = subjectCard.querySelector('.subject-header .subject-meta-chips');
  if (subChips) subChips.innerHTML = buildSubjectMetaChipsHtml(subject, subProgress);

  const allDone = isSubjectAllDone(subject);
  const toggleAllSubjectBtn = subjectCard.querySelector('[data-role="toggle-all-subject"]');
  if (toggleAllSubjectBtn) {
    toggleAllSubjectBtn.classList.toggle('m3-group-orange', allDone);
    toggleAllSubjectBtn.classList.toggle('m3-group-emerald', !allDone);
    const iconSpan = toggleAllSubjectBtn.querySelector('.material-symbols-rounded');
    const textSpan = toggleAllSubjectBtn.querySelector('span:not(.material-symbols-rounded)');
    if (iconSpan) iconSpan.textContent = allDone ? 'restart_alt' : 'done_all';
    if (textSpan) textSpan.textContent = allDone ? t('reset_all') : t('complete_all');
  }

  if (targetContentId === '*') {
    (subject.contents || []).forEach(c => {
      syncContentCardInPlace(subject, c, true);
    });
  } else if (targetContentId) {
    const content = (subject.contents || []).find(c => c.id === targetContentId);
    if (content) {
      syncContentCardInPlace(subject, content, Boolean(options.reRenderTodos));
    }
  }
}

// --- Render: Manage Semester Subjects View (Tab 2) ---
function buildSemesterSubjectItemHtml(subject) {
  const progress = getSubjectProgress(subject);
  const examInfo = getSubjectNextExam(subject);
  const isPinned = isGeneralSubject(subject);
  const isEditing = state.editingSubjectId === subject.id;
  const color = sanitizeColor(subject.color);

  let examDateText = t('no_date_set');
  if (examInfo.nearestUpcoming) {
    examDateText = `${t('exam_in_days', { days: examInfo.nearestUpcoming.days })} (${formatDate(examInfo.nearestUpcoming.dateStr)})`;
  }

  const contentsLabel = progress.contentsCount === 1
    ? t('stat_content_count_singular')
    : t('stat_contents_count', { count: progress.contentsCount });

  const progressRatioLabel = progress.hasAnyTodos
    ? t('tasks_ratio', { completed: progress.completed, total: progress.total })
    : t('completed_ratio', { completed: progress.completed, total: progress.total });

  return `
    <div class="subject-manage-item ${isPinned ? 'is-pinned' : ''} ${isEditing ? 'is-editing' : ''}" id="semester-item-${subject.id}" style="border-left: 6px solid ${color}">
      <div class="subject-manage-top">
        <div class="subject-manage-info">
          <div class="subject-icon-box" style="--subject-color: ${color}">
            ${renderSubjectIcon(subject)}
          </div>
          <div class="subject-manage-text">
            <div class="subject-manage-title-row">
              ${isPinned ? `<span class="pinned-badge"><span class="material-symbols-rounded">push_pin</span> ${t('pinned_badge')}</span>` : ''}
              <span class="subject-manage-name">${escapeHtml(subject.name)}</span>
              ${subject.code ? `<span class="subject-manage-code">(${escapeHtml(subject.code)})</span>` : ''}
            </div>
            <div class="subject-manage-meta">
              <span class="subject-meta-item">${contentsLabel}</span>
              <span class="meta-separator">•</span>
              <span class="subject-meta-item">${progress.percent}% (${progressRatioLabel})</span>
              ${!isPinned ? `
                <span class="meta-separator">•</span>
                <span class="subject-meta-item">${escapeHtml(examDateText)}</span>
              ` : ''}
            </div>
          </div>
        </div>
        ${isPinned ? `<span class="pinned-badge" title="${escapeHtml(t('general_tasks_cannot_delete'))}"><span class="material-symbols-rounded">lock</span></span>` : ''}
      </div>

      <!-- Dedicated Bottom Row: M3 Expressive Connected Button Group -->
      <div class="subject-manage-actions">
        <div class="m3-btn-group m3-btn-group-full">
          <button type="button" class="m3-btn-group-item m3-group-blue" onclick="openAddContentModal('${subject.id}', event)" title="${escapeHtml(t('add_content'))}">
            ${PLUS_ICON} <span>${t('content_btn')}</span>
          </button>
          <button type="button" class="m3-btn-group-item m3-group-sky" onclick="editSubject('${subject.id}')" title="${escapeHtml(t('edit_btn'))}">
            <span class="material-symbols-rounded icon-sm">edit</span>
            <span>${t('edit_btn')}</span>
          </button>
          ${!isPinned ? `
            <button type="button" class="m3-btn-group-item m3-group-emerald" onclick="handleShareSubject('${subject.id}', event, this)" title="${escapeHtml(t('share_subject_btn'))}">
              <span class="material-symbols-rounded icon-sm">share</span>
              <span>${t('share_subject_btn')}</span>
            </button>
            <button type="button" class="m3-btn-group-item m3-group-danger" onclick="deleteSubject('${subject.id}')" title="${escapeHtml(t('delete_btn'))}">
              <span class="material-symbols-rounded icon-sm">delete</span>
              <span>${t('delete_btn')}</span>
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `;
}

function renderSemesterView() {
  const container = document.getElementById('semester-subjects-list');
  if (!container) return;
  viewDirty.semester = false;

  ensureGeneralTasksSubject();
  const sorted = sortSubjectsChronologically(state.subjects);
  const academicCount = sorted.filter(s => !isGeneralSubject(s)).length;

  let html = sorted.map(subject => buildSemesterSubjectItemHtml(subject)).join('');

  if (academicCount === 0) {
    html += `
      <div class="empty-state" style="margin-top: 0.25rem;">
        <span class="material-symbols-rounded empty-state-icon">school</span>
        <h4 class="empty-state-title">${t('no_subjects_title')}</h4>
        <p class="empty-state-desc">${t('no_subjects_manage_desc')}</p>
      </div>
    `;
  }

  container.innerHTML = html;
  updateSubjectLivePreview();
}

function syncSubjectIdentityInStudies(subject) {
  const card = document.getElementById(`subject-card-${subject.id}`);
  if (!card) {
    viewDirty.studies = true;
    return;
  }

  const color = sanitizeColor(subject.color);
  card.style.setProperty('--subject-color', color);

  const iconBox = card.querySelector('.subject-header .subject-icon-box');
  if (iconBox) iconBox.innerHTML = renderSubjectIcon(subject);

  const nameRow = card.querySelector('.subject-header .subject-name');
  if (nameRow) {
    const plainNameSpan = nameRow.querySelector(':scope > span:not(.pinned-badge):not(.first-in-line-badge):not(.subject-code-tag)');
    if (plainNameSpan) plainNameSpan.textContent = subject.name;

    let codeSpan = nameRow.querySelector('.subject-code-tag');
    if (subject.code) {
      if (!codeSpan) {
        codeSpan = document.createElement('span');
        codeSpan.className = 'subject-code-tag';
        nameRow.appendChild(codeSpan);
      }
      codeSpan.textContent = `(${subject.code})`;
    } else if (codeSpan) {
      codeSpan.remove();
    }
  }
}

function updateSemesterListItemInPlace(subject) {
  syncSubjectIdentityInStudies(subject);
  const el = document.getElementById(`semester-item-${subject.id}`);
  if (!el) return;
  const wrapper = document.createElement('div');
  wrapper.innerHTML = buildSemesterSubjectItemHtml(subject).trim();
  const nextEl = wrapper.firstElementChild;
  if (nextEl) el.replaceWith(nextEl);
}

// --- Live Subject Card Preview & Auto-Save Edit Mode (Tab 2) ---
function updateSubjectLivePreview() {
  const previewCard = document.getElementById('subject-live-preview');
  const previewEmoji = document.getElementById('preview-emoji-icon');
  const previewName = document.getElementById('preview-subject-name');
  const previewCode = document.getElementById('preview-subject-code');
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');

  if (!previewCard) return;

  const color = sanitizeColor(state.selectedColor);
  previewCard.style.setProperty('--subject-color', color);

  if (previewEmoji) {
    const icon = state.selectedIcon || '📚';
    if (/^[a-z0-9_]+$/.test(icon)) {
      previewEmoji.className = 'material-symbols-rounded';
      previewEmoji.textContent = icon;
    } else {
      previewEmoji.className = 'subject-emoji-icon';
      previewEmoji.textContent = icon;
    }
  }

  if (previewName) {
    const val = (nameInput?.value || '').trim();
    previewName.textContent = val || t('subject_preview_placeholder');
  }

  if (previewCode) {
    const codeVal = (codeInput?.value || '').trim();
    previewCode.textContent = codeVal ? `(${codeVal})` : '';
  }
}

function handleSubjectFieldLiveInput() {
  updateSubjectLivePreview();

  if (!state.editingSubjectId) return;

  const subject = state.subjects.find(s => s.id === state.editingSubjectId);
  if (!subject) return;

  const nameVal = (document.getElementById('subject-name-input')?.value || '').trim();
  const codeVal = (document.getElementById('subject-code-input')?.value || '').trim();

  if (nameVal) {
    subject.name = nameVal;
  }
  subject.code = codeVal;

  saveToStorage(false); // Debounced seamless autosave
  updateSemesterListItemInPlace(subject);
  renderStats();
}

// --- Color & Emoji Pickers ---
function renderColorSwatches() {
  const container = document.getElementById('color-swatches-container');
  if (!container) return;

  container.innerHTML = PRESET_COLORS.map(color => `
    <button
      type="button"
      class="color-swatch-circle ${state.selectedColor === color ? 'active' : ''}"
      style="background-color: ${color};"
      onclick="selectColor('${color}')"
      title="${escapeHtml(t('choose_color_tooltip', { color }))}"
      aria-label="${escapeHtml(t('choose_color_tooltip', { color }))}">
    </button>
  `).join('') + `
    <input
      type="color"
      class="color-picker-input"
      id="custom-color-input"
      value="${sanitizeColor(state.selectedColor)}"
      onchange="selectColor(this.value)"
      title="${escapeHtml(t('custom_color_tooltip'))}"
      aria-label="${escapeHtml(t('custom_color_tooltip'))}"
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
      title="${escapeHtml(emoji)}"
      aria-label="${escapeHtml(emoji)}">
      <span class="subject-emoji-icon">${emoji}</span>
    </button>
  `).join('');
}

function selectColor(color) {
  const safeColor = sanitizeColor(color);
  state.selectedColor = safeColor;
  const customColorInput = document.getElementById('custom-color-input');
  if (customColorInput) customColorInput.value = safeColor;
  renderColorSwatches();
  updateSubjectLivePreview();

  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.color = safeColor;
      saveToStorage(true);
      updateSemesterListItemInPlace(subject);
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
  updateSubjectLivePreview();

  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.icon = iconName;
      subject.emoji = iconName;
      saveToStorage(true);
      updateSemesterListItemInPlace(subject);
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
  updateSubjectLivePreview();

  if (state.editingSubjectId) {
    const subject = state.subjects.find(s => s.id === state.editingSubjectId);
    if (subject) {
      subject.icon = emoji;
      subject.emoji = emoji;
      saveToStorage(true);
      updateSemesterListItemInPlace(subject);
    }
  }
}

// --- Accordion Toggle Handlers ---
function toggleSubject(subjectId, event) {
  if (event) {
    if (event.target.closest('button') || event.target.closest('input') || event.target.closest('a')) return;
  }

  const card = document.getElementById(`subject-card-${subjectId}`);
  const header = card?.querySelector('.subject-header');
  if (state.expandedSubjectIds.has(subjectId)) {
    state.expandedSubjectIds.delete(subjectId);
    if (card) {
      card.classList.remove('is-expanded');
      if (header) header.setAttribute('aria-expanded', 'false');
    } else {
      renderStudiesView();
    }
  } else {
    state.expandedSubjectIds.add(subjectId);
    if (card) {
      card.classList.add('is-expanded');
      if (header) header.setAttribute('aria-expanded', 'true');
    } else {
      renderStudiesView();
    }
  }
  updateToggleAllBtn();
}

function toggleContent(contentId, event) {
  if (event) {
    if (
      event.target.closest('button')
      || event.target.closest('input')
      || event.target.closest('label')
      || event.target.closest('textarea')
    ) return;
  }

  const card = document.getElementById(`content-card-${contentId}`);
  const header = card?.querySelector('.content-item-header');
  if (state.expandedContentIds.has(contentId)) {
    state.expandedContentIds.delete(contentId);
    if (card) {
      card.classList.remove('is-expanded');
      if (header) header.setAttribute('aria-expanded', 'false');
    } else {
      renderStudiesView();
    }
  } else {
    state.expandedContentIds.add(contentId);
    if (card) {
      card.classList.add('is-expanded');
      if (header) header.setAttribute('aria-expanded', 'true');
    } else {
      renderStudiesView();
    }
  }
  updateToggleAllBtn();
}

function updateToggleAllBtn() {
  const icon = document.getElementById('toggle-all-icon');
  const label = document.getElementById('toggle-all-label');
  if (!icon || !label) return;

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
  updateToggleAllBtn();
}

function expandAll() {
  state.subjects.forEach(s => {
    state.expandedSubjectIds.add(s.id);
    (s.contents || []).forEach(c => state.expandedContentIds.add(c.id));
  });
  document.querySelectorAll('.subject-card').forEach(card => {
    card.classList.add('is-expanded');
    card.querySelector('.subject-header')?.setAttribute('aria-expanded', 'true');
  });
  document.querySelectorAll('.content-item-card').forEach(card => {
    card.classList.add('is-expanded');
    card.querySelector('.content-item-header')?.setAttribute('aria-expanded', 'true');
  });
  updateToggleAllBtn();
}

function collapseAll() {
  state.expandedSubjectIds.clear();
  state.expandedContentIds.clear();
  document.querySelectorAll('.subject-card').forEach(card => {
    card.classList.remove('is-expanded');
    card.querySelector('.subject-header')?.setAttribute('aria-expanded', 'false');
  });
  document.querySelectorAll('.content-item-card').forEach(card => {
    card.classList.remove('is-expanded');
    card.querySelector('.content-item-header')?.setAttribute('aria-expanded', 'false');
  });
  updateToggleAllBtn();
}

// --- Tab Switching (Instant Zero-Lag Switch + M3 Sliding Indicator + Shared Axis X) ---
function switchTab(tabName) {
  const prevTab = state.activeTab;
  if (prevTab === tabName) return;
  state.activeTab = tabName;

  // Render target tab BEFORE activating it, and ONLY when data actually changed!
  if (tabName === 'studies' && viewDirty.studies) {
    renderStudiesView();
  } else if (tabName === 'semester' && viewDirty.semester) {
    renderSemesterView();
  }

  const navContainer = document.getElementById('nav-tab-container');
  if (navContainer) {
    navContainer.classList.toggle('is-tab-semester', tabName === 'semester');
  }

  document.querySelectorAll('.tab-btn').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  const enterClass = tabName === 'semester' ? 'enter-forward' : 'enter-backward';

  document.querySelectorAll('.tab-view').forEach(view => {
    const isTarget = view.id === `view-${tabName}`;
    view.classList.remove('enter-forward', 'enter-backward');
    view.classList.toggle('active', isTarget);
    if (isTarget) {
      view.classList.add(enterClass);
    }
  });
}

// --- Language Management (Strictly pt-BR / en-US) ---
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
  renderColorSwatches();
  renderAccountHeaderBtn();
  updateSubjectFormHeading();
  updateSubjectLivePreview();

  const accModal = document.getElementById('account-modal');
  if (accModal && accModal.classList.contains('is-open')) {
    renderAccountModal();
  }
}

function toggleLanguage() {
  const current = getLanguage();
  const next = current === 'pt-BR' ? 'en-US' : 'pt-BR';
  setLanguage(next);

  const generalSubject = state.subjects.find(s => isGeneralSubject(s));
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
  showToast(
    next === 'pt-BR' ? 'Idioma alterado para Português (Brasil)' : 'Language switched to English (US)',
    'info'
  );
}

// --- Subject CRUD (Auto-Save Edit Mode in Tab 2!) ---
function updateSubjectFormHeading() {
  const formTitle = document.getElementById('subject-form-title');
  if (!formTitle) return;

  if (state.editingSubjectId) {
    formTitle.innerHTML = `
      <span class="material-symbols-rounded" style="color:var(--primary);">edit</span>
      <span>${t('edit_subject')}</span>
    `;
  } else {
    formTitle.innerHTML = `
      <span class="material-symbols-rounded" style="color:var(--primary);">library_add</span>
      <span>${t('add_new_subject')}</span>
    `;
  }
}

function setSubjectAutoEditUI(isEditing) {
  const panel = document.getElementById('subject-form-panel');
  const badge = document.getElementById('subject-autosave-badge');
  const createActions = document.getElementById('subject-create-actions');
  const switchRow = document.getElementById('subject-edit-switch-row');

  if (panel) panel.classList.toggle('is-auto-editing', isEditing);
  if (badge) badge.style.display = isEditing ? 'inline-flex' : 'none';
  if (createActions) createActions.style.display = isEditing ? 'none' : 'flex';
  if (switchRow) switchRow.style.display = isEditing ? 'flex' : 'none';

  updateSubjectFormHeading();
}

async function handleSaveSubject(event) {
  event.preventDefault();
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');

  // If currently auto-editing an existing subject, Enter simply flushes save!
  if (state.editingSubjectId) {
    handleSubjectFieldLiveInput();
    saveToStorage(true);
    nameInput?.blur();
    codeInput?.blur();
    return;
  }

  const name = (nameInput?.value || '').trim();
  if (!name) {
    await appAlert(t('alert_enter_subject_name'), { variant: 'warning' });
    nameInput?.focus();
    return;
  }

  const icon = state.selectedIcon || '📚';
  const color = sanitizeColor(state.selectedColor);
  const code = codeInput ? codeInput.value.trim() : '';

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
  showToast(t('toast_subject_added', { name }), 'success');

  if (nameInput) nameInput.value = '';
  if (codeInput) codeInput.value = '';
  const customEmojiInput = document.getElementById('custom-emoji-input');
  if (customEmojiInput) customEmojiInput.value = '';
  state.selectedIcon = PRESET_EMOJIS[0];
  state.selectedColor = PRESET_COLORS[0];
  renderIconPalette();
  renderColorSwatches();
  updateSubjectLivePreview();

  saveToStorage(true);
  renderApp();
}

function editSubject(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  state.editingSubjectId = subject.id;
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');
  const customEmojiInput = document.getElementById('custom-emoji-input');

  if (nameInput) nameInput.value = subject.name || '';
  if (codeInput) codeInput.value = subject.code || '';

  state.selectedColor = sanitizeColor(subject.color || PRESET_COLORS[0]);
  const icon = subject.icon || subject.emoji || '📚';
  state.selectedIcon = icon;

  const hiddenInput = document.getElementById('selected-icon-input');
  if (hiddenInput) hiddenInput.value = icon;
  if (customEmojiInput) {
    customEmojiInput.value = PRESET_EMOJIS.includes(icon) ? '' : icon;
  }

  renderColorSwatches();
  renderIconPalette();
  setSubjectAutoEditUI(true);
  updateSubjectLivePreview();
  renderSemesterView();

  const panel = document.getElementById('subject-form-panel');
  if (panel) {
    panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  nameInput?.focus();
}

function exitSubjectAutoEdit() {
  state.editingSubjectId = null;
  const nameInput = document.getElementById('subject-name-input');
  const codeInput = document.getElementById('subject-code-input');
  const customEmojiInput = document.getElementById('custom-emoji-input');

  if (nameInput) nameInput.value = '';
  if (codeInput) codeInput.value = '';
  if (customEmojiInput) customEmojiInput.value = '';

  state.selectedIcon = PRESET_EMOJIS[0];
  state.selectedColor = PRESET_COLORS[0];

  const hiddenInput = document.getElementById('selected-icon-input');
  if (hiddenInput) hiddenInput.value = state.selectedIcon;

  renderColorSwatches();
  renderIconPalette();
  setSubjectAutoEditUI(false);
  updateSubjectLivePreview();
  renderSemesterView();
}

async function deleteSubject(subjectId) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  if (isGeneralSubject(subject)) {
    showToast(t('general_tasks_cannot_delete'), 'warning');
    return;
  }

  const confirmed = await appConfirm(t('confirm_delete_subject', { name: subject.name }), {
    variant: 'danger',
    confirmText: t('delete_btn')
  });
  if (!confirmed) return;

  if (state.editingSubjectId === subjectId) {
    exitSubjectAutoEdit();
  }

  state.subjects = state.subjects.filter(s => s.id !== subjectId);
  state.expandedSubjectIds.delete(subjectId);
  saveToStorage(true);
  renderApp();
  showToast(t('toast_subject_removed'), 'info');
}

// --- Content CRUD (Notes UI removed, existing notes preserved non-destructively) ---
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
  const titleHeading = document.getElementById('content-modal-title');
  const titleInput = document.getElementById('content-title-input');
  const dateInput = document.getElementById('content-date-input');

  if (titleHeading) titleHeading.textContent = t('modal_add_content_title');
  if (titleInput) titleInput.value = '';
  if (dateInput) dateInput.value = '';

  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.add('is-open');

  requestAnimationFrame(() => titleInput?.focus());
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
  const titleHeading = document.getElementById('content-modal-title');
  const titleInput = document.getElementById('content-title-input');
  const dateInput = document.getElementById('content-date-input');

  if (titleHeading) titleHeading.textContent = t('modal_edit_content_title');
  if (titleInput) titleInput.value = content.title || '';
  if (dateInput) dateInput.value = content.examDate || '';

  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.add('is-open');

  requestAnimationFrame(() => {
    titleInput?.focus();
    titleInput?.select();
  });
}

function closeContentModal() {
  const modal = document.getElementById('content-modal');
  if (modal) modal.classList.remove('is-open');
  state.editingContentData = null;
}

async function handleSaveContentModal(event) {
  event.preventDefault();
  const subjectId = document.getElementById('content-modal-subject-select')?.value;
  const titleInput = document.getElementById('content-title-input');
  const title = (titleInput?.value || '').trim();
  const examDate = document.getElementById('content-date-input')?.value || '';

  if (!title) {
    await appAlert(t('alert_enter_content_title'), { variant: 'warning' });
    titleInput?.focus();
    return;
  }

  if (state.editingContentData) {
    const { subjectId: origSubjectId, contentId } = state.editingContentData;
    const origSubject = state.subjects.find(s => s.id === origSubjectId);
    if (origSubject) {
      const content = (origSubject.contents || []).find(c => c.id === contentId);
      if (content) {
        content.title = title;
        content.examDate = examDate || null;

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
    showToast(t('toast_content_updated', { title }), 'success');
  } else {
    const targetSubject = state.subjects.find(s => s.id === subjectId);
    if (!targetSubject) {
      await appAlert(t('subject_not_found'), { variant: 'warning' });
      return;
    }

    const newContent = {
      id: 'cnt-' + Date.now(),
      title,
      examDate: examDate || null,
      notes: '',
      todos: [],
      completed: false
    };

    targetSubject.contents = targetSubject.contents || [];
    targetSubject.contents.push(newContent);
    state.expandedSubjectIds.add(subjectId);
    state.expandedContentIds.add(newContent.id);
    showToast(t('toast_content_added', { title }), 'success');
  }

  closeContentModal();
  saveToStorage(true);
  renderApp();
}

async function deleteContent(subjectId, contentId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const confirmed = await appConfirm(t('confirm_delete_content', { title: content.title }), {
    variant: 'danger',
    confirmText: t('delete_btn')
  });
  if (!confirmed) return;

  subject.contents = subject.contents.filter(c => c.id !== contentId);
  state.expandedContentIds.delete(contentId);

  saveToStorage(true);
  renderApp();
  showToast(t('toast_content_removed'), 'info');
}

// --- Whole Content & Subject Completion (In-Place Smooth Updates!) ---
function toggleContentCompleted(subjectId, contentId, markCompleted, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const currentCompleted = isContentCompleted(content);
  const targetCompleted = typeof markCompleted === 'boolean' ? markCompleted : !currentCompleted;

  content.completed = targetCompleted;
  if (content.todos && content.todos.length > 0) {
    content.todos.forEach(td => {
      td.completed = targetCompleted;
    });
  }

  if (targetCompleted) {
    fireCelebration();
    showToast(t('toast_content_completed', { title: content.title }), 'success');
  } else {
    showToast(t('toast_content_pending', { title: content.title }), 'info');
  }

  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });
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
      content.todos.forEach(td => {
        td.completed = targetCompleted;
      });
    }
  });

  if (targetCompleted) {
    fireCelebration();
    showToast(t('toast_all_contents_completed', { name: subject.name }), 'success');
  } else {
    showToast(t('toast_all_contents_reset', { name: subject.name }), 'info');
  }

  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, '*', { reRenderTodos: true });
}

// --- To-Do Tasks (In-Place Updates, Undo Toast, Visual Date Feedback) ---
function handleInlineTodoDateChange(contentId, value) {
  const label = document.getElementById(`label-todo-date-${contentId}`);
  const preview = document.getElementById(`preview-todo-date-${contentId}`);
  if (!label || !preview) return;

  if (value) {
    label.classList.add('has-date');
    preview.textContent = formatShortDate(value);
    preview.style.display = 'inline';
  } else {
    label.classList.remove('has-date');
    preview.textContent = '';
    preview.style.display = 'none';
  }
}

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
    id: 'td-' + Date.now() + '-' + Math.random().toString(36).slice(2, 5),
    title: text,
    completed: false,
    dueDate,
    dailyReminder
  });

  // Reset inline add controls smoothly (input stays focused with ZERO parent re-render!)
  input.value = '';
  if (dateInput) dateInput.value = '';
  handleInlineTodoDateChange(contentId, '');
  if (dailyBtn) dailyBtn.classList.remove('is-active');

  content.completed = false;

  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });
  input.focus();
}

function toggleTodoDailyReminder(subjectId, contentId, todoId, event) {
  if (event) event.stopPropagation();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(td => td.id === todoId);
  if (!todo) return;

  todo.dailyReminder = !todo.dailyReminder;
  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });
}

function handleTodoDueDateChange(subjectId, contentId, todoId, newDate, event) {
  if (event) event.stopPropagation();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(td => td.id === todoId);
  if (!todo) return;

  todo.dueDate = newDate || null;
  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });
}

function clearTodoDueDate(subjectId, contentId, todoId, event) {
  if (event) event.stopPropagation();
  handleTodoDueDateChange(subjectId, contentId, todoId, null);
}

function toggleInlineDailyReminderBtn(contentId) {
  const btn = document.getElementById(`input-todo-daily-${contentId}`);
  if (btn) {
    btn.classList.toggle('is-active');
  }
}

function toggleTodoStatus(subjectId, contentId, todoId, completed, checkboxEl = null) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const todo = (content.todos || []).find(td => td.id === todoId);
  if (!todo) return;

  todo.completed = completed;
  const allCompleted = content.todos.length > 0 && content.todos.every(td => td.completed);
  content.completed = allCompleted;

  // Immediate visual feedback on the row so spring checkbox bounce plays uninterrupted
  const rowEl = checkboxEl?.closest?.('.todo-row')
    || document.querySelector(`#todo-list-${contentId} .todo-row[data-todo-id="${todoId}"]`);
  if (rowEl) {
    rowEl.classList.toggle('completed', completed);
  }

  const progress = getContentProgress(content);
  if (completed && progress.percent === 100 && progress.total > 0) {
    fireCelebration();
    showToast(t('toast_tasks_100_percent', { title: content.title }), 'success');
  }

  saveToStorage(true);
  // Smoothly animate progress bars & content checkbox in-place immediately
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: false });

  // After checkbox spring bounce finishes, tidily re-sort the todo list in-place
  if (todoResortTimers.has(contentId)) {
    clearTimeout(todoResortTimers.get(contentId));
  }
  todoResortTimers.set(contentId, setTimeout(() => {
    todoResortTimers.delete(contentId);
    const listEl = document.getElementById(`todo-list-${contentId}`);
    if (listEl) {
      listEl.innerHTML = renderTodos(subjectId, content);
    }
  }, 360));
}

function deleteTodo(subjectId, contentId, todoId, event) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  const todos = content.todos || [];
  const removedIndex = todos.findIndex(td => td.id === todoId);
  if (removedIndex === -1) return;

  const removedSnapshot = { ...todos[removedIndex] };
  content.todos = todos.filter(td => td.id !== todoId);

  if (content.todos.length > 0) {
    content.completed = content.todos.every(td => td.completed);
  }

  saveToStorage(true);
  syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });

  // One UI Toast with 1-tap Undo ("Desfazer")
  showToast(t('toast_task_removed'), 'info', {
    actionLabel: t('undo_btn'),
    duration: 5000,
    onAction: () => {
      const targetSubject = state.subjects.find(s => s.id === subjectId);
      const targetContent = targetSubject && (targetSubject.contents || []).find(c => c.id === contentId);
      if (!targetContent) return;

      targetContent.todos = targetContent.todos || [];
      if (!targetContent.todos.some(td => td.id === removedSnapshot.id)) {
        const insertAt = Math.min(removedIndex, targetContent.todos.length);
        targetContent.todos.splice(insertAt, 0, removedSnapshot);
        targetContent.completed = targetContent.todos.every(td => td.completed);
        saveToStorage(true);
        syncSubjectCardInPlace(subjectId, contentId, { reRenderTodos: true });
      }
    }
  });
}

// --- Inline Editing & Date Handlers ---
function handleTodoTitleBlur(subjectId, contentId, todoId, el) {
  const newTitle = el.textContent.trim();
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;
  const todo = (content.todos || []).find(td => td.id === todoId);
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

function handleInlineDateChange(subjectId, contentId, newDate) {
  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;
  const content = (subject.contents || []).find(c => c.id === contentId);
  if (!content) return;

  content.examDate = newDate || null;
  saveToStorage(true);
  renderApp();
}

function clearContentExamDate(subjectId, contentId, event) {
  if (event) event.stopPropagation();
  handleInlineDateChange(subjectId, contentId, null);
}

// --- Search & Filters ---
function syncSearchClearBtn() {
  const clearBtn = document.getElementById('search-clear-btn');
  if (!clearBtn) return;
  clearBtn.classList.toggle('is-visible', state.searchQuery.trim().length > 0);
}

function handleSearch(event) {
  state.searchQuery = event.target.value;
  syncSearchClearBtn();
  renderStudiesView();
}

function clearSearch() {
  state.searchQuery = '';
  const input = document.getElementById('search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  syncSearchClearBtn();
  renderStudiesView();
}

// --- Backup Export & Restore (Lives inside Account Modal) ---
function exportData() {
  const jsonStr = JSON.stringify(state.subjects, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gorit_backup_${getLocalTodayDateStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast(t('toast_backup_exported'), 'success');
}

function triggerRestoreBackup() {
  const fileInput = document.getElementById('account-restore-file-input');
  if (fileInput) {
    fileInput.value = '';
    fileInput.click();
  }
}

function importData(event) {
  const file = event.target.files?.[0];
  event.target.value = ''; // Allow restoring the same file again
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (Array.isArray(data)) {
        state.subjects = data;
        ensureGeneralTasksSubject();
        state.expandedSubjectIds.clear();
        state.expandedContentIds.clear();
        if (state.editingSubjectId) exitSubjectAutoEdit();
        saveToStorage(true);
        renderApp();
        closeAccountModal();
        showToast(t('toast_data_restored'), 'success');
      } else {
        await appAlert(t('alert_invalid_json'), { variant: 'warning' });
      }
    } catch (err) {
      await appAlert(t('alert_error_reading_json', { error: err.message }), { variant: 'danger' });
    }
  };
  reader.readAsText(file);
}

// --- Master Render Function ---
function renderApp() {
  renderStats();
  if (state.activeTab === 'studies') {
    viewDirty.semester = true;
    renderStudiesView();
  } else if (state.activeTab === 'semester') {
    viewDirty.studies = true;
    renderSemesterView();
  }
}

// --- User Account, Local Backup & Timestamped Cloud Sync ---
function getGoritCambluTierLabel(tier) {
  const key = `camblu_tier_${String(tier || '').trim().toLowerCase()}`;
  const translated = t(key);
  return translated !== key ? translated : 'Raro';
}

function buildGoogleProChipHtml({ label = 'Pro' } = {}) {
  return `<div class="kykVM" aria-hidden="true"><img src="assets/img/pro_tier_wave.svg" class="oU5yj" alt="" role="presentation"><span class="YzbLde">${escapeHtml(label || 'Pro')}</span></div>`;
}

function buildGoogleProfileAvatarHtml({ photoUrl = '', displayName = '', isPro = false } = {}) {
  const safePhoto = sanitizeImageUrl(photoUrl);
  const initial = escapeHtml((displayName || 'U')[0].toUpperCase());
  const inner = safePhoto
    ? `<img src="${escapeHtml(safePhoto)}" class="google-pro-avatar-img" style="${isPro ? '' : 'border:1px solid #dadce0;'}" alt="${escapeHtml(displayName)}" referrerpolicy="no-referrer" />`
    : `<div class="account-user-avatar-placeholder" style="width:100%;height:100%;margin:0;">${initial}</div>`;
  const ring = isPro
    ? `<img src="assets/img/pro_avatar_ring.png" alt="" aria-hidden="true" class="google-pro-avatar-ring" />`
    : '';
  return `<div class="google-pro-avatar-wrap ${isPro ? 'is-pro' : ''}" style="width:64px;height:64px;">${inner}${ring}</div>`;
}

function appendProRingOverlay(container) {
  const ring = document.createElement('img');
  ring.src = 'assets/img/pro_avatar_ring.png';
  ring.alt = '';
  ring.setAttribute('aria-hidden', 'true');
  ring.className = 'google-pro-avatar-ring';
  container.appendChild(ring);
}

function renderAccountHeaderBtn() {
  const avatarWrap = document.getElementById('account-btn-avatar-wrap');
  const label = document.getElementById('account-btn-label');
  if (!label || !avatarWrap) return;

  // Rebuild avatar wrap safely using DOM APIs (zero outerHTML injection!)
  avatarWrap.textContent = '';
  avatarWrap.classList.remove('is-pro');

  const appendDefaultIcon = () => {
    avatarWrap.textContent = '';
    const iconEl = document.createElement('span');
    iconEl.className = 'material-symbols-rounded account-pill-default-icon';
    iconEl.textContent = 'account_circle';
    avatarWrap.appendChild(iconEl);
  };

  if (state.currentUser) {
    const firstName = (state.currentUser.displayName || state.currentUser.email || '').split(' ')[0]
      || t('account_default_label');
    label.textContent = firstName;

    if (state.isPro) {
      avatarWrap.classList.add('is-pro');
    }

    const safePhoto = sanitizeImageUrl(state.currentUser.photoURL);
    if (safePhoto) {
      const img = document.createElement('img');
      img.src = safePhoto;
      img.className = 'account-avatar-img';
      img.alt = firstName;
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => {
        appendDefaultIcon();
        if (state.isPro) appendProRingOverlay(avatarWrap);
      };
      avatarWrap.appendChild(img);
    } else {
      appendDefaultIcon();
    }

    if (state.isPro) {
      appendProRingOverlay(avatarWrap);
    }
  } else {
    appendDefaultIcon();
    label.textContent = t('auth_sign_in_short');
  }
}

function buildAccountBackupBoxHtml() {
  return `
    <div class="google-profile-row" style="display:flex;flex-direction:column;gap:0.65rem;">
      <div class="account-plan-header">
        <span class="account-plan-title" style="color:#1f1f1f;font-size:0.85rem;">${t('account_data_backup_title')}</span>
        <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">folder_zip</span>
      </div>
      <p class="account-plan-desc" style="color:#444746;">${t('account_data_backup_desc')}</p>
      <div class="m3-btn-group m3-btn-group-full">
        <button type="button" class="m3-btn-group-item m3-group-sky" onclick="exportData()" title="${escapeHtml(t('backup_title'))}">
          <span class="material-symbols-rounded icon-sm">download</span>
          <span>${t('backup_button')}</span>
        </button>
        <button type="button" class="m3-btn-group-item m3-group-blue" onclick="triggerRestoreBackup()" title="${escapeHtml(t('restore_title'))}">
          <span class="material-symbols-rounded icon-sm">upload</span>
          <span>${t('restore_button')}</span>
        </button>
      </div>
    </div>
  `;
}

function renderAccountModal() {
  const body = document.getElementById('account-modal-body');
  if (!body) return;

  if (!state.currentUser) {
    body.innerHTML = `
      <div class="google-profile-card">
        <div class="account-login-hero" style="padding:0.75rem 0.25rem;">
          <div class="account-login-hero-icon" style="background:#f0f4f9;color:#3b82f7;border:1px solid #dce3ee;">
            <span class="material-symbols-rounded">cloud_sync</span>
          </div>
          <div>
            <h4 style="color:#1f1f1f;">${t('auth_sign_in')}</h4>
            <p style="color:#444746;">${t('account_login_prompt_desc')}</p>
          </div>
          <button type="button" class="btn btn-primary" onclick="handleGoogleSignIn()">
            <span class="material-symbols-rounded icon-sm">login</span>
            <span>${t('auth_sign_in')}</span>
          </button>
        </div>
      </div>

      <div class="google-profile-group">
        ${buildAccountBackupBoxHtml()}
      </div>
    `;
    return;
  }

  const user = state.currentUser;
  const isPro = state.isPro;
  const proStatus = getUserProStatus(user);
  const isCambluPro = Boolean(
    isPro && (proStatus?.provider === 'camblu_clube' || proStatus?.proSource === 'camblu_clube')
  );
  const cambluTierSlug = String(proStatus?.tier || proStatus?.cambluClube?.tier || 'raro').toLowerCase();
  const cambluTierLabel = getGoritCambluTierLabel(cambluTierSlug);
  const cambluValidUntil = proStatus?.validUntil || proStatus?.cambluClube?.validUntil || null;
  const locale = getLanguage() === 'en-US' ? 'en-US' : 'pt-BR';
  const validUntilFormatted = cambluValidUntil ? new Date(cambluValidUntil).toLocaleDateString(locale) : null;
  const isCambluComum = Boolean(!isPro && proStatus?.cambluClube?.active && Number(proStatus?.cambluClube?.tierCode) === 1);

  const safeDisplayName = escapeHtml(user.displayName || t('account_default_student'));
  const safeEmail = escapeHtml(user.email || '');
  const photoHtml = buildGoogleProfileAvatarHtml({
    photoUrl: user.photoURL,
    displayName: safeDisplayName,
    isPro
  });

  let planBadgeHtml = '';
  if (isCambluPro) {
    planBadgeHtml = buildGoogleProChipHtml({ label: t('account_camblu_badge', { tier: cambluTierLabel }) });
  } else if (isPro) {
    planBadgeHtml = buildGoogleProChipHtml({ label: 'Pro' });
  } else {
    planBadgeHtml = `<span class="google-profile-free-pill"><span class="material-symbols-rounded icon-sm">lock</span>${t('account_free_badge')}</span>`;
  }

  const lastSyncedStr = state.lastCloudSync
    ? t('cloud_last_synced', { time: new Date(state.lastCloudSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) })
    : t('cloud_never_synced');

  body.innerHTML = `
    <!-- User Profile Hero Card -->
    <div class="google-profile-card">
      <div class="google-profile-hero">
        ${photoHtml}
        <div class="google-profile-hero-meta">
          <span class="google-profile-hero-name">${safeDisplayName}</span>
          <span class="google-profile-hero-email">${safeEmail}</span>
          <div class="google-profile-hero-badge">
            ${planBadgeHtml}
          </div>
        </div>
      </div>
    </div>

    <!-- Plan Status & Quick Links Group -->
    <div class="google-profile-group">
      <div class="google-profile-row" style="display:flex;flex-direction:column;gap:0.55rem;">
        <div class="account-plan-header">
          <span class="account-plan-title" style="color:#1f1f1f;font-size:0.85rem;">${t('account_status_label')}</span>
          ${isPro ? `<span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">verified</span>` : ''}
        </div>
        <p class="account-plan-desc" style="color:#444746;">
          ${isCambluPro
            ? escapeHtml(t('account_camblu_pro_desc', { tier: cambluTierLabel }))
            : (isPro ? t('account_pro_desc') : t('account_free_desc'))}
        </p>
        ${isCambluPro && validUntilFormatted ? `
          <div class="account-plan-meta" style="color:#444746;">
            <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">event_available</span>
            <span>${escapeHtml(t('account_camblu_valid_until', { date: validUntilFormatted }))}</span>
          </div>
        ` : ''}
        ${!isPro ? `
          <div class="account-camblu-hint">
            <span class="material-symbols-rounded icon-sm" style="color:#3b82f7;flex-shrink:0;">card_membership</span>
            <span>${escapeHtml(isCambluComum ? t('account_camblu_comum_hint') : t('account_camblu_free_hint'))}</span>
          </div>
        ` : ''}
      </div>

      ${isCambluPro ? `
        <a href="https://camblu.web.app/clube" target="_blank" rel="noopener noreferrer" class="google-profile-row google-profile-row-link">
          <span class="google-profile-row-leading">
            <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">card_membership</span>
            <span>${t('account_camblu_portal_btn')}</span>
          </span>
          <span class="material-symbols-rounded icon-sm" style="color:#444746;">open_in_new</span>
        </a>
      ` : ''}

      ${isPro ? `
        <a href="https://flashcards.camblu.org/" target="_blank" rel="noopener noreferrer" class="google-profile-row google-profile-row-link">
          <span class="google-profile-row-leading">
            <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">style</span>
            <span>${t('account_open_flashcards_btn')}</span>
          </span>
          <span class="material-symbols-rounded icon-sm" style="color:#444746;">open_in_new</span>
        </a>
      ` : `
        <a href="https://flashcards.camblu.org/" target="_blank" rel="noopener noreferrer" class="google-profile-row google-profile-row-link" style="color:#0b57d0;font-weight:600;">
          <span class="google-profile-row-leading">
            <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">auto_awesome</span>
            <span>${t('account_upgrade_btn')}</span>
          </span>
          <span class="material-symbols-rounded icon-sm" style="color:#0b57d0;">open_in_new</span>
        </a>
      `}
    </div>

    <!-- Cloud Sync & Local Backup Group -->
    <div class="google-profile-group">
      <div class="google-profile-row" style="display:flex;flex-direction:column;gap:0.45rem;">
        <div class="account-cloud-header">
          <div class="account-cloud-status" style="color:#1f1f1f;">
            <span class="cloud-dot ${isPro ? (state.isSyncingCloud ? 'syncing' : 'active') : ''}"></span>
            <span>${isPro ? (state.isSyncingCloud ? t('cloud_sync_status_pending') : t('cloud_sync_status_synced')) : t('cloud_sync_status_offline')}</span>
          </div>
          ${isPro ? `
            <button type="button" class="btn btn-outline btn-sm" onclick="handleManualCloudSync()" ${state.isSyncingCloud ? 'disabled' : ''}>
              <span class="material-symbols-rounded icon-sm ${state.isSyncingCloud ? 'm3-spin' : ''}">${state.isSyncingCloud ? 'progress_activity' : 'cloud_sync'}</span>
              <span>${t('cloud_sync_now_btn')}</span>
            </button>
          ` : ''}
        </div>
        <span class="account-cloud-time" style="color:#444746;">${escapeHtml(lastSyncedStr)}</span>
      </div>

      ${buildAccountBackupBoxHtml()}
    </div>

    <!-- Sign Out Pill -->
    <div class="google-profile-group">
      <button type="button" class="google-profile-row google-profile-row-link" style="justify-content:center;color:#d93025;" onclick="handleGoogleSignOut()">
        <span class="material-symbols-rounded icon-sm">logout</span>
        <span>${t('auth_sign_out')}</span>
      </button>
    </div>
  `;
}

function openAccountModal() {
  const modal = document.getElementById('account-modal');
  if (!modal) return;

  renderAccountModal();
  modal.classList.add('is-open');

  if (state.currentUser) {
    fetchUserProStatus(state.currentUser).then(() => {
      state.isPro = isUserPro(state.currentUser);
      renderAccountHeaderBtn();
      if (modal.classList.contains('is-open')) {
        renderAccountModal();
      }
    }).catch(() => {});
  }
}

function closeAccountModal() {
  const modal = document.getElementById('account-modal');
  if (modal) modal.classList.remove('is-open');
}

async function handleGoogleSignIn() {
  try {
    const user = await signInWithGoogle();
    if (user) {
      await onUserAuthenticated(user);
      renderAccountModal();
      showToast(t('auth_signed_in_as', { name: user.displayName || user.email }), 'success');
    }
  } catch (err) {
    console.error('Sign-in failed:', err);
    showToast(t('auth_signin_error'), 'danger');
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
    showToast(t('auth_signout_success'), 'info');
  } catch (err) {
    console.error('Sign-out failed:', err);
  }
}

async function handleManualCloudSync() {
  if (!state.currentUser || !state.isPro) return;
  state.isSyncingCloud = true;
  renderAccountModal();

  const ts = stampLocalUpdatedAt();
  const res = await saveGoritToCloud(state.subjects, ts);
  state.isSyncingCloud = false;

  if (res && res.success) {
    state.lastCloudSync = res.timestamp;
    showToast(t('cloud_sync_success_toast'), 'success');
  } else {
    showToast(t('cloud_sync_error_toast'), 'danger');
  }
  renderAccountModal();
}

/**
 * Timestamp-protected Cloud Sync Reconciliation:
 * - New user (cloud empty, local has data): uploads local data immediately so nothing is lost.
 * - Cloud has data, local empty: pulls cloud data cleanly.
 * - Both have data: compares timestamps — newer version ALWAYS wins and overwrites the older one!
 */
async function onUserAuthenticated(user) {
  state.currentUser = user;
  renderAccountHeaderBtn();

  await fetchUserProStatus(user);
  state.isPro = isUserPro(user);
  renderAccountHeaderBtn();

  const accModal = document.getElementById('account-modal');
  if (accModal && accModal.classList.contains('is-open')) {
    renderAccountModal();
  }

  if (!state.isPro) return;

  state.isSyncingCloud = true;
  if (accModal && accModal.classList.contains('is-open')) {
    renderAccountModal();
  }

  try {
    const cloudGorit = await loadGoritFromCloud();
    const cloudHasData = Boolean(
      cloudGorit && Array.isArray(cloudGorit.subjects) && hasMeaningfulUserData(cloudGorit.subjects)
    );
    const localHasData = hasMeaningfulUserData(state.subjects);

    const cloudTime = cloudGorit?.updatedAt ? (Date.parse(cloudGorit.updatedAt) || 0) : 0;
    const localTime = state.localUpdatedAt ? (Date.parse(state.localUpdatedAt) || 0) : 0;

    if (!cloudHasData && localHasData) {
      // New user or empty cloud: upload local data immediately so user never loses existing studies!
      const uploadTs = state.localUpdatedAt || stampLocalUpdatedAt();
      const res = await saveGoritToCloud(state.subjects, uploadTs);
      if (res && res.success) {
        state.lastCloudSync = res.timestamp;
      }
    } else if (cloudHasData && !localHasData) {
      // Fresh device: pull cloud data locally
      state.subjects = cloudGorit.subjects;
      ensureGeneralTasksSubject();
      const syncedTs = cloudGorit.updatedAt || new Date().toISOString();
      stampLocalUpdatedAt(syncedTs);
      state.lastCloudSync = syncedTs;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
      renderApp();
      syncToServer(true);
    } else if (cloudHasData && localHasData) {
      // Both exist: newer timestamp ALWAYS overwrites the older one!
      if (localTime > cloudTime) {
        const res = await saveGoritToCloud(state.subjects, state.localUpdatedAt);
        if (res && res.success) {
          state.lastCloudSync = res.timestamp;
        }
      } else {
        state.subjects = cloudGorit.subjects;
        ensureGeneralTasksSubject();
        const syncedTs = cloudGorit.updatedAt || new Date().toISOString();
        stampLocalUpdatedAt(syncedTs);
        state.lastCloudSync = syncedTs;
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
        renderApp();
        syncToServer(true);
      }
    } else if (cloudGorit?.updatedAt) {
      state.lastCloudSync = cloudGorit.updatedAt;
    }
  } finally {
    state.isSyncingCloud = false;
    if (accModal && accModal.classList.contains('is-open')) {
      renderAccountModal();
    }
  }

  // Real-time listener: strictly accepts only remote versions NEWER than localUpdatedAt
  if (state.cloudUnsubscribe) {
    state.cloudUnsubscribe();
    state.cloudUnsubscribe = null;
  }
  state.cloudUnsubscribe = listenGoritCloud((cloudData) => {
    if (!cloudData || !Array.isArray(cloudData.subjects)) return;
    if (isSyncingToServer || state.isSyncingCloud) return;

    const remoteTime = cloudData.updatedAt ? (Date.parse(cloudData.updatedAt) || 0) : 0;
    const currentLocalTime = state.localUpdatedAt ? (Date.parse(state.localUpdatedAt) || 0) : 0;

    if (remoteTime > currentLocalTime && cloudData.updatedAt !== state.lastCloudSync) {
      state.subjects = cloudData.subjects;
      ensureGeneralTasksSubject();
      stampLocalUpdatedAt(cloudData.updatedAt);
      state.lastCloudSync = cloudData.updatedAt;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.subjects));
      renderApp();
      syncToServer(true);
    }
  });
}

// --- PRO Subject Sharing via Direct Link (with Loading Spinner & Shimmer Skeleton!) ---
let pendingImportShareData = null;

async function handleShareSubject(subjectId, event, triggerBtn = null) {
  if (event) event.stopPropagation();

  const subject = state.subjects.find(s => s.id === subjectId);
  if (!subject) return;

  if (!state.currentUser || !state.isPro) {
    const proModal = document.getElementById('share-pro-modal');
    if (proModal) proModal.classList.add('is-open');
    return;
  }

  const btn = triggerBtn || event?.currentTarget || null;
  if (btn && btn.disabled) return;

  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-rounded icon-sm m3-spin">progress_activity</span><span>${t('sharing_loading_btn')}</span>`;
  }

  try {
    const res = await shareSubjectToCloud(subject);
    if (res && res.success) {
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
      if (modal) modal.classList.add('is-open');
    } else {
      showToast(t('share_error_toast'), 'danger');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

function closeShareLinkModal() {
  const modal = document.getElementById('share-link-modal');
  if (modal) modal.classList.remove('is-open');
}

function closeShareProModal() {
  const modal = document.getElementById('share-pro-modal');
  if (modal) modal.classList.remove('is-open');
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
    showToast(t('share_subject_copied'), 'success');
    setTimeout(() => {
      if (btnText) btnText.textContent = t('share_subject_copy_btn');
    }, 2500);
  } catch {
    inputEl.select();
  }
}

function buildImportShareSkeletonHtml() {
  return `
    <div class="skeleton-head">
      <div class="skeleton-block skeleton-icon-box"></div>
      <div class="skeleton-title-col">
        <div class="skeleton-block skeleton-line lg"></div>
        <div class="skeleton-block skeleton-line md"></div>
      </div>
    </div>
    <div class="skeleton-block skeleton-line row"></div>
    <div class="skeleton-block skeleton-line row-short"></div>
    <div class="skeleton-block skeleton-line row"></div>
  `;
}

async function checkForSharedSubjectUrl() {
  const params = new URLSearchParams(window.location.search);
  const shareSlug = params.get('share');
  if (!shareSlug) return;

  const modal = document.getElementById('import-share-modal');
  const previewBox = document.getElementById('import-share-preview-box');
  const subtitle = document.getElementById('import-share-subtitle');
  const titleEl = document.getElementById('import-share-modal-title');
  const confirmBtn = document.getElementById('import-share-confirm-btn');

  // Show immediate Shimmer Skeleton loading modal while fetching from Firestore
  pendingImportShareData = null;
  if (titleEl) titleEl.textContent = t('import_share_loading_title');
  if (subtitle) subtitle.textContent = t('import_share_loading_desc');
  if (previewBox) previewBox.innerHTML = buildImportShareSkeletonHtml();
  if (confirmBtn) confirmBtn.disabled = true;
  if (modal) modal.classList.add('is-open');

  try {
    const sharedDoc = await loadSharedSubjectFromCloud(shareSlug);
    if (!sharedDoc || !sharedDoc.subjectData) {
      closeImportShareModal();
      showToast(t('share_invalid_link_toast'), 'warning');
      return;
    }

    pendingImportShareData = sharedDoc.subjectData;
    if (titleEl) titleEl.textContent = t('import_share_title');
    if (subtitle) {
      subtitle.textContent = sharedDoc.sharedBy?.name
        ? t('import_share_shared_by', { name: sharedDoc.sharedBy.name })
        : t('import_share_subtitle_default');
    }

    if (previewBox) {
      const sub = sharedDoc.subjectData;
      const contentsCount = (sub.contents || []).length;
      const countText = contentsCount === 1
        ? t('import_share_contents_singular')
        : t('import_share_contents_plural', { count: contentsCount });

      previewBox.innerHTML = `
        <div class="import-preview-head">
          <div class="subject-icon-box" style="--subject-color: ${sanitizeColor(sub.color)}">
            ${renderSubjectIcon(sub)}
          </div>
          <div>
            <div class="import-preview-title">
              ${escapeHtml(sub.name)}
              ${sub.code ? `<span class="subject-code-tag">(${escapeHtml(sub.code)})</span>` : ''}
            </div>
            <div class="import-preview-sub">${escapeHtml(countText)}</div>
          </div>
        </div>
        ${(sub.contents || []).slice(0, 4).map(c => `
          <div class="import-preview-row">
            <span>• ${escapeHtml(c.title)}</span>
            ${c.examDate ? `<span class="import-preview-date">${escapeHtml(formatDate(c.examDate))}</span>` : ''}
          </div>
        `).join('')}
        ${contentsCount > 4 ? `<div class="import-preview-more">${escapeHtml(t('import_share_more_topics', { count: contentsCount - 4 }))}</div>` : ''}
      `;
    }

    if (confirmBtn) confirmBtn.disabled = false;
  } catch (err) {
    console.error('Error checking shared link:', err);
    closeImportShareModal();
    showToast(t('share_invalid_link_toast'), 'warning');
  }
}

function closeImportShareModal() {
  const modal = document.getElementById('import-share-modal');
  if (modal) modal.classList.remove('is-open');
  pendingImportShareData = null;
  if (window.location.search.includes('share=')) {
    window.history.replaceState({}, '', window.location.pathname);
  }
}

function confirmImportSharedSubject() {
  if (!pendingImportShareData) return;

  const nowId = Date.now();
  const newSubject = {
    ...pendingImportShareData,
    id: 'sub-' + nowId,
    color: sanitizeColor(pendingImportShareData.color),
    contents: (pendingImportShareData.contents || []).map((c, idx) => {
      const { isCompleted: _legacyIgnored, ...rest } = c;
      return {
        ...rest,
        id: `cnt-${nowId}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        completed: false,
        todos: []
      };
    })
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

// --- Expose Global Handlers for HTML Event Attributes ---
window.switchTab = switchTab;
window.jumpToNextExam = jumpToNextExam;
window.exportData = exportData;
window.triggerRestoreBackup = triggerRestoreBackup;
window.importData = importData;
window.expandAll = expandAll;
window.collapseAll = collapseAll;
window.toggleExpandCollapseAll = toggleExpandCollapseAll;
window.handleSearch = handleSearch;
window.clearSearch = clearSearch;
window.dismissChronoHint = dismissChronoHint;
window.handleSaveSubject = handleSaveSubject;
window.handleSubjectFieldLiveInput = handleSubjectFieldLiveInput;
window.editSubject = editSubject;
window.exitSubjectAutoEdit = exitSubjectAutoEdit;
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
window.clearContentExamDate = clearContentExamDate;
window.handleInlineAddTodo = handleInlineAddTodo;
window.handleInlineTodoDateChange = handleInlineTodoDateChange;
window.toggleTodoStatus = toggleTodoStatus;
window.deleteTodo = deleteTodo;
window.handleTodoTitleBlur = handleTodoTitleBlur;
window.handleTodoTitleKeydown = handleTodoTitleKeydown;
window.toggleTodoDailyReminder = toggleTodoDailyReminder;
window.handleTodoDueDateChange = handleTodoDueDateChange;
window.clearTodoDueDate = clearTodoDueDate;
window.toggleInlineDailyReminderBtn = toggleInlineDailyReminderBtn;
window.toggleLanguage = toggleLanguage;
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

// Global Escape key handler to close any open modal overlay
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
  updateSubjectLivePreview();
  loadFromStorage();
  checkForSharedSubjectUrl();
  initAuthSync();
});
