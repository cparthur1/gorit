// SPDX-License-Identifier: GPL-2.0-only
/**
 * js/firebase-client.js
 * Firebase Web SDK integration (Modular ES Modules - Zero Build Step)
 * Shared Auth & Cloud Firestore with Flashcards (Project: flashcards-ead57)
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import {
  getAuth,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDoc,
  setDoc,
  onSnapshot
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: atob('QUl6YVN5QnFaa1ZoOWpmNDlFZXB3clpwWWNkSFVfX3dGcXphWWFr'),
  authDomain: "flashcards-ead57.firebaseapp.com",
  projectId: "flashcards-ead57",
  storageBucket: "flashcards-ead57.firebasestorage.app",
  messagingSenderId: "771727467889",
  appId: "1:771727467889:web:2bbd7c4f85d794074b82d0",
  measurementId: "G-SPVWZ9SG8P"
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Cloud Firestore with ignoreUndefinedProperties
let firestoreDb;
try {
  firestoreDb = initializeFirestore(app, { ignoreUndefinedProperties: true });
} catch (e) {
  firestoreDb = getFirestore(app);
}
export const db = firestoreDb;

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Flashcards Lifetime PRO accounts
export const LIFETIME_PRO_EMAILS = [
  'arthur.paludo.c@gmail.com',
  'clarazanchett@gmail.com',
  'manuelapinhadias@gmail.com'
];

export const BACKEND_URL = 'https://flashcards-backend.camblu.workers.dev';

export function isLifetime(user) {
  if (!user || !user.email) return false;
  return LIFETIME_PRO_EMAILS.includes(user.email.toLowerCase().trim());
}

let cachedUserProStatus = null;

/**
 * Checks whether user has active PRO status (lifetime, stripe subscription or backend token)
 */
export function isUserPro(user = auth.currentUser) {
  if (!user) return false;
  if (isLifetime(user)) return true;
  if (user.pro === true) return true;

  if (cachedUserProStatus && cachedUserProStatus.uid === user.uid) {
    return Boolean(cachedUserProStatus.isPro || cachedUserProStatus.subscription?.status === 'active');
  }

  try {
    const local = localStorage.getItem(`gorit_pro_cache_${user.uid}`);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.isPro || parsed.subscription?.status === 'active')) {
        return true;
      }
    }
  } catch (e) {}

  return false;
}

/**
 * Validates active subscription status with Flashcards backend
 */
export async function fetchUserProStatus(user = auth.currentUser) {
  if (!user) {
    cachedUserProStatus = null;
    return { isPro: false };
  }

  if (isLifetime(user)) {
    cachedUserProStatus = { uid: user.uid, isPro: true, plan: 'pro_lifetime' };
    try { localStorage.setItem(`gorit_pro_cache_${user.uid}`, JSON.stringify(cachedUserProStatus)); } catch (e) {}
    return cachedUserProStatus;
  }

  try {
    const token = await user.getIdToken();
    const res = await fetch(`${BACKEND_URL}/api/user/status`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    });

    if (res.ok) {
      const data = await res.json();
      cachedUserProStatus = {
        uid: user.uid,
        isPro: Boolean(data.isPro || data.subscription?.status === 'active'),
        plan: data.subscription?.plan || 'pro_monthly',
        status: data.subscription?.status || 'active'
      };
      try { localStorage.setItem(`gorit_pro_cache_${user.uid}`, JSON.stringify(cachedUserProStatus)); } catch (e) {}
      return cachedUserProStatus;
    }
  } catch (e) {
    console.warn('[Gorit Auth] Backend status check fallback to cache:', e);
  }

  try {
    const local = localStorage.getItem(`gorit_pro_cache_${user.uid}`);
    if (local) {
      cachedUserProStatus = JSON.parse(local);
      return cachedUserProStatus;
    }
  } catch (e) {}

  return { isPro: false };
}

/**
 * Sign in with Google Popup
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error) {
    if (error.code === 'auth/popup-closed-by-user') {
      return null;
    }
    console.error('[Gorit Auth] Google Sign-In error:', error);
    throw error;
  }
}

/**
 * Sign out from Firebase
 */
export async function signOutUser() {
  try {
    await signOut(auth);
    cachedUserProStatus = null;
  } catch (error) {
    console.error('[Gorit Auth] Sign out error:', error);
    throw error;
  }
}

/**
 * Listen to auth state changes
 */
export function onAuthChange(callback) {
  return onAuthStateChanged(auth, callback);
}

/**
 * Saves Gorit subjects & progress to Cloud Firestore for PRO users
 */
export async function saveGoritToCloud(subjects) {
  const user = auth.currentUser;
  if (!user) return { success: false, reason: 'not_authenticated' };
  if (!isUserPro(user)) return { success: false, reason: 'not_pro' };

  try {
    const now = new Date().toISOString();
    // Uses merge: true to avoid overwriting Flashcards deckSlots or other user data
    await setDoc(doc(db, 'users', user.uid), {
      gorit: {
        subjects: subjects || [],
        updatedAt: now,
        clientVersion: '1.1.0'
      }
    }, { merge: true });

    return { success: true, timestamp: now };
  } catch (e) {
    console.error('[Gorit Cloud] Save error:', e);
    return { success: false, error: e };
  }
}

/**
 * Loads Gorit subjects from Cloud Firestore for PRO users
 */
export async function loadGoritFromCloud() {
  const user = auth.currentUser;
  if (!user) return null;
  if (!isUserPro(user)) return null;

  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.gorit && Array.isArray(data.gorit.subjects)) {
        return data.gorit;
      }
    }
  } catch (e) {
    console.error('[Gorit Cloud] Load error:', e);
  }
  return null;
}

/**
 * Real-time listener for Firestore changes across devices (PRO users)
 */
export function listenGoritCloud(callback) {
  const user = auth.currentUser;
  if (!user || !isUserPro(user)) return () => {};

  return onSnapshot(doc(db, 'users', user.uid), (snap) => {
    if (snap.exists()) {
      const data = snap.data();
      if (data && data.gorit && Array.isArray(data.gorit.subjects)) {
        callback(data.gorit);
      }
    }
  }, (err) => {
    console.warn('[Gorit Cloud] Snapshot listener warning:', err);
  });
}

/**
 * Shares a single subject to Firestore 'shares' collection (Flashcards PRO Feature)
 * Preserves contents & exam deadlines, but friend gets independent subtasks and completion
 */
export async function shareSubjectToCloud(subject) {
  const user = auth.currentUser;
  if (!user) return { success: false, reason: 'not_authenticated' };
  if (!isUserPro(user)) return { success: false, reason: 'not_pro' };
  if (!subject) return { success: false, reason: 'invalid_subject' };

  try {
    const shareSlug = `gorit-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    
    // Clean contents: preserve titles, exam dates, notes, but provide fresh empty completion and subtasks
    const cleanContents = (subject.contents || []).map(c => ({
      id: `cnt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      title: c.title || '',
      examDate: c.examDate || null,
      notes: c.notes || '',
      isCompleted: false,
      todos: []
    }));

    const subjectData = {
      name: subject.name,
      code: subject.code || '',
      color: subject.color || '#3b82f7',
      icon: subject.icon || subject.emoji || '📚',
      emoji: subject.icon || subject.emoji || '📚',
      contents: cleanContents
    };

    const payload = {
      type: 'gorit_subject',
      shareSlug,
      title: subject.name,
      subjectData,
      sharedBy: {
        uid: user.uid,
        name: user.displayName || user.email || 'Usuário PRO'
      },
      createdAt: Date.now()
    };

    await setDoc(doc(db, 'shares', shareSlug), payload);

    const origin = window.location.origin;
    const path = window.location.pathname.replace(/\/$/, '');
    const shareUrl = `${origin}${path}/?share=${shareSlug}`;

    return {
      success: true,
      shareSlug,
      shareUrl,
      subjectName: subject.name
    };
  } catch (err) {
    console.error('[Gorit Share] Share error:', err);
    return { success: false, error: err };
  }
}

/**
 * Loads a shared subject from Firestore 'shares' collection
 */
export async function loadSharedSubjectFromCloud(shareSlug) {
  if (!shareSlug) return null;
  try {
    const snap = await getDoc(doc(db, 'shares', shareSlug));
    if (snap.exists()) {
      const data = snap.data();
      if (data && (data.type === 'gorit_subject' || data.subjectData)) {
        return data;
      }
    }
  } catch (err) {
    console.error('[Gorit Share] Fetch shared subject error:', err);
  }
  return null;
}
