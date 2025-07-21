import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LocalStorageService } from './localStorage.service';

describe('LocalStorageService', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('should save data to localStorage', () => {
    const key = 'testKey';
    const value = { data: 'testValue' };
    LocalStorageService.save(key, value);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(value));
  });

  it('should retrieve data from localStorage', () => {
    const key = 'testKey';
    const value = { data: 'testValue' };
    localStorage.setItem(key, JSON.stringify(value));
    const retrievedValue = LocalStorageService.get(key);
    expect(retrievedValue).toEqual(value);
  });

  it('should remove data from localStorage', () => {
    const key = 'testKey';
    const value = { data: 'testValue' };
    localStorage.setItem(key, JSON.stringify(value));
    LocalStorageService.remove(key);
    expect(localStorage.getItem(key)).toBeNull();
  });

  it('should return null if item does not exist', () => {
    const key = 'nonExistentKey';
    const retrievedValue = LocalStorageService.get(key);
    expect(retrievedValue).toBeNull();
  });
});
