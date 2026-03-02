// src/services/conversation.service.ts
import api from './api';

export const conversationService = {
  async getById(id: string) {
    const { data } = await api.get(`/conversations/${id}`);
    return data;
  },

  async getMultiple(ids: string[]) {
    const { data } = await api.post('/conversations/multiple', { ids });
    return data;
  },

  async getByEmail(email: string) {
    const { data } = await api.get(`/conversations/by-email/${encodeURIComponent(email)}`);
    return data;
  },

  async getByCustomer(customerId: string) {
    const { data } = await api.get(`/conversations/customer/${customerId}`);
    return data;
  },
};