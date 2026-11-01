import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useChat } from '../useChat';
import type { ChatMessage } from '../types';

const auth = vi.hoisted(() => ({ session: null as { user: { id: string } } | null }));

vi.mock('@/app/AuthProvider', () => ({ useAuth: () => auth }));
vi.mock('@/app/SemesterProvider', () => ({ useSemester: () => ({ semester: null }) }));
vi.mock('@/lib/hooks', () => ({ useCourses: () => ({ data: [] }), useTasks: () => ({ data: [] }) }));
vi.mock('@/lib/events', () => ({ useCampusEvents: () => ({ data: null }) }));

function history(content: string): ChatMessage[] {
  return [{ id: content, role: 'assistant', content }];
}

function store(identity: string, messages: ChatMessage[]) {
  localStorage.setItem(`tku.chat.v2:${identity}`, JSON.stringify(messages));
}

describe('useChat identity history', () => {
  beforeEach(() => {
    auth.session = { user: { id: 'alice' } };
  });

  it('keeps two users histories separate across mounts and writes', () => {
    const alice = history('Alice private schedule');
    const bob = history('Bob private tasks');
    store('alice', alice);
    store('bob', bob);
    const first = renderHook(() => useChat());
    expect(first.result.current.messages).toEqual(alice);
    act(() => first.result.current.clear());
    expect(localStorage.getItem('tku.chat.v2:alice')).toBe('[]');
    first.unmount();

    auth.session = { user: { id: 'bob' } };
    const second = renderHook(() => useChat());
    expect(second.result.current.messages).toEqual(bob);
    expect(JSON.parse(localStorage.getItem('tku.chat.v2:bob')!)).toEqual(bob);
  });

  it('replaces messages when switching users without overwriting either history', () => {
    const alice = history('Alice private schedule');
    const bob = history('Bob private tasks');
    store('alice', alice);
    store('bob', bob);
    const { result, rerender } = renderHook(() => useChat());

    auth.session = { user: { id: 'bob' } };
    rerender();
    expect(result.current.messages).toEqual(bob);
    expect(JSON.parse(localStorage.getItem('tku.chat.v2:bob')!)).toEqual(bob);

    auth.session = { user: { id: 'alice' } };
    rerender();
    expect(result.current.messages).toEqual(alice);
    expect(JSON.parse(localStorage.getItem('tku.chat.v2:alice')!)).toEqual(alice);
  });

  it('clears messages when switching to a user without history', () => {
    store('alice', history('Alice private schedule'));
    const { result, rerender } = renderHook(() => useChat());
    auth.session = { user: { id: 'new-user' } };
    rerender();
    expect(result.current.messages).toEqual([]);
    expect(localStorage.getItem('tku.chat.v2:new-user')).toBe('[]');
  });

  it('deletes the legacy shared history without reading or migrating it', () => {
    localStorage.setItem('tku.chat.v1', JSON.stringify(history('Unknown owner private answer')));
    const getItem = vi.spyOn(Storage.prototype, 'getItem');
    try {
      const { result } = renderHook(() => useChat());
      expect(result.current.messages).toEqual([]);
      expect(getItem).not.toHaveBeenCalledWith('tku.chat.v1');
      expect(localStorage.getItem('tku.chat.v1')).toBeNull();
      expect(localStorage.getItem('tku.chat.v2:alice')).toBe('[]');
    } finally {
      getItem.mockRestore();
    }
  });

  it('keeps guest history separate when signing in and signing out', () => {
    const guest = history('Guest answer');
    const alice = history('Alice private schedule');
    store('guest', guest);
    store('alice', alice);
    auth.session = null;
    const { result, rerender } = renderHook(() => useChat());
    expect(result.current.messages).toEqual(guest);

    auth.session = { user: { id: 'alice' } };
    rerender();
    expect(result.current.messages).toEqual(alice);
    act(() => result.current.clear());

    auth.session = null;
    rerender();
    expect(result.current.messages).toEqual(guest);
    expect(JSON.parse(localStorage.getItem('tku.chat.v2:guest')!)).toEqual(guest);
    expect(localStorage.getItem('tku.chat.v2:alice')).toBe('[]');
  });
});
