// src/store/useAuthStore.ts
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

interface User {
  id: string;
  email: string;
  name?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;           // true enquanto a sessão ainda está sendo verificada
  setUser: (user: User | null) => void;
  logout: () => Promise<void>;
  init: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  loading: true,              // começa como true — aguarda sessão

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
    }),

  logout: async () => {
    await supabase.auth.signOut();
    set({ user: null, isAuthenticated: false });
  },

  init: () => {
    // Ouvir mudanças na sessão do Supabase
    // onAuthStateChange dispara imediatamente com a sessão atual (incluindo o callback do OAuth)
    supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        set({
          user: {
            id: session.user.id,
            email: session.user.email!,
            name:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name,
          },
          isAuthenticated: true,
          loading: false,
        });
      } else {
        set({ user: null, isAuthenticated: false, loading: false });
      }
    });
  },
}));