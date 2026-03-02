// src/App.tsx
import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Layout/Sidebar';
import { PrivateRoute } from './components/Common/PrivateRoute';
import { Login } from './pages/Login';
import { Register } from './pages/Register';
import { ConversationExplorer } from './pages/ConversationExplorer';
import { AnalysisView } from './pages/AnalysisView';
import { AnalysisList } from './pages/AnalysisList';
import { useAuthStore } from './store/useAuthStore';

const Dashboard = () => (
  <div className="max-w-7xl mx-auto py-10 px-6 animate-fade-in">
    <div className="flex flex-col gap-2 mb-8">
      <h1 className="text-3xl font-display font-bold text-surface-900">Visão Geral</h1>
      <p className="text-surface-500">Acompanhe as métricas de qualidade e uso da IA no sistema.</p>
    </div>

    <div className="grid md:grid-cols-3 gap-6">
      <div className="card-glass p-6 group cursor-pointer hover:border-brand-200 transition-colors">
        <h3 className="text-sm font-medium text-surface-500 mb-2 uppercase tracking-wider">Total de Análises</h3>
        <p className="text-4xl font-display font-bold text-brand-600 group-hover:scale-105 transition-transform origin-left">0</p>
      </div>
      <div className="card-glass p-6 group cursor-pointer hover:border-brand-200 transition-colors">
        <h3 className="text-sm font-medium text-surface-500 mb-2 uppercase tracking-wider">Esta Semana</h3>
        <p className="text-4xl font-display font-bold text-brand-600 group-hover:scale-105 transition-transform origin-left">0</p>
      </div>
      <div className="card-glass p-6 group cursor-pointer hover:border-brand-200 transition-colors">
        <h3 className="text-sm font-medium text-surface-500 mb-2 uppercase tracking-wider">Média de Qualidade</h3>
        <p className="text-4xl font-display font-bold text-brand-600 group-hover:scale-105 transition-transform origin-left">-</p>
      </div>
    </div>
  </div>
);

function App() {
  const init = useAuthStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-surface-50">
        <Sidebar />

        <main className="flex-1 w-full pl-0 md:pl-64 transition-all duration-300 relative">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/search" element={<PrivateRoute><ConversationExplorer /></PrivateRoute>} />
            <Route path="/analyses" element={<PrivateRoute><AnalysisList /></PrivateRoute>} />
            <Route path="/analysis/:id" element={<PrivateRoute><AnalysisView /></PrivateRoute>} />

            <Route path="/" element={<Navigate to="/search" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;