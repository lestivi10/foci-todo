import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
afterEach(() => vi.unstubAllGlobals());
it('sends filters and ordering through the typed list boundary', async () => {
  const fetch = vi.fn().mockResolvedValue(new Response('[]'));
  vi.stubGlobal('fetch', fetch);
  expect(await api.list({ status: 'overdue', sort: 'dueDate', order: 'asc' })).toEqual([]);
  expect(fetch.mock.calls[0][0]).toBe('/api/todos?status=overdue&sort=dueDate&order=asc');
});
it('preserves structured validation errors', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: [{ loc: ['body', 'title'], msg: 'Title is required' }] }), { status: 422 })));
  await expect(api.create({ title: '' })).rejects.toMatchObject({ message: 'title: Title is required', status: 422 });
});
it('handles empty deletion responses', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
  await expect(api.remove('id')).resolves.toBeUndefined();
});
it('gives a readable fallback for non-JSON failures', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('Bad gateway', { status: 502 })));
  await expect(api.get('id')).rejects.toBeInstanceOf(ApiError);
});
