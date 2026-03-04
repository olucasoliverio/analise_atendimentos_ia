// src/pages/AuthCallback.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const AuthCallback = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processando autenticacao...');

  useEffect(() => {
    const handleAuth = async () => {
      try {
        console.log('Iniciando processamento do callback...');

        const params = new URLSearchParams(window.location.search);
        const error = params.get('error_description') || params.get('error');

        if (error) {
          throw new Error(error);
        }

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session) {
          console.log('Sessao encontrada!', session.user.email);
          navigate('/dashboard', { replace: true });
          return;
        }

        setStatus('Sincronizando conta...');

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, nextSession) => {
          if (nextSession) {
            subscription.unsubscribe();
            navigate('/dashboard', { replace: true });
          }
        });

        setTimeout(() => {
          subscription.unsubscribe();
          navigate('/login', { replace: true });
        }, 10000);
      } catch (err: any) {
        console.error('Erro no callback:', err);
        setStatus(`Erro: ${err.message || 'Falha na autenticacao'}`);
        setTimeout(() => navigate('/login', { replace: true }), 5000);
      }
    };

    void handleAuth();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50">
      <div className="card-glass flex flex-col items-center gap-4 p-8">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-brand-500 border-t-transparent" />
        <div className="text-center">
          <p className="font-medium text-surface-900">{status}</p>
          <p className="mt-2 text-xs text-surface-400">Nao feche esta janela</p>
        </div>
      </div>
    </div>
  );
};
