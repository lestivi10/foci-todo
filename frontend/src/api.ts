export interface Todo {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
}
export type TodoInput = Pick<Todo, 'title'> & Partial<Pick<Todo, 'description' | 'dueDate' | 'isCompleted'>>;
export interface ListQuery {
  status: 'all' | 'incomplete' | 'completed' | 'overdue';
  sort: 'createdAt' | 'dueDate' | 'title';
  order: 'asc' | 'desc';
}
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) { super(message); }
}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api/todos${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  } catch {
    throw new Error('Unable to connect. Check your connection and try again.');
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { detail?: unknown } | null;
    const detail = body?.detail;
    let message = `Unable to complete this request (${response.status}). Please try again.`;
    if (typeof detail === 'string') message = detail;
    if (Array.isArray(detail)) message = detail.map((issue: { loc?: unknown[]; msg?: string }) => `${issue.loc?.at(-1) ?? 'Input'}: ${issue.msg ?? 'Invalid value'}`).join('. ');
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}
export const api = {
  list: (query: ListQuery) => request<Todo[]>(`?${new URLSearchParams({ ...query })}`),
  get: (id: string) => request<Todo>(`/${encodeURIComponent(id)}`),
  create: (input: TodoInput) => request<Todo>('', { method: 'POST', body: JSON.stringify(input) }),
  update: (id: string, input: Partial<TodoInput>) => request<Todo>(`/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(input) }),
  remove: (id: string) => request<void>(`/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
