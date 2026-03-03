// src/services/api.ts
import axios from 'axios';
import { supabase } from '../lib/supabase';

let baseURL = import.meta.env.VITE_API_URL;

// Log para debug no console do navegador do usuário
if (baseURL) {
  console.log('📡 Usando API em:', baseURL);
} else {
  console.error('⚠️ CRITICAL: VITE_API_URL não definida no Vercel!');
}

// Garante que o baseURL termine em /api se não for relativo
if (baseURL && !baseURL.endsWith('/api')) {
  baseURL = baseURL.endsWith('/') ? `${baseURL}api` : `${baseURL}/api`;
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