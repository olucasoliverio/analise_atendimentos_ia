
// src/pages/Register.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { useAuthStore } from '../store/useAuthStore';
import { Button } from '../components/Common/Button';
import { Input } from '../components/Common/Input';

export const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const setUser = useAuthStore((state) => state.setUser);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await authService.register({ name, email, password });
      setUser(response.user);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-brand-100">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 bg-gradient-to-br from-brand-600 to-brand-800 rounded-2xl items-center justify-center mb-4">
            <span className="text-white font-bold text-3xl">N</span>
          </div>
          <h2 className="text-3xl font-bold text-gray-900">Next Fit AI Analyst</h2>
          <p className="text-gray-600 mt-2">Crie sua conta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Registrar</h3>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Nome"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              required
            />

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              required
            />

            <Input
              label="Senha"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              minLength={6}
              required
            />

            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="w-full"
            >
              Registrar
            </Button>
          </form>

          <p className="mt-6 text-center text-gray-600">
            Já tem uma conta?{' '}
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">
              Faça login
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};
