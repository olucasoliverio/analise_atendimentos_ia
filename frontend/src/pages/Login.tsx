// src/pages/Login.tsx
import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Sparkles } from 'lucide-react';

export const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`
      }
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
    // Se OK, o Supabase redireciona para o Google — não precisa fazer nada mais
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 via-white to-brand-100">
      <div className="max-w-md w-full px-4">

        {/* Logo / Header */}
        <div className="text-center mb-10">
          <div className="inline-flex w-20 h-20 bg-gradient-to-br from-brand-600 to-brand-800 rounded-3xl items-center justify-center mb-5 shadow-soft shadow-brand-500/40">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-display font-bold text-surface-900">NextFit AI</h1>
          <p className="text-surface-500 mt-2 text-sm">Análise Inteligente de Atendimentos</p>
        </div>

        {/* Card */}
        <div className="card-glass p-8 shadow-glass">
          <h2 className="text-xl font-display font-semibold text-surface-900 mb-2 text-center">
            Bem-vindo!
          </h2>
          <p className="text-surface-500 text-sm text-center mb-8">
            Faça login com a conta Google da empresa para acessar o painel de análise de atendimentos.
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-5 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white border border-surface-200 rounded-xl text-surface-800 font-medium shadow-sm hover:shadow-md hover:border-surface-300 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-surface-400 border-t-brand-600 rounded-full animate-spin" />
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            {loading ? 'Redirecionando...' : 'Entrar com Google'}
          </button>

          <p className="text-center text-xs text-surface-400 mt-6">
            Acesso restrito a colaboradores
          </p>
        </div>
      </div>
    </div>
  );
};
