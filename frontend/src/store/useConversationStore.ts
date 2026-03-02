// src/store/useConversationStore.ts
import { create } from 'zustand';
import type { Conversation } from '../types';

interface ConversationState {
  conversations: Conversation[];
  selectedConversations: Conversation[];
  setConversations: (conversations: Conversation[]) => void;
  addConversation: (conversation: Conversation) => void;
  selectConversation: (conversation: Conversation) => void;
  deselectConversation: (id: string) => void;
  clearSelected: () => void;
}

export const useConversationStore = create<ConversationState>((set) => ({
  conversations: [],
  selectedConversations: [],

  setConversations: (conversations) =>
    set({ conversations }),

  addConversation: (conversation) =>
    set((state) => ({
      conversations: [...state.conversations, conversation],
    })),

  selectConversation: (conversation) =>
    set((state) => ({
      selectedConversations: [...state.selectedConversations, conversation],
    })),

  deselectConversation: (id) =>
    set((state) => ({
      selectedConversations: state.selectedConversations.filter((c) => c.id !== id),
    })),

  clearSelected: () =>
    set({ selectedConversations: [] }),
}));