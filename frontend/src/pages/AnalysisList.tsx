import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Trash2, Eye, Hash, Mail, Sparkles, Filter, MoreVertical, Search as SearchIcon, Calendar } from 'lucide-react';
import { Loading } from '../components/Common/Loading';
import { analysisService } from '../services/analysis.service';
import { parseAnalysisText } from '../utils/analysisParser';

type RiskLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
type RiskFilter = 'ALL' | RiskLevel;
type PeriodFilter = 'ALL' | 'TODAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS' | 'LAST_90_DAYS' | 'CUSTOM';
type AnalysisListRouteState = {
  searchTerm?: string;
  riskFilter?: RiskFilter;
  periodFilter?: PeriodFilter;
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

const getAnalysisPreview = (analysis: any) => {
  const candidates = [analysis.executiveSummary, analysis.preview].filter(
    (candidate): candidate is string => typeof candidate === 'string' && candidate.trim().length > 0
  );

  for (const candidate of candidates) {
    const parsed = parseAnalysisText(candidate);
    if (parsed.resumo_executivo && !parsed._raw_text) {
      return parsed.resumo_executivo;
    }
  }

  return analysis.executiveSummary || analysis.preview || 'Nenhum preview de texto disponível para esta análise de atendimento.';
};

const getRiskBadgeClass = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-100 shadow-sm';
  if (riskLevel === 'HIGH') return 'bg-orange-50 text-orange-700 border-orange-100 shadow-sm';
  if (riskLevel === 'MEDIUM') return 'bg-yellow-50 text-yellow-700 border-yellow-100 shadow-sm';
  return 'bg-emerald-50 text-emerald-700 border-emerald-100 shadow-sm';
};

const getRiskDotClass = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'bg-red-500';
  if (riskLevel === 'HIGH') return 'bg-orange-500';
  if (riskLevel === 'MEDIUM') return 'bg-yellow-500';
  return 'bg-emerald-500';
};

const getRiskBadgeLabel = (riskLevel: RiskLevel) => {
  if (riskLevel === 'CRITICAL') return 'Crítico';
  if (riskLevel === 'HIGH') return 'Alto';
  if (riskLevel === 'MEDIUM') return 'Médio';
  return 'Baixo';
};

const riskFilterOptions: Array<{ value: RiskFilter; label: string }> = [
  { value: 'ALL', label: 'Todos os riscos' },
  { value: 'CRITICAL', label: 'Crítico' },
  { value: 'HIGH', label: 'Alto' },
  { value: 'MEDIUM', label: 'Médio' },
  { value: 'LOW', label: 'Baixo' },
];

const periodFilterOptions: Array<{ value: Exclude<PeriodFilter, 'CUSTOM'>; label: string }> = [
  { value: 'ALL', label: 'Todo o período' },
  { value: 'TODAY', label: 'Hoje' },
  { value: 'LAST_7_DAYS', label: 'Últimos 7 dias' },
  { value: 'LAST_30_DAYS', label: 'Últimos 30 dias' },
  { value: 'LAST_90_DAYS', label: 'Últimos 90 dias' },
];

const getAnalysisSearchableText = (analysis: any) =>
  normalizeText(
    [
      analysis.conversationId,
      analysis.conversation?.customerName,
      analysis.conversation?.customerEmail,
      analysis.conversation?.assignedAgentName,
      analysis.executiveSummary,
      analysis.preview,
    ]
      .filter(Boolean)
      .join(' ')
  );

const isWithinSelectedPeriod = (
  createdAt: string,
  periodFilter: PeriodFilter,
  customStartDate: string,
  customEndDate: string
) => {
  if (periodFilter === 'ALL') return true;

  const analysisDate = new Date(createdAt);
  if (Number.isNaN(analysisDate.getTime())) return false;

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (periodFilter === 'TODAY') {
    return analysisDate >= startOfToday;
  }

  if (periodFilter === 'LAST_7_DAYS') {
    const threshold = new Date(startOfToday);
    threshold.setDate(threshold.getDate() - 6);
    return analysisDate >= threshold;
  }

  if (periodFilter === 'LAST_30_DAYS') {
    const threshold = new Date(startOfToday);
    threshold.setDate(threshold.getDate() - 29);
    return analysisDate >= threshold;
  }

  if (periodFilter === 'LAST_90_DAYS') {
    const threshold = new Date(startOfToday);
    threshold.setDate(threshold.getDate() - 89);
    return analysisDate >= threshold;
  }

  const start = customStartDate ? new Date(`${customStartDate}T00:00:00`) : null;
  const end = customEndDate ? new Date(`${customEndDate}T23:59:59.999`) : null;

  if (start && Number.isNaN(start.getTime())) return false;
  if (end && Number.isNaN(end.getTime())) return false;
  if (start && end && start > end) return false;
  if (start && analysisDate < start) return false;
  if (end && analysisDate > end) return false;

  return true;
};

export const AnalysisList = () => {
  const [analyses, setAnalyses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [isFiltersOpen, setIsFiltersOpen] = useState(false);
  const [isPeriodOpen, setIsPeriodOpen] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const filtersRef = useRef<HTMLDivElement | null>(null);
  const periodRef = useRef<HTMLDivElement | null>(null);

  const formatConversationId = (conversationId?: string) => {
    if (!conversationId) return 'N/A';
    return conversationId.length > 18 ? `${conversationId.slice(0, 18)}...` : conversationId;
  };

  useEffect(() => {
    void loadAnalyses();
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;

      if (filtersRef.current && !filtersRef.current.contains(target)) {
        setIsFiltersOpen(false);
      }

      if (periodRef.current && !periodRef.current.contains(target)) {
        setIsPeriodOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  useEffect(() => {
    const routeState = location.state as AnalysisListRouteState | null;

    if (!routeState) return;

    if (typeof routeState.searchTerm === 'string') {
      setSearchTerm(routeState.searchTerm);
    }

    if (routeState.riskFilter) {
      setRiskFilter(routeState.riskFilter);
    }

    if (routeState.periodFilter) {
      setPeriodFilter(routeState.periodFilter);
      if (routeState.periodFilter !== 'CUSTOM') {
        setCustomStartDate('');
        setCustomEndDate('');
      }
    }
  }, [location.state]);

  const loadAnalyses = async () => {
    try {
      const data = await analysisService.list();
      setAnalyses(data);
    } catch {
      console.error('Erro ao carregar análises');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, e: ReactMouseEvent) => {
    e.stopPropagation();

    if (!confirm('Tem certeza que deseja deletar esta análise?')) return;

    setDeleting(id);
    try {
      await analysisService.delete(id);
      setAnalyses((prev) => prev.filter((analysis) => analysis.id !== id));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Erro ao deletar análise');
    } finally {
      setDeleting(null);
    }
  };

  const hasInvalidCustomRange =
    periodFilter === 'CUSTOM' &&
    Boolean(customStartDate) &&
    Boolean(customEndDate) &&
    new Date(`${customStartDate}T00:00:00`) > new Date(`${customEndDate}T23:59:59.999`);

  const normalizedSearch = normalizeText(searchTerm.trim());
  const filteredAnalyses = hasInvalidCustomRange
    ? []
    : analyses.filter((analysis) => {
        const displayRiskLevel = getDisplayRiskLevel(analysis);

        if (riskFilter !== 'ALL' && displayRiskLevel !== riskFilter) {
          return false;
        }

        if (normalizedSearch && !getAnalysisSearchableText(analysis).includes(normalizedSearch)) {
          return false;
        }

        return isWithinSelectedPeriod(analysis.createdAt, periodFilter, customStartDate, customEndDate);
      });

  const clearFilters = () => {
    setSearchTerm('');
    setRiskFilter('ALL');
    setPeriodFilter('ALL');
    setCustomStartDate('');
    setCustomEndDate('');
    setIsFiltersOpen(false);
    setIsPeriodOpen(false);
  };

  if (loading) return <Loading />;

  return (
    <div className="absolute inset-0 overflow-y-auto bg-surface-50">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-8">
        <div className="mb-8 flex flex-col justify-between gap-6 animate-fade-in md:flex-row md:items-end">
          <div className="flex-1">
            <h1 className="flex items-center gap-3 text-3xl font-display font-bold text-surface-900">
              <Sparkles className="h-8 w-8 text-brand-500" />
              Histórico de Análises
            </h1>
            <p className="mt-2 max-w-xl text-sm text-surface-500">
              Acompanhe todas as análises de atendimento feitas pela IA. Filtre e busque por risco, cliente ou data para encontrar insights rapidamente.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="card-glass flex items-center gap-2 border border-surface-200 px-4 py-2.5 text-sm font-medium text-surface-600 shadow-sm">
              <span className="h-2.5 w-2.5 animate-pulse-slow rounded-full bg-brand-500"></span>
              {analyses.length} análise{analyses.length !== 1 && 's'} gerada{analyses.length !== 1 && 's'}
            </div>
            <button onClick={() => navigate('/search')} className="btn btn-primary">
              + Nova Análise
            </button>
          </div>
        </div>

        <div className="mb-8 flex flex-col items-center gap-4 animate-slide-up sm:flex-row" style={{ animationDelay: '100ms' }}>
          <div className="relative w-full flex-1">
            <SearchIcon className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              placeholder="Buscar por cliente, email, agente ou ID da conversa..."
              className="input h-11 bg-white pl-10 shadow-sm"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="relative w-full sm:w-auto" ref={filtersRef}>
              <button
                onClick={() => {
                  setIsFiltersOpen((current) => !current);
                  setIsPeriodOpen(false);
                }}
                className={`btn btn-secondary h-11 w-full bg-white px-4 shadow-sm hover:text-surface-700 sm:w-auto ${
                  riskFilter !== 'ALL' ? 'text-brand-600' : 'text-surface-500'
                }`}
              >
                <Filter className="mr-2 h-4 w-4" />
                {riskFilter === 'ALL' ? 'Filtros' : riskFilterOptions.find((option) => option.value === riskFilter)?.label}
              </button>

              {isFiltersOpen && (
                <div className="absolute right-0 z-10 mt-2 w-56 rounded-2xl border border-surface-200 bg-white p-3 shadow-soft">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">Nível de risco</p>
                  <div className="space-y-2">
                    {riskFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setRiskFilter(option.value);
                          setIsFiltersOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          riskFilter === option.value
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        <span>{option.label}</span>
                        {option.value !== 'ALL' && (
                          <span className={`h-2.5 w-2.5 rounded-full ${getRiskDotClass(option.value as RiskLevel)}`}></span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative w-full sm:w-auto" ref={periodRef}>
              <button
                onClick={() => {
                  setIsPeriodOpen((current) => !current);
                  setIsFiltersOpen(false);
                }}
                className={`btn btn-secondary h-11 w-full bg-white px-4 shadow-sm hover:text-surface-700 sm:w-auto ${
                  periodFilter !== 'ALL' ? 'text-brand-600' : 'text-surface-500'
                }`}
              >
                <Calendar className="mr-2 h-4 w-4" />
                {periodFilter === 'CUSTOM'
                  ? 'Período personalizado'
                  : periodFilterOptions.find((option) => option.value === periodFilter)?.label || 'Período'}
              </button>

              {isPeriodOpen && (
                <div className="absolute right-0 z-10 mt-2 w-72 rounded-2xl border border-surface-200 bg-white p-3 shadow-soft">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-surface-400">Período</p>
                  <div className="space-y-2">
                    {periodFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setPeriodFilter(option.value);
                          setCustomStartDate('');
                          setCustomEndDate('');
                          setIsPeriodOpen(false);
                        }}
                        className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                          periodFilter === option.value
                            ? 'bg-brand-50 text-brand-700'
                            : 'text-surface-600 hover:bg-surface-50'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}

                    <button
                      onClick={() => setPeriodFilter('CUSTOM')}
                      className={`block w-full rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                        periodFilter === 'CUSTOM'
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-surface-600 hover:bg-surface-50'
                      }`}
                    >
                      Intervalo personalizado
                    </button>
                  </div>

                  {periodFilter === 'CUSTOM' && (
                    <div className="mt-3 space-y-3 border-t border-surface-100 pt-3">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400">
                        De
                        <input
                          type="date"
                          value={customStartDate}
                          onChange={(event) => setCustomStartDate(event.target.value)}
                          className="input mt-1 h-10 bg-white text-sm"
                        />
                      </label>

                      <label className="block text-xs font-semibold uppercase tracking-wider text-surface-400">
                        Até
                        <input
                          type="date"
                          value={customEndDate}
                          onChange={(event) => setCustomEndDate(event.target.value)}
                          className="input mt-1 h-10 bg-white text-sm"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {(searchTerm || riskFilter !== 'ALL' || periodFilter !== 'ALL') && (
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm text-surface-500 animate-fade-in">
            <span>
              Exibindo {filteredAnalyses.length} de {analyses.length} análise{analyses.length !== 1 && 's'}
            </span>
            <button
              onClick={clearFilters}
              className="rounded-full border border-surface-200 px-3 py-1.5 text-surface-600 transition-colors hover:border-surface-300 hover:text-surface-900"
            >
              Limpar filtros
            </button>
          </div>
        )}

        {hasInvalidCustomRange && (
          <div className="mb-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
            O período personalizado está inválido. A data inicial precisa ser anterior à data final.
          </div>
        )}

        {analyses.length === 0 ? (
          <div className="card-glass flex flex-col items-center justify-center px-4 py-20 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-brand-50 shadow-soft">
              <Sparkles className="h-10 w-10 text-brand-400" />
            </div>
            <h3 className="mb-2 text-xl font-display font-medium text-surface-900">Nenhuma análise disponível</h3>
            <p className="mb-6 max-w-sm text-surface-500">
              Você ainda não realizou nenhuma análise com IA. Inicie uma nova busca para gerar a primeira.
            </p>
            <button
              onClick={() => navigate('/search')}
              className="btn bg-[conic-gradient(at_top_right,_var(--tw-gradient-stops))] from-brand-500 via-indigo-500 to-brand-600 text-white shadow-soft shadow-brand-500/30"
            >
              Começar Agora
            </button>
          </div>
        ) : filteredAnalyses.length === 0 ? (
          <div className="card-glass flex flex-col items-center justify-center px-4 py-20 text-center animate-slide-up" style={{ animationDelay: '200ms' }}>
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-surface-100 shadow-soft">
              <SearchIcon className="h-10 w-10 text-surface-400" />
            </div>
            <h3 className="mb-2 text-xl font-display font-medium text-surface-900">Nenhum resultado encontrado</h3>
            <p className="mb-6 max-w-sm text-surface-500">
              Ajuste a busca, o filtro de risco ou o período para localizar análises no histórico.
            </p>
            <button onClick={clearFilters} className="btn btn-secondary bg-white shadow-sm">
              Limpar filtros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAnalyses.map((analysis, index) => {
              const displayRiskLevel = getDisplayRiskLevel(analysis);
              const delay = Math.min((index + 2) * 100, 800);

              return (
                <div
                  key={analysis.id}
                  onClick={() => navigate(`/analysis/${analysis.id}`)}
                  className="card-glass-hover group isolation-auto flex h-full cursor-pointer flex-col bg-white animate-slide-up"
                  style={{ animationDelay: `${delay}ms` }}
                >
                  <div className="relative flex items-start justify-between border-b border-surface-100 p-5">
                    <div className="flex items-center gap-3 truncate">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 font-display font-bold text-white shadow-soft">
                        {(analysis.conversation?.customerName || analysis.conversation?.customerEmail || '?')[0].toUpperCase()}
                      </div>
                      <div className="truncate">
                        <p className="truncate pr-4 text-sm font-semibold text-surface-900">
                          {analysis.conversation?.customerName || analysis.conversation?.customerEmail || 'Cliente Local'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-surface-500">
                          Agente: {analysis.conversation?.assignedAgentName || 'N/A'}
                        </p>
                      </div>
                    </div>

                    <button className="absolute right-4 top-4 rounded-md p-1.5 text-surface-300 opacity-0 transition-colors group-hover:opacity-100 hover:bg-surface-100 hover:text-surface-600">
                      <MoreVertical className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex flex-1 flex-col p-5">
                    <p className="mb-4 line-clamp-3 flex-1 text-sm leading-relaxed text-surface-600">
                      {getAnalysisPreview(analysis)}
                    </p>

                    <div className="mb-4 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded border border-surface-100 bg-surface-50 px-2 py-1 text-[11px] font-medium text-surface-500">
                        <Hash className="h-3 w-3 text-surface-400" />
                        {formatConversationId(analysis.conversationId)}
                      </span>
                      {analysis.conversation?.customerEmail && (
                        <span className="inline-flex max-w-[150px] items-center gap-1.5 truncate rounded border border-surface-100 bg-surface-50 px-2 py-1 text-[11px] font-medium text-surface-500">
                          <Mail className="h-3 w-3 shrink-0 text-surface-400" />
                          <span className="truncate">{analysis.conversation.customerEmail}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-b-2xl border-t border-surface-100 bg-surface-50/50 px-5 py-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-surface-400">Data e Hora</span>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-surface-600">
                        <Calendar className="h-3.5 w-3.5 text-surface-400" />
                        {new Date(analysis.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} -{' '}
                        {new Date(analysis.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={`badge flex items-center gap-1.5 border px-2.5 py-1 ${getRiskBadgeClass(displayRiskLevel)}`}>
                        <div className={`h-1.5 w-1.5 rounded-full bg-current ${displayRiskLevel === 'CRITICAL' ? 'animate-pulse' : ''}`}></div>
                        {getRiskBadgeLabel(displayRiskLevel)}
                      </span>

                      <div className="flex items-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/analysis/${analysis.id}`);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-brand-600 transition-colors hover:bg-brand-50"
                          title="Ver análise completa"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDelete(analysis.id, e)}
                          disabled={deleting === analysis.id}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                          title="Deletar análise"
                        >
                          {deleting === analysis.id ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-red-500 border-t-transparent"></div>
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
