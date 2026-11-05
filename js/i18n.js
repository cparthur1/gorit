// SPDX-License-Identifier: GPL-2.0-only
/**
 * js/i18n.js
 * Internationalization & Localization Engine for Gorit WebApp.
 * Strictly supports Portuguese (pt-BR) and English (en-US).
 */

export const LANGUAGE_STORAGE_KEY = 'gorit_language';

export const SUPPORTED_LANGUAGES = ['pt-BR', 'en-US'];

export const TRANSLATIONS = {
  'pt-BR': {
    // App & Brand
    app_name: 'Gorit',
    app_tagline: 'Rastreador de Estudos & Provas',
    app_description: 'Organize disciplinas do semestre, cronogramas de conteúdos, datas de provas e tarefas com cálculo automático de progresso.',
    
    // Header Actions
    autosaved_device: 'Salvo no dispositivo',
    saving_device: 'Salvando no dispositivo...',
    saved_locally_browser: 'Salvo localmente (navegador)',
    autosave_error: 'Erro de salvamento',
    backup_button: 'Backup',
    backup_title: 'Exportar backup de dados (JSON)',
    restore_button: 'Restaurar',
    restore_title: 'Restaurar backup (JSON)',
    language_toggle: 'Idioma',
    
    // Quick Semester Stats
    stat_subjects: 'Disciplinas',
    stat_next_exam: 'Próxima Prova',
    stat_overall_progress: 'Progresso Geral',
    stat_semester_completion: 'Conclusão do semestre',
    stat_contents_count: '{count} conteúdos',
    stat_content_count_singular: '1 conteúdo',
    stat_calculating: 'Calculando...',
    stat_none_scheduled: 'Nenhuma agendada',
    stat_today: 'Hoje!',
    stat_tomorrow: 'Amanhã',
    stat_in_days: 'em {days} dias',

    // Navigation Tabs
    tab_studies: 'Conteúdos & Tarefas',
    tab_semester: 'Disciplinas do Semestre',

    // Main Studies View
    search_placeholder: 'Buscar disciplina ou conteúdo...',
    expand_all: 'Expandir Tudo',
    collapse_all: 'Recolher Tudo',
    chrono_order_title: 'Ordem Cronológica:',
    chrono_order_desc: 'Disciplinas organizadas com as próximas provas no topo.',
    add_subject_shortcut: 'Adicionar Disciplina',
    first_in_line: '1º da fila',
    next_upcoming_exam_tooltip: 'Próxima prova do semestre!',
    no_upcoming_exams: 'Sem provas pendentes',
    no_exams_scheduled: 'Sem provas agendadas',
    exam_today: 'Prova Hoje!',
    exam_tomorrow: 'Prova Amanhã!',
    exam_in_days: 'Prova em {days} dias',
    passed_yesterday: 'Passou ontem',
    days_ago: 'há {days} dias',
    completed_badge: 'Concluído',
    tasks_ratio: '{completed}/{total} tarefas',
    completed_ratio: '{completed}/{total} concluídos',
    no_contents_yet: '0% (sem conteúdos)',
    reset_all: 'Redefinir Tudo',
    complete_all: 'Concluir Tudo',
    toggle_all_tooltip: 'Alternar todos os conteúdos desta disciplina como concluídos ou pendentes',
    add_content: 'Adicionar Conteúdo',
    contents_header: 'Conteúdos ({count})',
    no_contents_in_subject: 'Nenhum conteúdo cadastrado nesta disciplina ainda.',
    add_first_content: 'Adicionar 1º Conteúdo',

    // Content Item
    mark_as_pending: 'Marcar como Pendente',
    mark_as_completed: 'Concluir Tópico',
    click_calendar_set_date: 'Clique no calendário para definir a data da prova',
    change_exam_deadline: 'Alterar data da prova (salva automaticamente)',
    no_date_set: 'Sem data',
    topic_completed_summary: 'Tópico de conteúdo concluído',
    topic_pending_summary: 'Tópico de conteúdo (conclua acima)',
    tasks_progress_summary: '{completed}/{total} tarefas concluídas ({percent}%)',
    notes_and_tips: 'Notas & Dicas',
    notes_placeholder: 'Adicione anotações, capítulos do livro, fórmulas (salva automaticamente)...',
    no_tasks_placeholder: 'Nenhuma tarefa cadastrada. Digite abaixo e pressione Enter para adicionar!',
    add_task_placeholder: 'Adicionar tarefa (ex: Ler capítulo 2, Flashcards, Exercícios...)',
    add_task_btn: 'Tarefa',
    edit_content: 'Editar Conteúdo',
    delete_content: 'Excluir Conteúdo',
    delete_task: 'Excluir tarefa',
    click_to_edit_task: 'Clique para editar a tarefa (salva automaticamente)',

    // Empty States
    no_subjects_title: 'Nenhuma disciplina cadastrada ainda',
    no_subjects_desc: 'Adicione as disciplinas do seu semestre para começar a organizar conteúdos, datas de provas e tarefas.',
    load_sample_courses: 'Carregar Disciplinas de Exemplo',
    no_search_results_title: 'Nenhum conteúdo encontrado',
    no_search_results_desc: 'Nenhuma disciplina ou conteúdo corresponde a "{query}".',
    clear_search: 'Limpar Busca',

    // Semester Subjects View (Tab 2)
    add_new_subject: 'Adicionar Nova Disciplina',
    edit_subject: 'Editar Disciplina',
    subject_name_label: 'Nome da Disciplina *',
    subject_name_placeholder: 'ex: Anatomia Humana, Fisiologia Médica, Patologia...',
    subject_code_label: 'Código ou Sigla (opcional)',
    subject_code_placeholder: 'ex: ANAT101, FISIO1, FARMA2...',
    subject_icon_label: 'Ícone da Disciplina',
    subject_color_label: 'Cor da Disciplina',
    registered_subjects_title: 'Disciplinas Cadastradas neste Semestre',
    no_subjects_manage_desc: 'Use o formulário ao lado para cadastrar sua primeira disciplina com nome, ícone e cor personalizados.',
    save_changes: 'Salvar Alterações',
    add_subject: 'Adicionar Disciplina',
    edit_btn: 'Editar',
    delete_btn: 'Excluir',
    content_btn: 'Conteúdo',

    // Content Modal
    modal_add_content_title: 'Adicionar Conteúdo',
    modal_edit_content_title: 'Editar Conteúdo',
    modal_subject_label: 'Disciplina *',
    modal_content_title_label: 'Título do Conteúdo *',
    modal_content_title_placeholder: 'ex: Sistema Cardiovascular, Nervos Cranianos...',
    modal_exam_date_label: 'Data Limite / Prova deste Conteúdo',
    modal_exam_date_hint: 'Esta data determina a ordem cronológica na tela principal.',
    modal_notes_label: 'Notas ou Dicas (opcional)',
    modal_notes_placeholder: 'Capítulos do livro, conceitos-chave para revisão...',
    cancel_btn: 'Cancelar',
    save_content_btn: 'Salvar Conteúdo',

    // Notifications & Prompts
    toast_all_expanded: 'Todos os itens foram expandidos.',
    toast_all_collapsed: 'Todos os itens foram recolhidos.',
    toast_subject_updated: 'Disciplina "{name}" atualizada com sucesso!',
    toast_subject_added: 'Disciplina "{name}" adicionada ao semestre!',
    toast_subject_removed: 'Disciplina removida.',
    toast_content_updated: 'Conteúdo "{title}" atualizado!',
    toast_content_added: 'Conteúdo "{title}" adicionado!',
    toast_content_removed: 'Conteúdo removido.',
    toast_content_completed: '"{title}" marcado como concluído!',
    toast_content_pending: '"{title}" marcado como pendente.',
    toast_all_contents_completed: 'Todos os conteúdos de "{name}" foram concluídos!',
    toast_all_contents_reset: 'Todos os conteúdos de "{name}" foram redefinidos para pendente.',
    toast_tasks_100_percent: 'Parabéns! Você concluiu todas as tarefas de "{title}"!',
    toast_deadline_updated: 'Data da prova atualizada para {date} (salvo automaticamente)',
    toast_backup_exported: 'Backup exportado com sucesso!',
    toast_data_restored: 'Dados restaurados e salvos no dispositivo!',
    toast_sample_loaded: 'Disciplinas de exemplo carregadas com sucesso!',
    confirm_delete_subject: 'Tem certeza de que deseja excluir a disciplina "{name}" e todos os seus conteúdos e tarefas?',
    confirm_delete_content: 'Tem certeza de que deseja excluir "{title}" e todas as suas tarefas?',
    alert_enter_subject_name: 'Por favor, insira o nome da disciplina.',
    alert_enter_content_title: 'Por favor, insira o título do conteúdo.',
    alert_invalid_json: 'Formato de arquivo JSON inválido.',
    alert_error_reading_json: 'Erro ao ler arquivo JSON: {error}',

    // Auth & Cloud Sync (Flashcards PRO Integration)
    auth_sign_in: 'Entrar com Google',
    auth_sign_out: 'Sair da conta',
    auth_signing_in: 'Conectando...',
    auth_signed_in_as: 'Conectado como {name}',
    account_btn_title: 'Minha Conta & Sincronização em Nuvem',
    account_modal_title: 'Minha Conta & Sincronização',
    account_modal_subtitle: 'Extensão da sua assinatura do Flashcards',
    account_status_label: 'Status do Plano',
    account_pro_badge: 'Flashcards PRO Ativo',
    account_pro_desc: 'Sua assinatura PRO libera a sincronização automática em tempo real em todos os seus aparelhos.',
    account_free_badge: 'Plano Gratuito',
    account_free_desc: 'A sincronização em nuvem é exclusiva para assinantes Flashcards PRO. Seus dados continuam salvos localmente neste aparelho.',
    account_upgrade_btn: 'Desbloquear Nuvem com Flashcards PRO',
    cloud_sync_title: 'Sincronização em Nuvem',
    cloud_sync_status_synced: 'Nuvem sincronizada',
    cloud_sync_status_pending: 'Sincronizando com a nuvem...',
    cloud_sync_status_offline: 'Offline / Nuvem pausada',
    cloud_sync_now_btn: 'Sincronizar Agora',
    cloud_last_synced: 'Último envio para a nuvem: {time}',
    cloud_never_synced: 'Ainda não sincronizado nesta sessão',
    cloud_sync_success_toast: 'Dados salvos na nuvem Flashcards com sucesso!',
    cloud_sync_error_toast: 'Não foi possível sincronizar com a nuvem. Tentaremos novamente em instantes.',
    cloud_data_found_title: 'Dados na Nuvem Encontrados',
    cloud_data_found_desc: 'Encontramos um cronograma salvo na sua conta do Flashcards ({count} disciplinas). Deseja carregar os dados da nuvem?',
    cloud_load_cloud_btn: 'Carregar da Nuvem',
    cloud_keep_local_btn: 'Manter Dados Deste Aparelho',
    autosaved_cloud: 'Nuvem PRO Sincronizada',

    // General Tasks & Emojis
    general_tasks_title: 'Tarefas Gerais',
    general_tasks_default_content: 'Tarefas Rápidas & Diárias',
    general_tasks_cannot_delete: 'A lista de Tarefas Gerais é fixa e não pode ser excluída.',
    pinned_badge: 'Fixado',
    custom_emoji_label: 'Ou digite/cole qualquer emoji:'
  },

  'en-US': {
    // App & Brand
    app_name: 'Gorit',
    app_tagline: 'Study & Exam Tracker',
    app_description: 'Organize and track semester subjects, course content, exam deadlines, and study to-dos with real-time automatic progress calculation.',

    // Header Actions
    autosaved_device: 'Autosaved to device',
    saving_device: 'Saving to device...',
    saved_locally_browser: 'Saved locally (browser)',
    autosave_error: 'Autosave error',
    backup_button: 'Backup',
    backup_title: 'Export data backup (JSON)',
    restore_button: 'Restore',
    restore_title: 'Restore backup (JSON)',
    language_toggle: 'Language',

    // Quick Semester Stats
    stat_subjects: 'Subjects',
    stat_next_exam: 'Next Exam',
    stat_overall_progress: 'Overall Progress',
    stat_semester_completion: 'Semester completion',
    stat_contents_count: '{count} contents',
    stat_content_count_singular: '1 content',
    stat_calculating: 'Calculating...',
    stat_none_scheduled: 'None scheduled',
    stat_today: 'Today!',
    stat_tomorrow: 'Tomorrow',
    stat_in_days: 'in {days} days',

    // Navigation Tabs
    tab_studies: 'Contents & Tasks',
    tab_semester: 'Semester Subjects',

    // Main Studies View
    search_placeholder: 'Search subject or content...',
    expand_all: 'Expand All',
    collapse_all: 'Collapse All',
    chrono_order_title: 'Chronological Order:',
    chrono_order_desc: 'Subjects organized with upcoming exams at the top.',
    add_subject_shortcut: 'Add Subject',
    first_in_line: '1st in line',
    next_upcoming_exam_tooltip: 'Next upcoming exam of the semester!',
    no_upcoming_exams: 'No upcoming exams',
    no_exams_scheduled: 'No exams scheduled',
    exam_today: 'Exam Today!',
    exam_tomorrow: 'Exam Tomorrow!',
    exam_in_days: 'Exam in {days} days',
    passed_yesterday: 'Passed yesterday',
    days_ago: '{days} days ago',
    completed_badge: 'Completed',
    tasks_ratio: '{completed}/{total} tasks',
    completed_ratio: '{completed}/{total} completed',
    no_contents_yet: '0% (no contents)',
    reset_all: 'Reset All',
    complete_all: 'Complete All',
    toggle_all_tooltip: 'Toggle all contents in this subject as completed or pending',
    add_content: 'Add Content',
    contents_header: 'Contents ({count})',
    no_contents_in_subject: 'No contents added to this subject yet.',
    add_first_content: 'Add 1st Content',

    // Content Item
    mark_as_pending: 'Mark as Pending',
    mark_as_completed: 'Check as Completed',
    click_calendar_set_date: 'Click calendar to set exam date',
    change_exam_deadline: 'Change exam deadline (autosaves)',
    no_date_set: 'No date set',
    topic_completed_summary: 'Content topic completed',
    topic_pending_summary: 'Content topic (mark complete above)',
    tasks_progress_summary: '{completed}/{total} tasks completed ({percent}%)',
    notes_and_tips: 'Notes & Tips',
    notes_placeholder: 'Add notes, textbook chapters, formulas (autosaves as you type)...',
    no_tasks_placeholder: 'No tasks added yet. Type below and press Enter to add a task!',
    add_task_placeholder: 'Add task (e.g. Read chapter 2, Flashcards, Practice questions...)',
    add_task_btn: 'Task',
    edit_content: 'Edit Content',
    delete_content: 'Delete Content',
    delete_task: 'Delete task',
    click_to_edit_task: 'Click to edit task (autosaves)',

    // Empty States
    no_subjects_title: 'No subjects registered yet',
    no_subjects_desc: 'Add your semester subjects to start organizing course contents, exam deadlines, and tasks.',
    load_sample_courses: 'Load Sample Courses',
    no_search_results_title: 'No content found',
    no_search_results_desc: 'No subjects or contents match "{query}".',
    clear_search: 'Clear Search',

    // Semester Subjects View (Tab 2)
    add_new_subject: 'Add New Subject',
    edit_subject: 'Edit Subject',
    subject_name_label: 'Subject Name *',
    subject_name_placeholder: 'e.g. Human Anatomy, Medical Physiology, Pathology...',
    subject_code_label: 'Code or Acronym (optional)',
    subject_code_placeholder: 'e.g. ANAT101, PHYS101, PHARM201...',
    subject_icon_label: 'Subject Icon',
    subject_color_label: 'Subject Color',
    registered_subjects_title: 'Registered Subjects for this Semester',
    no_subjects_manage_desc: 'Use the form on the left to register your first semester subject with a custom name, icon, and color.',
    save_changes: 'Save Changes',
    add_subject: 'Add Subject',
    edit_btn: 'Edit',
    delete_btn: 'Delete',
    content_btn: 'Content',

    // Content Modal
    modal_add_content_title: 'Add Content',
    modal_edit_content_title: 'Edit Content',
    modal_subject_label: 'Subject *',
    modal_content_title_label: 'Content Title *',
    modal_content_title_placeholder: 'e.g. Cardiovascular System, Cranial Nerves...',
    modal_exam_date_label: 'Deadline / Exam Date for this Content',
    modal_exam_date_hint: 'This date determines the chronological order on the main screen.',
    modal_notes_label: 'Notes or Tips (optional)',
    modal_notes_placeholder: 'Textbook chapters, key concepts to review...',
    cancel_btn: 'Cancel',
    save_content_btn: 'Save Content',

    // Notifications & Prompts
    toast_all_expanded: 'All items expanded.',
    toast_all_collapsed: 'All items collapsed.',
    toast_subject_updated: 'Subject "{name}" updated successfully!',
    toast_subject_added: 'Subject "{name}" added to semester!',
    toast_subject_removed: 'Subject removed.',
    toast_content_updated: 'Content "{title}" updated!',
    toast_content_added: 'Content "{title}" added!',
    toast_content_removed: 'Content removed.',
    toast_content_completed: '"{title}" marked as completed!',
    toast_content_pending: '"{title}" marked as pending.',
    toast_all_contents_completed: 'All contents in "{name}" marked as completed!',
    toast_all_contents_reset: 'All contents in "{name}" reset to pending.',
    toast_tasks_100_percent: 'Congratulations! You completed all tasks for "{title}"!',
    toast_deadline_updated: 'Exam deadline updated to {date} (autosaved)',
    toast_backup_exported: 'Backup exported successfully!',
    toast_data_restored: 'Data restored and autosaved to device!',
    toast_sample_loaded: 'Sample courses loaded successfully!',
    confirm_delete_subject: 'Are you sure you want to delete "{name}" and all its contents and tasks?',
    confirm_delete_content: 'Are you sure you want to delete "{title}" and its tasks?',
    alert_enter_subject_name: 'Please enter a subject name.',
    alert_enter_content_title: 'Please enter a content title.',
    alert_invalid_json: 'Invalid JSON file format.',
    alert_error_reading_json: 'Error reading JSON file: {error}',

    // Auth & Cloud Sync (Flashcards PRO Integration)
    auth_sign_in: 'Sign in with Google',
    auth_sign_out: 'Sign out',
    auth_signing_in: 'Signing in...',
    auth_signed_in_as: 'Signed in as {name}',
    account_btn_title: 'My Account & Cloud Sync',
    account_modal_title: 'My Account & Sync',
    account_modal_subtitle: 'Extension of your Flashcards subscription',
    account_status_label: 'Plan Status',
    account_pro_badge: 'Flashcards PRO Active',
    account_pro_desc: 'Your PRO subscription unlocks real-time automatic cloud sync across all your devices.',
    account_free_badge: 'Free Plan',
    account_free_desc: 'Cloud sync is an exclusive feature for Flashcards PRO subscribers. Your data remains saved locally on this device.',
    account_upgrade_btn: 'Unlock Cloud Sync with Flashcards PRO',
    cloud_sync_title: 'Cloud Synchronization',
    cloud_sync_status_synced: 'Cloud synced',
    cloud_sync_status_pending: 'Syncing with cloud...',
    cloud_sync_status_offline: 'Offline / Cloud paused',
    cloud_sync_now_btn: 'Sync Now',
    cloud_last_synced: 'Last cloud sync: {time}',
    cloud_never_synced: 'Not synced yet in this session',
    cloud_sync_success_toast: 'Data successfully saved to Flashcards cloud!',
    cloud_sync_error_toast: 'Could not sync to cloud. We will retry momentarily.',
    cloud_data_found_title: 'Cloud Data Found',
    cloud_data_found_desc: 'We found a study schedule saved in your Flashcards account ({count} subjects). Would you like to load cloud data?',
    cloud_load_cloud_btn: 'Load from Cloud',
    cloud_keep_local_btn: 'Keep Local Device Data',
    autosaved_cloud: 'PRO Cloud Synced',

    // General Tasks & Emojis
    general_tasks_title: 'General Tasks',
    general_tasks_default_content: 'Quick & Daily To-Dos',
    general_tasks_cannot_delete: 'General Tasks is pinned to top and cannot be deleted.',
    pinned_badge: 'Pinned',
    custom_emoji_label: 'Or type/paste any emoji:'
  }
};

/**
 * Detect language based on user setting or browser preference.
 * Defaults to pt-BR if browser language starts with pt or es, otherwise en-US.
 */
export function detectLanguage() {
  const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
  if (saved && SUPPORTED_LANGUAGES.includes(saved)) {
    return saved;
  }

  const browserLang = (navigator.language || navigator.userLanguage || '').toLowerCase();
  if (browserLang.startsWith('pt') || browserLang.startsWith('es')) {
    return 'pt-BR';
  }
  return 'en-US';
}

let currentLanguage = detectLanguage();

export function getLanguage() {
  return currentLanguage;
}

export function setLanguage(lang) {
  if (!SUPPORTED_LANGUAGES.includes(lang)) {
    console.warn(`[i18n] Unsupported language "${lang}". Defaulting to en-US.`);
    lang = 'en-US';
  }
  currentLanguage = lang;
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
  } catch (e) {
    console.error('Failed to save language preference:', e);
  }

  document.documentElement.lang = lang === 'pt-BR' ? 'pt-BR' : 'en';
  return currentLanguage;
}

/**
 * Returns translated string for given key. Supports variable interpolation {param}.
 */
export function t(key, params = {}) {
  const dict = TRANSLATIONS[currentLanguage] || TRANSLATIONS['en-US'];
  let text = dict[key] || TRANSLATIONS['en-US'][key] || key;

  if (params && typeof params === 'object') {
    Object.keys(params).forEach(param => {
      text = text.replace(new RegExp(`\\{${param}\\}`, 'g'), params[param]);
    });
  }

  return text;
}

/**
 * Applies translations to elements marked with data-i18n attributes.
 */
export function applyDOMTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (key) {
      el.textContent = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (key) {
      el.placeholder = t(key);
    }
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    if (key) {
      el.title = t(key);
    }
  });
}
