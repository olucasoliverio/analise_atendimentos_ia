// src/store/useAuthStore.ts
import { create } from 'zustand';
import type { User } from '../types';
import { authService } from '../services/auth.service';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  logout: () => void;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  logout: () => {
    authService.logout();
    set({ user: null, isAuthenticated: false });
  },

  init: () => {
    const user = authService.getUser();
    set({
      user,
      isAuthenticated: !!user,
    });
  },
}));