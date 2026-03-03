import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { LogOut, LayoutDashboard, Search, FileText, Sparkles, X } from 'lucide-react';

type SidebarProps = {
    isOpen: boolean;
    onClose: () => void;
};

export const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
    const { user, isAuthenticated, logout } = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = () => {
        logout();
        onClose();
        navigate('/login');
    };

    const isActive = (path: string) => location.pathname === path;
    const handleNavigate = () => onClose();

    if (!isAuthenticated) return null;

    return (
        <>
            {isOpen ? (
                <button
                    type="button"
                    className="fixed inset-0 z-40 bg-surface-900/30 lg:hidden"
                    onClick={onClose}
                    aria-label="Fechar menu"
                />
            ) : null}

            <aside
                className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col border-r border-surface-200 bg-white transition-transform duration-300 lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
            >
            <div className="flex items-center gap-3 px-6 h-20 border-b border-surface-100">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-600 to-brand-800 flex items-center justify-center shadow-soft shadow-brand-500/30">
                    <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="flex flex-col">
                    <span className="font-display font-bold text-lg text-surface-900 leading-tight">NextFit AI</span>
                    <span className="text-[10px] font-medium text-brand-600 tracking-wider uppercase">Analyst</span>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="ml-auto inline-flex items-center justify-center w-10 h-10 rounded-xl text-surface-500 hover:bg-surface-100 hover:text-surface-900 lg:hidden"
                    aria-label="Fechar menu"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            <div className="flex-1 px-4 py-6 overflow-y-auto space-y-6">
                <div>
                    <div className="px-3 mb-2 text-xs font-semibold text-surface-400 uppercase tracking-wider">
                        Menu
                    </div>
                    <nav className="space-y-1">
                        <Link
                            to="/dashboard"
                            onClick={handleNavigate}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive('/dashboard')
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
                                }`}
                        >
                            <LayoutDashboard className={`w-5 h-5 ${isActive('/dashboard') ? 'text-brand-600' : 'text-surface-400'}`} />
                            Dashboard
                        </Link>
                        <Link
                            to="/search"
                            onClick={handleNavigate}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive('/search')
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
                                }`}
                        >
                            <Search className={`w-5 h-5 ${isActive('/search') ? 'text-brand-600' : 'text-surface-400'}`} />
                            Nova Análise
                        </Link>
                        <Link
                            to="/analyses"
                            onClick={handleNavigate}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${isActive('/analyses') || location.pathname.includes('/analysis/')
                                    ? 'bg-brand-50 text-brand-700'
                                    : 'text-surface-600 hover:text-surface-900 hover:bg-surface-50'
                                }`}
                        >
                            <FileText className={`w-5 h-5 ${isActive('/analyses') || location.pathname.includes('/analysis/') ? 'text-brand-600' : 'text-surface-400'}`} />
                            Histórico
                        </Link>
                    </nav>
                </div>
            </div>

            <div className="p-4 border-t border-surface-100">
                <div className="p-3 bg-surface-50 rounded-xl mb-2">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-medium text-sm">
                            {user?.name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-surface-900 truncate">
                                {user?.name}
                            </p>
                            <p className="text-xs text-surface-500 truncate">
                                {user?.email}
                            </p>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                    <LogOut className="w-4 h-4" />
                    Sair da conta
                </button>
            </div>
            </aside>
        </>
    );
};
