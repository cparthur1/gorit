// SPDX-License-Identifier: GPL-2.0-only
/**
 * js/dialogs.js
 * Material Design 3 Expressive custom dialogs replacing native alert(), confirm(), and prompt().
 * Uses native <dialog> top-layer modal with accessible focus management, keyboard handling,
 * overscroll containment, and fast GPU-composited entry/exit animations (no heavy backdrop blur).
 */

import { t } from './i18n.js';

let dialogQueue = Promise.resolve();
let supportsDisplayTransitionCache;

function canTransitionDisplay() {
  if (supportsDisplayTransitionCache !== undefined) return supportsDisplayTransitionCache;
  if (typeof window === 'undefined' || !window.CSS?.supports?.('transition-behavior', 'allow-discrete') || !document.body) {
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText = 'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  supportsDisplayTransitionCache = getComputedStyle(probe).display === 'block';
  probe.remove();
  return supportsDisplayTransitionCache;
}

function supportsTopLayerExit() {
  return Boolean(typeof window !== 'undefined' && window.CSS?.supports?.('overlay', 'auto') && canTransitionDisplay());
}

async function closeDialogWithMotion(dialog, returnValue = '') {
  if (!dialog || !dialog.open) return;
  if (dialog.hasAttribute('data-closing')) return;

  if (!supportsTopLayerExit()) {
    dialog.setAttribute('data-closing', '');
    try {
      const animations = typeof dialog.getAnimations === 'function'
        ? dialog.getAnimations({ subtree: true }).filter((a) => a.effect?.getComputedTiming?.().iterations !== Infinity)
        : [];
      if (animations.length > 0) {
        await Promise.race([
          Promise.allSettled(animations.map((a) => a.finished)),
          new Promise((resolve) => setTimeout(resolve, 160))
        ]);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 130));
      }
    } catch {
      // fallback immediate close
    }
    dialog.removeAttribute('data-closing');
  }

  if (dialog.open) {
    dialog.close(returnValue);
  }
}

const VARIANT_ICONS = {
  info: 'info',
  primary: 'help',
  success: 'check_circle',
  warning: 'warning',
  danger: 'delete_forever'
};

function inferAlertVariant(message) {
  const msg = String(message || '').toLowerCase();
  if (/(sucesso|success|restaurad|restored|importad|imported)/.test(msg)) return 'success';
  if (/(erro|error|inválid|invalid|insira|enter|not found|não encontrad)/.test(msg)) return 'warning';
  return 'info';
}

function inferConfirmVariant(message) {
  const msg = String(message || '').toLowerCase();
  if (/(excluir|deletar|apagar|remover|delete|remove|clear|permanente)/.test(msg)) return 'danger';
  return 'primary';
}

function enqueueDialog(factory) {
  const resultPromise = dialogQueue.then(factory, factory);
  dialogQueue = resultPromise.then(() => undefined, () => undefined);
  return resultPromise;
}

function showBaseDialog({
  mode = 'alert',
  title = '',
  message = '',
  defaultValue = '',
  placeholder = '',
  confirmText = '',
  cancelText = '',
  variant = '',
  icon = '',
  lightDismiss = true
} = {}) {
  return enqueueDialog(() => new Promise((resolve) => {
    if (typeof document === 'undefined' || !document.body) {
      resolve(mode === 'confirm' ? false : mode === 'prompt' ? null : undefined);
      return;
    }

    const resolvedVariant = variant || (mode === 'confirm' ? inferConfirmVariant(message) : mode === 'alert' ? inferAlertVariant(message) : 'primary');
    const resolvedIcon = icon || (mode === 'prompt' ? 'edit_note' : (VARIANT_ICONS[resolvedVariant] || 'info'));
    const resolvedTitle = title || (
      mode === 'confirm'
        ? (resolvedVariant === 'danger' ? t('dialog_danger_title') : t('dialog_confirm_title'))
        : mode === 'prompt'
          ? t('dialog_prompt_title')
          : t('dialog_alert_title')
    );
    const resolvedConfirm = confirmText || (mode === 'alert' ? t('dialog_ok') : t('dialog_confirm'));
    const resolvedCancel = cancelText || t('cancel_btn');

    const dialog = document.createElement('dialog');
    dialog.className = `m3-app-dialog m3-dialog-variant-${resolvedVariant}`;
    const uid = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const titleId = `m3-dialog-title-${uid}`;
    const descId = `m3-dialog-desc-${uid}`;
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', descId);
    if (lightDismiss) {
      dialog.setAttribute('closedby', 'any');
    }

    const form = document.createElement('form');
    form.method = 'dialog';
    form.className = 'm3-app-dialog-form';

    const body = document.createElement('div');
    body.className = 'm3-app-dialog-body';

    const headerRow = document.createElement('div');
    headerRow.className = 'm3-app-dialog-header';

    const iconWrap = document.createElement('div');
    iconWrap.className = `m3-app-dialog-icon-badge is-${resolvedVariant}`;
    const iconSpan = document.createElement('span');
    iconSpan.className = 'material-symbols-rounded';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = resolvedIcon;
    iconWrap.appendChild(iconSpan);

    const textWrap = document.createElement('div');
    textWrap.className = 'm3-app-dialog-text';

    const heading = document.createElement('h1');
    heading.id = titleId;
    heading.className = 'm3-app-dialog-title';
    heading.textContent = resolvedTitle;

    const desc = document.createElement('p');
    desc.id = descId;
    desc.className = 'm3-app-dialog-message';
    desc.textContent = String(message ?? '');

    textWrap.appendChild(heading);
    textWrap.appendChild(desc);
    headerRow.appendChild(iconWrap);
    headerRow.appendChild(textWrap);
    body.appendChild(headerRow);

    let promptInput = null;
    if (mode === 'prompt') {
      promptInput = document.createElement('input');
      promptInput.type = 'text';
      promptInput.value = String(defaultValue ?? '');
      promptInput.placeholder = placeholder || t('dialog_input_placeholder');
      promptInput.autocomplete = 'off';
      promptInput.className = 'form-control m3-app-dialog-input';
      body.appendChild(promptInput);
    }

    const footer = document.createElement('div');
    footer.className = 'm3-app-dialog-footer';

    if (mode === 'confirm' || mode === 'prompt') {
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-outline btn-sm';
      cancelBtn.textContent = resolvedCancel;
      if (mode === 'confirm' && resolvedVariant === 'danger') {
        cancelBtn.autofocus = true;
      }
      cancelBtn.addEventListener('click', () => {
        closeDialogWithMotion(dialog, 'cancel');
      });
      footer.appendChild(cancelBtn);
    }

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'submit';
    confirmBtn.value = 'confirm';
    confirmBtn.className = `btn btn-sm m3-app-dialog-confirm is-${resolvedVariant}`;
    confirmBtn.textContent = resolvedConfirm;
    if (mode === 'alert' || (mode === 'confirm' && resolvedVariant !== 'danger')) {
      confirmBtn.autofocus = true;
    }
    footer.appendChild(confirmBtn);

    form.appendChild(body);
    form.appendChild(footer);
    dialog.appendChild(form);
    document.body.appendChild(dialog);

    let settled = false;
    const finish = (choice) => {
      if (settled) return;
      settled = true;
      dialog.returnValue = '';
      setTimeout(() => {
        dialog.remove();
      }, supportsTopLayerExit() ? 150 : 20);

      if (mode === 'confirm') {
        resolve(choice === 'confirm');
      } else if (mode === 'prompt') {
        resolve(choice === 'confirm' ? (promptInput ? promptInput.value : '') : null);
      } else {
        resolve(undefined);
      }
    };

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      closeDialogWithMotion(dialog, 'confirm');
    });

    dialog.addEventListener('cancel', (e) => {
      e.preventDefault();
      closeDialogWithMotion(dialog, 'cancel');
    });

    dialog.addEventListener('close', () => {
      finish(dialog.returnValue || 'cancel');
    });

    if (lightDismiss && !('closedBy' in HTMLDialogElement.prototype)) {
      const isOutside = (e) => {
        const r = dialog.getBoundingClientRect();
        return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
      };
      let pressedOutside = false;
      dialog.addEventListener('pointerdown', (e) => {
        pressedOutside = isOutside(e);
      });
      dialog.addEventListener('pointerup', (e) => {
        if (pressedOutside && isOutside(e)) {
          closeDialogWithMotion(dialog, 'cancel');
        }
        pressedOutside = false;
      });
    }

    try {
      dialog.showModal();
    } catch {
      dialog.remove();
      resolve(mode === 'confirm' ? false : mode === 'prompt' ? null : undefined);
      return;
    }

    if (promptInput) {
      requestAnimationFrame(() => {
        promptInput.focus();
        promptInput.select();
      });
    }
  }));
}

export function appAlert(message, options = {}) {
  return showBaseDialog({ mode: 'alert', message, ...options });
}

export function appConfirm(message, options = {}) {
  return showBaseDialog({ mode: 'confirm', message, ...options });
}

export function appPrompt(message, defaultValue = '', options = {}) {
  return showBaseDialog({ mode: 'prompt', message, defaultValue, ...options });
}
