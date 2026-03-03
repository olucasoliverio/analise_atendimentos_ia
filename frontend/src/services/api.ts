// src/services/api.ts
import axios from 'axios';
import { supabase } from '../lib/supabase';

const baseURL = import.meta.env.VITE_API_URL;

if (!baseURL) {
  console.error('⚠️ CRITICAL: VITE_API_URL is NOT defined! The app will try to call the same domain which might fail.');
}

const api = axios.create({
  baseURL: baseURL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Interceptor: busca o token do Supabase a cada requisição
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;