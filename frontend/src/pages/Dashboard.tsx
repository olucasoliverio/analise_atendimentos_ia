import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CalendarClock, FileBarChart, Flame, Plus, Search, Sparkles } from 'lucide-react';
import { Loading } from '../components/Common/Loading';
import { analysisService } from '../services/analysis.service';

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type PeriodFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM';
type DashboardAnalysis = {
  id: string;
  createdAt: string;
  conversationId?: string;
  executiveSummary?: string;
  preview?: string;
  riskLevel?: string;
  conversation?: {
    customerName?: string;
    customerEmail?: string;
  };
};

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const extractRiskFromText = (text: string): RiskLevel | null => {
  const normalized = normalizeText(text);

  if (normalized.includes('criticidade geral: critico') || normalized.includes('risco de recontato: critico')) {
    return 'CRITICAL';
  }

  if (normalized.includes('criticidade geral: alto') || normalized.includes('risco de recontato: alto')) {
    return 'HIGH';
  }

  if (normalized.includes('criticidade geral: medio') || normalized.includes('risco de recontato: medio')) {
    return 'MEDIUM';
  }

  if (normalized.includes('criticidade geral: baixo') || normalized.includes('risco de recontato: baixo')) {
    return 'LOW';
  }

  return null;
};

const getDisplayRiskLevel = (analysis: any): RiskLevel => {
  const candidateText = `${analysis.executiveSummary || ''}\n${analysis.preview || ''}`;
  const parsed = extractRiskFromText(candidateText);

  if (parsed) return parsed;
  if (analysis.riskLevel === 'CRITICAL' || analysis.riskLevel === 'HIGH' || analysis.riskLevel === 'MEDIUM') {
    return analysis.riskLevel;
  }

  return 'LOW';
};

const riskLabels: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
};

const riskBarClasses: Record<RiskLevel, string> = {
  LOW: 'bg-emerald-500',
  MEDIUM: 'bg-yellow-500',
  HIGH: 'bg-orange-500',
  CRITICAL: 'bg-red-500',
};

const riskOrder: RiskLevel[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const isWithinPeriod = (createdAt: string, periodFilter: PeriodFilter) => {
  if (periodFilter === 'ALL') return true;

  const analysisDate = new Date(createdAt);
  if (Number.isNaN(analysisDate.getTime())) return false;

  const today = startOfToday();

  if (periodFilter === 'TODAY') {
    return analysisDate >= today;
  }

  if (periodFilter === 'LAST_7_DAYS') {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - 6);
    return analysisDate >= threshold;
  }

  if (periodFilter === 'LAST_30_DAYS') {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - 29);
    return analysisDate >= threshold;
  }

  if (periodFilter === 'LAST_90_DAYS') {
    const threshold = new Date(today);
    threshold.setDate(threshold.getDate() - 89);
    return analysisDate >= threshold;
  }

  return true;
};

export const Dashboard = () => {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<DashboardAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAnalyses = async () => {
      try {
        const data = await analysisService.list();
        setAnalyses(data);
      } catch {
        console.error('Erro ao carregar análises do dashboard');
      } finally {
        setLoading(false);
      }
    };

    void loadAnalyses();
  }, []);

  if (loading) return <Loading />;

  const analysesWithRisk: Array<DashboardAnalysis & { displayRiskLevel: RiskLevel }> = analyses.map((analysis) => ({
    ...analysis,
    displayRiskLevel: getDisplayRiskLevel(analysis),
  }));

  const todayCount = analysesWithRisk.filter((analysis) => isWithinPeriod(analysis.createdAt, 'TODAY')).length;
  const last7DaysCount = analysesWithRisk.filter((analysis) => isWithinPeriod(analysis.createdAt, 'LAST_7_DAYS')).length;
  const criticalCount = analysesWithRisk.filter((analysis) => analysis.displayRiskLevel === 'CRITICAL').length;

  const riskDistribution: Array<{ risk: RiskLevel; count: number; percentage: number }> = riskOrder.map((risk) => {
    const count = analysesWithRisk.filter((analysis) => analysis.displayRiskLevel === risk).length;
    const percentage = analysesWithRisk.length > 0 ? Math.round((count / analysesWithRisk.length) * 100) : 0;

    return { risk, count, percentage };
  });

  const latestAnalyses = [...analysesWithRisk]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div className="absolute inset-0 overflow-y-auto bg-surface-50">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col gap-3 animate-fade-in">
          <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-surface-900">
            <Sparkles className="h-8 w-8 text-brand-500" />
            Dashboard
          </h1>
          <p className="max-w-2xl text-sm text-surface-500">
            Acompanhe o volume de análises, a distribuição de risco e os atalhos para agir rápido no histórico.
          </p>
        </div>

        <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="card-glass border border-surface-200 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Volume total</span>
              <FileBarChart className="h-5 w-5 text-brand-500" />
            </div>
            <p className="text-4xl font-display font-bold text-surface-900">{analysesWithRisk.length}</p>
            <p className="mt-2 text-sm text-surface-500">Todas as análises disponíveis no seu histórico.</p>
          </div>

          <div className="card-glass border border-surface-200 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Hoje</span>
              <CalendarClock className="h-5 w-5 text-sky-500" />
            </div>
            <p className="text-4xl font-display font-bold text-surface-900">{todayCount}</p>
            <p className="mt-2 text-sm text-surface-500">Análises criadas desde o início do dia.</p>
          </div>

          <div className="card-glass border border-surface-200 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Últimos 7 dias</span>
              <CalendarClock className="h-5 w-5 text-indigo-500" />
            </div>
            <p className="text-4xl font-display font-bold text-surface-900">{last7DaysCount}</p>
            <p className="mt-2 text-sm text-surface-500">Recorte rápido para acompanhar a semana.</p>
          </div>

          <div className="card-glass border border-surface-200 p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-surface-400">Risco crítico</span>
              <Flame className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-4xl font-display font-bold text-surface-900">{criticalCount}</p>
            <p className="mt-2 text-sm text-surface-500">Casos que merecem triagem imediata.</p>
          </div>
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="card-glass border border-surface-200 p-6 animate-slide-up" style={{ animationDelay: '100ms' }}>
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-display font-semibold text-surface-900">Distribuição de risco</h2>
                <p className="mt-1 text-sm text-surface-500">Como o histórico está distribuído entre os níveis de risco.</p>
              </div>
              <button onClick={() => navigate('/analyses')} className="btn btn-secondary bg-white shadow-sm">
                Ver histórico
              </button>
            </div>

            <div className="space-y-4">
              {riskDistribution.map((item) => (
                <div key={item.risk}>
                  <div className="mb-2 flex items-center justify-between text-sm">
                    <span className="font-medium text-surface-700">{riskLabels[item.risk]}</span>
                    <span className="text-surface-500">
                      {item.count} análise{item.count !== 1 && 's'} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-surface-100">
                    <div
                      className={`h-2.5 rounded-full transition-all ${riskBarClasses[item.risk]}`}
                      style={{ width: `${item.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card-glass border border-surface-200 p-6 animate-slide-up" style={{ animationDelay: '180ms' }}>
            <div className="mb-6">
              <h2 className="text-xl font-display font-semibold text-surface-900">Atalhos</h2>
              <p className="mt-1 text-sm text-surface-500">Acesse rapidamente os fluxos mais usados.</p>
            </div>

            <div className="grid gap-3">
              <button onClick={() => navigate('/search')} className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
                  <Plus className="h-4 w-4 text-brand-500" />
                  Nova análise
                </span>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </button>

              <button onClick={() => navigate('/analyses')} className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/40">
                <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
                  <Search className="h-4 w-4 text-brand-500" />
                  Ver histórico completo
                </span>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </button>

              <button
                onClick={() => navigate('/analyses', { state: { riskFilter: 'CRITICAL' } })}
                className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-red-200 hover:bg-red-50/40"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Somente críticas
                </span>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </button>

              <button
                onClick={() => navigate('/analyses', { state: { periodFilter: 'LAST_7_DAYS' } })}
                className="flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 text-left transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
              >
                <span className="flex items-center gap-3 text-sm font-medium text-surface-700">
                  <CalendarClock className="h-4 w-4 text-indigo-500" />
                  Últimos 7 dias
                </span>
                <ArrowRight className="h-4 w-4 text-surface-400" />
              </button>
            </div>
          </section>
        </div>

        <section className="card-glass border border-surface-200 p-6 animate-slide-up" style={{ animationDelay: '260ms' }}>
          <div className="mb-6 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-display font-semibold text-surface-900">Últimas análises</h2>
              <p className="mt-1 text-sm text-surface-500">As 5 análises mais recentes para abrir direto.</p>
            </div>
            <button onClick={() => navigate('/analyses')} className="btn btn-secondary bg-white shadow-sm">
              Ver todas
            </button>
          </div>

          {latestAnalyses.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-surface-200 bg-surface-50 px-6 py-12 text-center">
              <p className="text-lg font-display font-semibold text-surface-900">Nenhuma análise encontrada</p>
              <p className="mt-2 text-sm text-surface-500">Assim que você gerar análises, este painel vai destacar os itens recentes.</p>
              <button onClick={() => navigate('/search')} className="btn btn-primary mt-5">
                Gerar primeira análise
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {latestAnalyses.map((analysis) => (
                <button
                  key={analysis.id}
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="flex w-full items-center justify-between gap-4 rounded-2xl border border-surface-200 bg-white px-4 py-4 text-left transition-colors hover:border-brand-200 hover:bg-brand-50/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-surface-900">
                      {analysis.conversation?.customerName || analysis.conversation?.customerEmail || 'Cliente sem identificação'}
                    </p>
                    <p className="mt-1 truncate text-xs text-surface-500">
                      {analysis.conversation?.customerEmail || analysis.conversationId || 'Sem referência'}
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      analysis.displayRiskLevel === 'CRITICAL'
                        ? 'bg-red-50 text-red-700'
                        : analysis.displayRiskLevel === 'HIGH'
                          ? 'bg-orange-50 text-orange-700'
                          : analysis.displayRiskLevel === 'MEDIUM'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-emerald-50 text-emerald-700'
                    }`}>
                      {riskLabels[analysis.displayRiskLevel]}
                    </span>
                    <span className="whitespace-nowrap text-xs font-medium text-surface-500">
                      {new Date(analysis.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </span>
                    <ArrowRight className="h-4 w-4 text-surface-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
