// src/pages/AuthCallback.tsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export const AuthCallback = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState('Processando autenticação...');

    useEffect(() => {
        const handleAuth = async () => {
            try {
                console.log('Iniciando processamento do callback...');

                // Verifica se há erro na URL vindo do Supabase
                const params = new URLSearchParams(window.location.search);
                const error = params.get('error_description') || params.get('error');

                if (error) {
                    throw new Error(error);
                }

                // Aguarda a sessão ser estabelecida
                // No Supabase v2, o exchange acontece automaticamente se detectSessionInUrl for true (padrão)
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;

                if (session) {
                    console.log('Sessão encontrada!', session.user.email);
                    navigate('/search', { replace: true });
                } else {
                    // Se não houver sessão ainda, vamos esperar o evento SIGNED_IN
                    console.log('Sessão não encontrada no getSession, aguardando evento...');
                    setStatus('Sincronizando conta...');

                    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                        console.log('Evento de auth recebido:', event);
                        if (session) {
                            subscription.unsubscribe();
                            navigate('/search', { replace: true });
                        }
                    });

                    // Se em 10 segundos nada acontecer, volta pro login
                    setTimeout(() => {
                        subscription.unsubscribe();
                        navigate('/login', { replace: true });
                    }, 10000);
                }
            } catch (err: any) {
                console.error('Erro no callback:', err);
                setStatus(`Erro: ${err.message || 'Falha na autenticação'}`);
                setTimeout(() => navigate('/login'), 5000);
            }
        };

        handleAuth();
    }, [navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-surface-50">
            <div className="card-glass p-8 flex flex-col items-center gap-4">
                <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
                <div className="text-center">
                    <p className="font-medium text-surface-900">{status}</p>
                    <p className="text-xs text-surface-400 mt-2">Não feche esta janela</p>
                </div>
            </div>
        </div>
    );
};
