import { TodoPriority, TodoStatus, UserDefaultProjectTab, UserDefaultTaskAssigneeFilter, UserDefaultTaskView, UserSettings, UserTextSize } from '@/types';

export const DEFAULT_USER_SETTINGS: UserSettings = {
  text_size: 'medium',
  default_project_tab: 'fields',
  default_task_view: 'list',
  default_task_hide_done: false,
  default_task_statuses: [],
  default_task_priorities: [],
  default_task_assignee: '',
  reduce_motion: false,
};

const TEXT_SIZES: UserTextSize[] = ['xsmall', 'small', 'medium', 'large', 'xlarge'];
const DEFAULT_PROJECT_TABS: UserDefaultProjectTab[] = ['fields', 'tasks', 'members', 'notes', 'assets'];
const DEFAULT_TASK_VIEWS: UserDefaultTaskView[] = ['list', 'kanban', 'gantt'];
const DEFAULT_TASK_ASSIGNEES: UserDefaultTaskAssigneeFilter[] = ['', 'me', 'unassigned'];
const TODO_STATUSES: TodoStatus[] = ['todo', 'in_progress', 'done'];
const TODO_PRIORITIES: TodoPriority[] = ['low', 'medium', 'high', 'urgent'];

export function normalizeUserSettings(input: unknown): UserSettings {
  const raw = input && typeof input === 'object' ? input as Partial<UserSettings> : {};
  return {
    text_size: TEXT_SIZES.includes(raw.text_size as UserTextSize) ? raw.text_size as UserTextSize : DEFAULT_USER_SETTINGS.text_size,
    default_project_tab: DEFAULT_PROJECT_TABS.includes(raw.default_project_tab as UserDefaultProjectTab)
      ? raw.default_project_tab as UserDefaultProjectTab
      : DEFAULT_USER_SETTINGS.default_project_tab,
    default_task_view: DEFAULT_TASK_VIEWS.includes(raw.default_task_view as UserDefaultTaskView)
      ? raw.default_task_view as UserDefaultTaskView
      : DEFAULT_USER_SETTINGS.default_task_view,
    default_task_hide_done: Boolean(raw.default_task_hide_done),
    default_task_statuses: Array.isArray(raw.default_task_statuses)
      ? raw.default_task_statuses.filter((status): status is TodoStatus => TODO_STATUSES.includes(status as TodoStatus))
      : DEFAULT_USER_SETTINGS.default_task_statuses,
    default_task_priorities: Array.isArray(raw.default_task_priorities)
      ? raw.default_task_priorities.filter((priority): priority is TodoPriority => TODO_PRIORITIES.includes(priority as TodoPriority))
      : DEFAULT_USER_SETTINGS.default_task_priorities,
    default_task_assignee: DEFAULT_TASK_ASSIGNEES.includes(raw.default_task_assignee as UserDefaultTaskAssigneeFilter)
      ? raw.default_task_assignee as UserDefaultTaskAssigneeFilter
      : DEFAULT_USER_SETTINGS.default_task_assignee,
    reduce_motion: Boolean(raw.reduce_motion),
  };
}

export function parseUserSettingsRow(raw: string | null | undefined): UserSettings {
  if (!raw) return DEFAULT_USER_SETTINGS;
  try {
    return normalizeUserSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function serializeUserSettings(settings: UserSettings): string {
  return JSON.stringify(normalizeUserSettings(settings));
}
