// src/App.tsx
import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { Sidebar } from './components/Layout/Sidebar';
import { PrivateRoute } from './components/Common/PrivateRoute';
import { Login } from './pages/Login';
import { AuthCallback } from './pages/AuthCallback';
import { Dashboard } from './pages/Dashboard';
import { ConversationExplorer } from './pages/ConversationExplorer';
import { AnalysisView } from './pages/AnalysisView';
import { AnalysisList } from './pages/AnalysisList';
import { useAuthStore } from './store/useAuthStore';

function App() {
  const init = useAuthStore((state) => state.init);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    init();
  }, [init]);

  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-surface-50">
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        {isAuthenticated && !isSidebarOpen ? (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="lg:hidden fixed top-4 left-4 z-[60] inline-flex h-11 w-11 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-700 shadow-sm"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        ) : null}

        <main
          className={`relative w-full flex-1 transition-all duration-300 ${
            isAuthenticated ? 'pl-0 lg:pl-64' : 'pl-0'
          }`}
        >
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />

            <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
            <Route path="/search" element={<PrivateRoute><ConversationExplorer /></PrivateRoute>} />
            <Route path="/analyses" element={<PrivateRoute><AnalysisList /></PrivateRoute>} />
            <Route path="/analysis/:id" element={<PrivateRoute><AnalysisView /></PrivateRoute>} />

            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
