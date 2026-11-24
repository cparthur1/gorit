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

    // Header Actions & Data
    autosave_error: 'Erro de salvamento',
    backup_button: 'Backup',
    backup_title: 'Exportar backup de dados (JSON)',
    restore_button: 'Restaurar',
    restore_title: 'Restaurar backup (JSON)',
    close_btn: 'Fechar',

    // Quick Semester Stats
    stat_subjects: 'Disciplinas',
    stat_subjects_manage_hint: 'Clique para gerenciar disciplinas do semestre',
    stat_next_exam: 'Próxima Prova',
    stat_next_exam_jump_hint: 'Clique para ir direto à próxima prova',
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
    search_placeholder: 'Buscar disciplina, conteúdo ou tarefa...',
    clear_search_tooltip: 'Limpar busca',
    expand_all: 'Expandir Tudo',
    collapse_all: 'Recolher Tudo',
    chrono_order_compact: 'Ordenado pelas próximas provas',
    dismiss_hint: 'Ocultar aviso',
    first_in_line: '1º da fila',
    next_upcoming_exam_tooltip: 'Próxima prova do semestre!',
    next_exam_tooltip: 'Próxima prova: {title}',
    all_contents_completed_tooltip: 'Todos os conteúdos concluídos!',
    exam_date_tooltip: 'Data da prova: {date}',
    no_upcoming_exams: 'Sem provas pendentes',
    no_exams_scheduled: 'Sem provas agendadas',
    exam_today: 'Prova Hoje!',
    exam_tomorrow: 'Prova Amanhã!',
    exam_in_days: 'Prova em {days} dias',
    passed_yesterday: 'Passou ontem',
    days_ago: 'há {days} dias',
    completed_badge: 'Concluído',
    status_pending: 'Pendente',
    tasks_ratio: '{completed}/{total} tarefas',
    completed_ratio: '{completed}/{total} concluídos',
    no_contents_yet: '0% (sem conteúdos)',
    reset_all: 'Redefinir Tudo',
    complete_all: 'Tudo Feito',
    toggle_subject_all_tooltip: 'Alternar todos os conteúdos desta disciplina como concluídos ou pendentes',
    add_content: 'Adicionar',
    contents_header: 'Conteúdos ({count})',
    no_contents_in_subject: 'Nenhum conteúdo cadastrado nesta disciplina ainda.',
    add_first_content: 'Adicionar 1º Conteúdo',

    // Content Item
    mark_as_pending: 'Marcar como Pendente',
    mark_as_completed: 'Concluir Tópico',
    mark_content_aria: 'Marcar "{title}" como concluído',
    click_calendar_set_date: 'Clique no calendário para definir a data da prova',
    change_exam_deadline: 'Alterar data da prova (salva automaticamente)',
    clear_date_tooltip: 'Limpar data',
    no_date_set: 'Sem data',
    no_tasks_placeholder: 'Nenhuma tarefa cadastrada. Digite abaixo e pressione Enter para adicionar!',
    add_task_placeholder: 'Adicionar tarefa (ex: Ler capítulo 2, Flashcards, Exercícios...)',
    add_task_btn: 'Tarefa',
    edit_content: 'Editar Conteúdo',
    delete_content: 'Excluir Conteúdo',
    delete_task: 'Excluir tarefa',
    click_to_edit_task: 'Clique para editar a tarefa (salva automaticamente)',

    // Empty States
    no_subjects_title: 'Nenhuma disciplina cadastrada ainda',
    no_subjects_desc: 'Adicione as disciplinas do seu semestre para organizar conteúdos, datas de provas e tarefas.',
    no_search_results_title: 'Nenhum conteúdo encontrado',
    no_search_results_desc: 'Nenhuma disciplina, conteúdo ou tarefa corresponde a "{query}".',
    clear_search: 'Limpar Busca',

    // Semester Subjects View (Tab 2)
    add_new_subject: 'Adicionar Nova Disciplina',
    edit_subject: 'Editando Disciplina',
    editing_autosave_badge: 'Salvo automaticamente',
    new_subject_mode_btn: 'Nova Disciplina',
    subject_preview_label: 'Prévia da Disciplina',
    subject_preview_placeholder: 'Nome da Disciplina',
    subject_name_label: 'Nome da Disciplina *',
    subject_name_placeholder: 'ex: Anatomia Humana, Fisiologia Médica, Patologia...',
    subject_code_label: 'Código ou Sigla (opcional)',
    subject_code_placeholder: 'ex: ANAT101, FISIO1, FARMA2...',
    subject_icon_label: 'Ícone da Disciplina',
    subject_color_label: 'Cor da Disciplina',
    choose_color_tooltip: 'Escolher cor {color}',
    custom_color_tooltip: 'Cor personalizada',
    registered_subjects_title: 'Disciplinas Cadastradas neste Semestre',
    no_subjects_manage_desc: 'Use o formulário ao lado para cadastrar sua primeira disciplina com nome, ícone e cor personalizados.',
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
    cancel_btn: 'Cancelar',
    save_content_btn: 'Salvar Conteúdo',

    // Custom Dialogs
    dialog_ok: 'Entendi',
    dialog_confirm: 'Confirmar',
    dialog_alert_title: 'Aviso',
    dialog_confirm_title: 'Confirmação',
    dialog_danger_title: 'Confirmar exclusão',
    dialog_prompt_title: 'Digite para continuar',
    dialog_input_placeholder: 'Digite aqui...',

    // Notifications & Prompts
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
    toast_task_removed: 'Tarefa removida.',
    undo_btn: 'Desfazer',
    toast_backup_exported: 'Backup exportado com sucesso!',
    toast_data_restored: 'Dados restaurados e salvos no dispositivo!',
    confirm_delete_subject: 'Tem certeza de que deseja excluir a disciplina "{name}" e todos os seus conteúdos e tarefas?',
    confirm_delete_content: 'Tem certeza de que deseja excluir "{title}" e todas as suas tarefas?',
    alert_enter_subject_name: 'Por favor, insira o nome da disciplina.',
    alert_enter_content_title: 'Por favor, insira o título do conteúdo.',
    subject_not_found: 'Disciplina não encontrada.',
    alert_invalid_json: 'Formato de arquivo JSON inválido.',
    alert_error_reading_json: 'Erro ao ler arquivo JSON: {error}',

    // Auth & Cloud Sync (Flashcards PRO Integration)
    auth_sign_in: 'Entrar com Google',
    auth_sign_in_short: 'Entrar',
    auth_sign_out: 'Sair da conta',
    auth_signed_in_as: 'Conectado como {name}',
    auth_signin_error: 'Falha no login com Google. Verifique sua conexão.',
    auth_signout_success: 'Desconectado com sucesso.',
    account_default_student: 'Estudante',
    account_default_label: 'Conta',
    account_btn_title: 'Minha Conta, Backup & Sincronização',
    account_modal_title: 'Minha Conta & Dados',
    account_modal_subtitle: 'Sincronização PRO, Clube CAMBLU e Backup local',
    account_login_prompt_desc: 'Conecte sua conta Google para sincronizar seu progresso de estudos na nuvem e ativar os benefícios do Flashcards PRO.',
    account_data_backup_title: 'Backup & Restauração Local',
    account_data_backup_desc: 'Exporte um arquivo .json dos seus estudos ou restaure um backup salvo neste dispositivo.',
    account_open_flashcards_btn: 'Abrir Spaiq Flashcards',
    account_status_label: 'Status do Plano',
    account_pro_badge: 'Flashcards PRO Ativo',
    account_pro_desc: 'Sua assinatura PRO libera a sincronização automática em tempo real em todos os seus aparelhos.',
    account_camblu_badge: 'Clube CAMBLU • {tier}',
    account_camblu_pro_desc: 'Seu plano {tier} do Clube CAMBLU desbloqueia o Gorit PRO, compartilhamento de matérias e sincronização em nuvem.',
    account_camblu_valid_until: 'Válido até {date}',
    account_camblu_portal_btn: 'Gerenciar no Clube CAMBLU',
    account_camblu_free_hint: 'Membro Clube CAMBLU (Raro, Épico ou Lendário)? Entre com seu e-mail Google para liberar o Gorit PRO automaticamente.',
    account_camblu_comum_hint: 'Clube CAMBLU (Comum) detectado. O Gorit PRO é liberado a partir do plano Raro (nível 2+).',
    camblu_tier_comum: 'Comum',
    camblu_tier_raro: 'Raro',
    camblu_tier_epico: 'Épico',
    camblu_tier_lendario: 'Lendário',
    account_free_badge: 'Plano Gratuito',
    account_free_desc: 'A sincronização em nuvem é exclusiva para assinantes Flashcards PRO ou membros do Clube CAMBLU (nível 2+). Seus dados continuam salvos localmente neste aparelho.',
    account_upgrade_btn: 'Desbloquear Nuvem com Flashcards PRO',
    cloud_sync_title: 'Sincronização em Nuvem',
    cloud_sync_status_synced: 'Nuvem sincronizada',
    cloud_sync_status_pending: 'Sincronizando com a nuvem...',
    cloud_sync_status_offline: 'Offline / Nuvem pausada',
    cloud_sync_now_btn: 'Sincronizar Agora',
    cloud_last_synced: 'Último envio para a nuvem: {time}',
    cloud_never_synced: 'Ainda não sincronizado nesta sessão',
    cloud_sync_success_toast: 'Dados salvos na nuvem com sucesso!',
    cloud_sync_error_toast: 'Não foi possível sincronizar com a nuvem. Tentaremos novamente em instantes.',

    // General Tasks & Emojis
    general_tasks_title: 'Tarefas Gerais',
    general_tasks_default_content: 'Tarefas Rápidas & Diárias',
    general_tasks_cannot_delete: 'A lista de Tarefas Gerais é fixa e não pode ser excluída.',
    pinned_badge: 'Fixado',
    custom_emoji_label: 'Ou digite/cole qualquer emoji:',

    // Quick Toggle
    toggle_all_expand: 'Expandir Tudo',
    toggle_all_collapse: 'Recolher Tudo',
    toggle_all_tooltip: 'Expandir ou recolher todas as disciplinas e tarefas com um toque',

    // General Tasks Prioritization & Daily Reminders
    daily_reminder_label: 'Lembrete Diário',
    daily_reminder_tooltip: 'Definir como Lembrete Diário recorrente',
    due_date_label: 'Prazo específico',
    due_today_badge: 'Hoje',
    due_overdue_badge: 'Atrasado',

    // Subject Sharing (PRO)
    share_subject_btn: 'Compartilhar',
    sharing_loading_btn: 'Gerando...',
    share_subject_title: 'Compartilhar Disciplina com Colega',
    share_subject_desc: 'Seu colega receberá o mesmo cronograma com todos os tópicos e datas de prova, mas com progresso e tarefas próprios e independentes.',
    share_privacy_notice: 'Qualquer colega com este link poderá adicionar esta disciplina aos estudos dele, com total privacidade (o progresso dele não afeta o seu).',
    share_subject_copy_btn: 'Copiar Link',
    share_subject_copied: 'Link copiado!',
    share_pro_required_title: 'Recurso Exclusivo PRO',
    share_pro_required_desc: 'O compartilhamento de disciplinas por link direto é exclusivo para assinantes Flashcards PRO ou membros Clube CAMBLU (nível 2+).',
    share_pro_card_desc: 'Assinantes PRO do Spaiq Flashcards e membros do Clube CAMBLU (Raro, Épico ou Lendário) contam com sincronização em nuvem automática e podem compartilhar qualquer disciplina com colegas por link direto.',
    import_share_title: 'Disciplina Compartilhada Recebida',
    import_share_subtitle_default: 'Importe este cronograma para os seus estudos',
    import_share_shared_by: 'Compartilhado por {name}',
    import_share_contents_singular: '1 conteúdo e data de prova',
    import_share_contents_plural: '{count} conteúdos e datas de provas',
    import_share_more_topics: '+ mais {count} tópicos...',
    import_share_loading_title: 'Carregando disciplina compartilhada...',
    import_share_loading_desc: 'Buscando cronograma e datas de prova na nuvem...',
    import_share_notice: 'O cronograma e as datas de prova serão importados, mas seu progresso e tarefas serão 100% pessoais e independentes.',
    import_share_btn: 'Adicionar aos Meus Estudos',
    import_share_success: 'Disciplina "{name}" adicionada com sucesso!',
    share_invalid_link_toast: 'O link de compartilhamento expirou ou é inválido.',
    share_error_toast: 'Não foi possível gerar o link de compartilhamento. Tente novamente.'
  },

  'en-US': {
    // App & Brand
    app_name: 'Gorit',
    app_tagline: 'Study & Exam Tracker',
    app_description: 'Organize and track semester subjects, course content, exam deadlines, and study to-dos with real-time automatic progress calculation.',

    // Header Actions & Data
    autosave_error: 'Autosave error',
    backup_button: 'Backup',
    backup_title: 'Export data backup (JSON)',
    restore_button: 'Restore',
    restore_title: 'Restore backup (JSON)',
    close_btn: 'Close',

    // Quick Semester Stats
    stat_subjects: 'Subjects',
    stat_subjects_manage_hint: 'Click to manage semester subjects',
    stat_next_exam: 'Next Exam',
    stat_next_exam_jump_hint: 'Click to jump straight to your next exam',
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
    search_placeholder: 'Search subject, content, or task...',
    clear_search_tooltip: 'Clear search',
    expand_all: 'Expand All',
    collapse_all: 'Collapse All',
    chrono_order_compact: 'Sorted by upcoming exams',
    dismiss_hint: 'Dismiss notice',
    first_in_line: '1st in line',
    next_upcoming_exam_tooltip: 'Next upcoming exam of the semester!',
    next_exam_tooltip: 'Next exam: {title}',
    all_contents_completed_tooltip: 'All contents completed!',
    exam_date_tooltip: 'Exam date: {date}',
    no_upcoming_exams: 'No upcoming exams',
    no_exams_scheduled: 'No exams scheduled',
    exam_today: 'Exam Today!',
    exam_tomorrow: 'Exam Tomorrow!',
    exam_in_days: 'Exam in {days} days',
    passed_yesterday: 'Passed yesterday',
    days_ago: '{days} days ago',
    completed_badge: 'Completed',
    status_pending: 'Pending',
    tasks_ratio: '{completed}/{total} tasks',
    completed_ratio: '{completed}/{total} completed',
    no_contents_yet: '0% (no contents)',
    reset_all: 'Reset All',
    complete_all: 'All Done',
    toggle_subject_all_tooltip: 'Toggle all contents in this subject as completed or pending',
    add_content: 'Add',
    contents_header: 'Contents ({count})',
    no_contents_in_subject: 'No contents added to this subject yet.',
    add_first_content: 'Add 1st Content',

    // Content Item
    mark_as_pending: 'Mark as Pending',
    mark_as_completed: 'Check as Completed',
    mark_content_aria: 'Mark "{title}" as completed',
    click_calendar_set_date: 'Click calendar to set exam date',
    change_exam_deadline: 'Change exam deadline (autosaves)',
    clear_date_tooltip: 'Clear date',
    no_date_set: 'No date set',
    no_tasks_placeholder: 'No tasks added yet. Type below and press Enter to add a task!',
    add_task_placeholder: 'Add task (e.g. Read chapter 2, Flashcards, Practice questions...)',
    add_task_btn: 'Task',
    edit_content: 'Edit Content',
    delete_content: 'Delete Content',
    delete_task: 'Delete task',
    click_to_edit_task: 'Click to edit task (autosaves)',

    // Empty States
    no_subjects_title: 'No subjects registered yet',
    no_subjects_desc: 'Add your semester subjects to organize course contents, exam deadlines, and tasks.',
    no_search_results_title: 'No content found',
    no_search_results_desc: 'No subjects, contents, or tasks match "{query}".',
    clear_search: 'Clear Search',

    // Semester Subjects View (Tab 2)
    add_new_subject: 'Add New Subject',
    edit_subject: 'Editing Subject',
    editing_autosave_badge: 'Auto-saved',
    new_subject_mode_btn: 'New Subject',
    subject_preview_label: 'Subject Preview',
    subject_preview_placeholder: 'Subject Name',
    subject_name_label: 'Subject Name *',
    subject_name_placeholder: 'e.g. Human Anatomy, Medical Physiology, Pathology...',
    subject_code_label: 'Code or Acronym (optional)',
    subject_code_placeholder: 'e.g. ANAT101, PHYS101, PHARM201...',
    subject_icon_label: 'Subject Icon',
    subject_color_label: 'Subject Color',
    choose_color_tooltip: 'Choose color {color}',
    custom_color_tooltip: 'Custom color',
    registered_subjects_title: 'Registered Subjects for this Semester',
    no_subjects_manage_desc: 'Use the form on the left to register your first semester subject with a custom name, icon, and color.',
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
    cancel_btn: 'Cancel',
    save_content_btn: 'Save Content',

    // Custom Dialogs
    dialog_ok: 'Got it',
    dialog_confirm: 'Confirm',
    dialog_alert_title: 'Notice',
    dialog_confirm_title: 'Confirmation',
    dialog_danger_title: 'Confirm deletion',
    dialog_prompt_title: 'Enter to continue',
    dialog_input_placeholder: 'Type here...',

    // Notifications & Prompts
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
    toast_task_removed: 'Task removed.',
    undo_btn: 'Undo',
    toast_backup_exported: 'Backup exported successfully!',
    toast_data_restored: 'Data restored and autosaved to device!',
    confirm_delete_subject: 'Are you sure you want to delete "{name}" and all its contents and tasks?',
    confirm_delete_content: 'Are you sure you want to delete "{title}" and its tasks?',
    alert_enter_subject_name: 'Please enter a subject name.',
    alert_enter_content_title: 'Please enter a content title.',
    subject_not_found: 'Subject not found.',
    alert_invalid_json: 'Invalid JSON file format.',
    alert_error_reading_json: 'Error reading JSON file: {error}',

    // Auth & Cloud Sync (Flashcards PRO Integration)
    auth_sign_in: 'Sign in with Google',
    auth_sign_in_short: 'Sign in',
    auth_sign_out: 'Sign out',
    auth_signed_in_as: 'Signed in as {name}',
    auth_signin_error: 'Google sign-in failed. Check your connection.',
    auth_signout_success: 'Signed out successfully.',
    account_default_student: 'Student',
    account_default_label: 'Account',
    account_btn_title: 'My Account, Backup & Sync',
    account_modal_title: 'My Account & Data',
    account_modal_subtitle: 'PRO Cloud Sync, CAMBLU Club & Local Backup',
    account_login_prompt_desc: 'Connect your Google account to sync your study progress to the cloud and unlock Flashcards PRO benefits.',
    account_data_backup_title: 'Local Backup & Restore',
    account_data_backup_desc: 'Export a .json backup of your studies or restore a previously saved file on this device.',
    account_open_flashcards_btn: 'Open Spaiq Flashcards',
    account_status_label: 'Plan Status',
    account_pro_badge: 'Flashcards PRO Active',
    account_pro_desc: 'Your PRO subscription unlocks real-time automatic cloud sync across all your devices.',
    account_camblu_badge: 'CAMBLU Club • {tier}',
    account_camblu_pro_desc: 'Your {tier} CAMBLU Club plan unlocks Gorit PRO, subject sharing, and automatic cloud sync.',
    account_camblu_valid_until: 'Valid until {date}',
    account_camblu_portal_btn: 'Manage in CAMBLU Club',
    account_camblu_free_hint: 'CAMBLU Club member (Raro, Épico, or Lendário)? Sign in with your Google email to unlock Gorit PRO automatically.',
    account_camblu_comum_hint: 'CAMBLU Club (Comum) detected. Gorit PRO unlocks starting at the Raro tier (level 2+).',
    camblu_tier_comum: 'Comum',
    camblu_tier_raro: 'Raro',
    camblu_tier_epico: 'Épico',
    camblu_tier_lendario: 'Lendário',
    account_free_badge: 'Free Plan',
    account_free_desc: 'Cloud sync is exclusive to Flashcards PRO subscribers and CAMBLU Club members (tier 2+). Your data remains saved locally on this device.',
    account_upgrade_btn: 'Unlock Cloud Sync with Flashcards PRO',
    cloud_sync_title: 'Cloud Synchronization',
    cloud_sync_status_synced: 'Cloud synced',
    cloud_sync_status_pending: 'Syncing with cloud...',
    cloud_sync_status_offline: 'Offline / Cloud paused',
    cloud_sync_now_btn: 'Sync Now',
    cloud_last_synced: 'Last cloud sync: {time}',
    cloud_never_synced: 'Not synced yet in this session',
    cloud_sync_success_toast: 'Data successfully saved to cloud!',
    cloud_sync_error_toast: 'Could not sync to cloud. We will retry momentarily.',

    // General Tasks & Emojis
    general_tasks_title: 'General Tasks',
    general_tasks_default_content: 'Quick & Daily To-Dos',
    general_tasks_cannot_delete: 'General Tasks is pinned to top and cannot be deleted.',
    pinned_badge: 'Pinned',
    custom_emoji_label: 'Or type/paste any emoji:',

    // Quick Toggle
    toggle_all_expand: 'Expand All',
    toggle_all_collapse: 'Collapse All',
    toggle_all_tooltip: 'Expand or collapse all subjects and tasks with one tap',

    // General Tasks Prioritization & Daily Reminders
    daily_reminder_label: 'Daily Reminder',
    daily_reminder_tooltip: 'Set as recurring daily reminder',
    due_date_label: 'Specific deadline',
    due_today_badge: 'Today',
    due_overdue_badge: 'Overdue',

    // Subject Sharing (PRO)
    share_subject_btn: 'Share',
    sharing_loading_btn: 'Generating...',
    share_subject_title: 'Share Subject with a Friend',
    share_subject_desc: 'Your friend will receive the exact same schedule with all contents and exam dates, with their own independent completion data and subtasks.',
    share_privacy_notice: 'Anyone with this link can add this subject to their studies with full privacy (their progress never affects yours).',
    share_subject_copy_btn: 'Copy Link',
    share_subject_copied: 'Link copied!',
    share_pro_required_title: 'Exclusive PRO Feature',
    share_pro_required_desc: 'Sharing subjects via direct link is exclusive to Flashcards PRO subscribers and CAMBLU Club members (tier 2+).',
    share_pro_card_desc: 'Spaiq Flashcards PRO subscribers and CAMBLU Club members (Raro, Épico, or Lendário) enjoy automatic cloud sync and can share any subject with classmates via direct link.',
    import_share_title: 'Shared Subject Received',
    import_share_subtitle_default: 'Import this schedule into your studies',
    import_share_shared_by: 'Shared by {name}',
    import_share_contents_singular: '1 content and exam date',
    import_share_contents_plural: '{count} contents and exam dates',
    import_share_more_topics: '+ {count} more topics...',
    import_share_loading_title: 'Loading shared subject...',
    import_share_loading_desc: 'Fetching schedule and exam dates from cloud...',
    import_share_notice: 'The schedule and exam deadlines will be imported, but your progress and subtasks will be 100% personal and independent.',
    import_share_btn: 'Add to My Studies',
    import_share_success: 'Subject "{name}" added successfully!',
    share_invalid_link_toast: 'The sharing link has expired or is invalid.',
    share_error_toast: 'Could not generate share link. Please try again.'
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

  document.querySelectorAll('[data-i18n-aria-label]').forEach(el => {
    const key = el.getAttribute('data-i18n-aria-label');
    if (key) {
      el.setAttribute('aria-label', t(key));
    }
  });
}
