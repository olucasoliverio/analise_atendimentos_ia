// src/pages/ConversationExplorer.tsx
import { useState, useEffect, useRef } from 'react';
import { sanitizeHtml } from '../utils/sanitizeHtml';
import { useNavigate } from 'react-router-dom';
import { conversationService } from '../services/conversation.service';
import { analysisService } from '../services/analysis.service';
import { Search, Mail, Hash, MessageSquare, User, Clock, Paperclip, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { ActivityOverlay } from '../components/Common/ActivityOverlay';

interface Message {
  id: string;
  messageType: 'NORMAL' | 'PRIVATE' | 'SYSTEM';
  actorType: 'USER' | 'AGENT' | 'SYSTEM' | 'BOT';
  actorId?: string;
  actorName?: string;
  content: string;
  createdAt: string;
  hasMedia: boolean;
  mediaUrls: string[];
  isImportantNote: boolean;
}

interface Conversation {
  id: string;
  customerId: string;
  customerName?: string;
  customerEmail?: string;
  createdAt: string;
  updatedAt: string;
  status?: string;
  assignedAgentName?: string;
  messages: Message[];
}

const sortConversations = (conversations: Conversation[]) => {
  return [...conversations].sort((a, b) =>
    new Date(b.updatedAt || b.createdAt).getTime() -
    new Date(a.updatedAt || a.createdAt).getTime()
  );
};

type SearchMode = 'id' | 'email';

export const ConversationExplorer = () => {
  const navigate = useNavigate();
  const [searchMode, setSearchMode] = useState<SearchMode>('id');
  const [searchValue, setSearchValue] = useState('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showPrivate, setShowPrivate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  const [searchHistory, setSearchHistory] = useState<Array<{
    type: 'id' | 'email';
    value: string;
    timestamp: number;
  }>>([]);
  const [showHistory, setShowHistory] = useState(false);
  const historyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('searchHistory');
    if (saved) {
      try {
        const history = JSON.parse(saved);
        setSearchHistory(history);
      } catch (err) {
        console.error('Erro ao carregar histórico');
      }
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (historyRef.current && !historyRef.current.contains(event.target as Node)) {
        setShowHistory(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const saveToHistory = (type: 'id' | 'email', value: string) => {
    const newEntry = {
      type,
      value,
      timestamp: Date.now()
    };

    const updated = [
      newEntry,
      ...searchHistory.filter(item =>
        !(item.type === type && item.value === value)
      )
    ].slice(0, 10);

    setSearchHistory(updated);
    localStorage.setItem('searchHistory', JSON.stringify(updated));
  };

  const handleSearch = async () => {
    if (!searchValue.trim()) return;
    saveToHistory(searchMode, searchValue.trim());
    setError('');
    setLoading(true);
    setConversations([]);
    setSelectedConversation(null);
    setSelectedIds(new Set());

    try {
      if (searchMode === 'id') {
        const ids = searchValue.split(',').map(s => s.trim()).filter(Boolean);

        if (ids.length === 0) {
          setError('Digite pelo menos um ID');
          setLoading(false);
          return;
        }

        const data = await conversationService.getMultiple(ids);
        setConversations(sortConversations(data));

        if (data.length > 0) {
          setSelectedConversation(data[0]);
        } else {
          setError('Nenhuma conversa encontrada para os IDs fornecidos');
        }
      } else {
        const data = await conversationService.getByEmail(searchValue.trim());
        setConversations(sortConversations(data));

        if (data.length > 0) {
          setSelectedConversation(data[0]);
        } else {
          setError('Nenhuma conversa encontrada para este e-mail');
        }
      }
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || err.message || 'Erro ao buscar conversas';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAnalyze = async (type: 'individual' | 'history' = 'individual') => {
    const ids = selectedIds.size > 0
      ? Array.from(selectedIds)
      : selectedConversation ? [selectedConversation.id] : [];

    if (ids.length === 0) return;

    setAnalyzing(true);
    try {
      const result = await analysisService.create({ conversationIds: ids, analysisType: type });
      navigate(`/analysis/${result.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao gerar análise');
      setAnalyzing(false);
    }
  };

  const formatTime = (date: string) => {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${day}/${month}/${year}`;
  };

  const getLastMessage = (conv: Conversation) => {
    const msgs = conv.messages.filter(m => m.messageType !== 'SYSTEM');
    if (msgs.length === 0) return 'Sem mensagens';
    const last = msgs[msgs.length - 1];
    const prefix = last.actorType === 'USER' ? '' : 'Você: ';
    return prefix + (last.content || '[mídia]');
  };

  const getRiskCount = (conv: Conversation) => {
    const keywords = ['insatisfeito', 'cancelar', 'problema', 'frustrado', 'péssimo', 'urgente'];
    return conv.messages.filter(m =>
      m.actorType === 'USER' && keywords.some(k => m.content.toLowerCase().includes(k))
    ).length;
  };

  const visibleMessages = selectedConversation?.messages.filter(m => {
    if (m.messageType === 'SYSTEM') return false;
    if (m.messageType === 'PRIVATE' && !showPrivate) return false;
    return true;
  }) || [];

  const normalizeMediaUrl = (url: string) => {
    try {
      return decodeURIComponent(url).toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  };

  const isImageUrl = (url: string) => {
    const normalized = normalizeMediaUrl(url);
    return /\.(png|jpe?g|gif|webp)(?:$|[?#])/i.test(normalized) || normalized.includes('image/');
  };

  const isAudioUrl = (url: string) => {
    const normalized = normalizeMediaUrl(url);
    return /\.(mp3|ogg|wav|m4a|aac|flac|opus)(?:$|[?#])/i.test(normalized) || normalized.includes('audio/');
  };

  const isVideoUrl = (url: string) => {
    const normalized = normalizeMediaUrl(url);
    return /\.(mp4|webm|mov|m4v|avi)(?:$|[?#])/i.test(normalized) || normalized.includes('video/');
  };

  return (
    <div className="h-screen flex flex-col bg-surface-50 p-6 overflow-hidden">
      <ActivityOverlay
        open={loading}
        icon={Search}
        title="Buscando conversas"
        description="Consultando o histórico e organizando os resultados para exibir na tela."
        accentClassName="from-sky-500 via-cyan-400 to-brand-500"
      />

      <ActivityOverlay
        open={analyzing}
        icon={Sparkles}
        title="Gerando análise"
        description="A IA está consolidando as conversas selecionadas e montando a análise detalhada."
        accentClassName="from-emerald-500 via-teal-400 to-brand-500"
      />

      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-shrink-0">
        <div>
          <h1 className="text-3xl font-extrabold text-surface-900 tracking-tight flex items-center gap-3">
            <span className="bg-gradient-to-br from-brand-600 to-brand-800 bg-clip-text text-transparent">Explorer</span>
            <span className="px-2 py-0.5 bg-brand-50 text-brand-700 text-[10px] uppercase tracking-widest rounded-full border border-brand-100">AI Powered</span>
          </h1>
          <p className="text-surface-500 text-sm mt-1.5 font-medium">Pesquise e selecione conversas para análise estratégica.</p>
        </div>
      </div>

      {/* Search Bar */}
      <div className="card-glass p-3 mb-6 flex flex-wrap items-center gap-4 z-20 shrink-0">
        {/* Mode Toggle */}
        <div className="flex bg-surface-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setSearchMode('id')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${searchMode === 'id'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-900 hover:bg-surface-200/50'
              }`}
          >
            <Hash className="w-3.5 h-3.5" />
            Por ID
          </button>
          <button
            onClick={() => setSearchMode('email')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${searchMode === 'email'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-surface-500 hover:text-surface-900 hover:bg-surface-200/50'
              }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Por E-mail
          </button>
        </div>

        {/* Input */}
        <div className="flex-1 flex gap-2 min-w-[300px]">
          <div className="relative flex-1" ref={historyRef}>
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-surface-400" />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              onFocus={() => setShowHistory(true)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  handleSearch();
                  setShowHistory(false);
                }
                if (e.key === 'Escape') {
                  setShowHistory(false);
                }
              }}
              placeholder={
                searchMode === 'id'
                  ? 'ID da conversa (ex: 1093000478274692)'
                  : 'email@cliente.com'
              }
              className="input w-full pl-10 h-full !py-2.5 !bg-surface-50"
            />

            {/* Dropdown de Histórico */}
            {showHistory && searchHistory.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 card-glass shadow-glass-dark z-50 max-h-64 overflow-y-auto !p-0">
                <div className="px-4 py-2.5 border-b border-surface-100 flex items-center justify-between bg-surface-50/80">
                  <span className="text-[10px] font-bold text-surface-400 uppercase tracking-wider">
                    Pesquisas Recentes
                  </span>
                  <button
                    onClick={() => {
                      setSearchHistory([]);
                      localStorage.removeItem('searchHistory');
                    }}
                    className="text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
                {searchHistory
                  .filter(item => item.type === searchMode)
                  .map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setSearchValue(item.value);
                        setShowHistory(false);
                        setTimeout(() => handleSearch(), 100);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-surface-50 transition-colors flex items-center justify-between group border-b border-surface-50/50 last:border-0"
                    >
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        {item.type === 'id' ? (
                          <Hash className="w-4 h-4 text-surface-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                        ) : (
                          <Mail className="w-4 h-4 text-surface-400 group-hover:text-brand-500 transition-colors flex-shrink-0" />
                        )}
                        <span className="text-sm font-medium text-surface-700 group-hover:text-surface-900 transition-colors truncate">
                          {item.value}
                        </span>
                      </div>
                      <span className="text-xs text-surface-400 bg-surface-100 px-2 py-0.5 rounded-full flex-shrink-0 ml-2">
                        {new Date(item.timestamp).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit'
                        })}
                      </span>
                    </button>
                  ))}
                {searchHistory.filter(item => item.type === searchMode).length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-surface-400">
                    Nenhuma pesquisa recente
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Botão Buscar */}
        <button
          onClick={() => {
            handleSearch();
            setShowHistory(false);
          }}
          disabled={loading || !searchValue.trim()}
          className="btn btn-primary min-w-[120px]"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> : <Search className="w-4 h-4 flex-shrink-0" />}
          {loading ? 'Buscando...' : 'Buscar'}
        </button>

        {/* Analyze Buttons */}
        {conversations.length > 0 && (
          <div className="flex gap-2">
            <button
              onClick={() => handleAnalyze('individual')}
              disabled={analyzing}
              className="btn btn-primary whitespace-nowrap"
            >
              {analyzing
                ? <><Loader2 className="w-4 h-4 animate-spin flex-shrink-0" /> Analisando...</>
                : <><Sparkles className="w-4 h-4 flex-shrink-0" />
                  {selectedIds.size > 0
                    ? `Analisar ${selectedIds.size}`
                    : 'Análise Unitária'
                  }
                </>
              }
            </button>
            
            {(selectedIds.size > 1 || (searchMode === 'email' && conversations.length > 1)) && (
              <button
                onClick={() => handleAnalyze('history')}
                disabled={analyzing}
                className="btn border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 whitespace-nowrap"
              >
                <Sparkles className="w-4 h-4 flex-shrink-0 text-brand-500" />
                Análise de Histórico
              </button>
            )}
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 bg-red-50/80 backdrop-blur-sm border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm animate-fade-in shadow-sm shrink-0">
          <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex gap-6 overflow-hidden animate-slide-up">
        {/* Sidebar - Lista de Conversas */}
        <div className="w-[340px] flex flex-col flex-shrink-0 card-glass overflow-hidden">
          {conversations.length === 0 && !loading ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-surface-50/30">
              <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-soft border border-surface-100 relative overflow-hidden group">
                <Search className="w-8 h-8 text-surface-300 relative z-10 group-hover:scale-110 transition-transform" />
                <div className="absolute inset-0 bg-gradient-to-tr from-brand-50 to-transparent opacity-50"></div>
              </div>
              <p className="text-surface-500 text-sm font-medium leading-relaxed max-w-[200px]">
                {searchMode === 'id'
                  ? 'Busque pelo ID da conversa para começar'
                  : 'Busque pelo e-mail do cliente para ver todo histórico'
                }
              </p>
            </div>
          ) : (
            <>
              <div className="px-5 py-3 border-b border-surface-100 flex items-center justify-between bg-white/50">
                <span className="text-[11px] font-bold text-surface-400 uppercase tracking-wider">
                  {conversations.length} conversa{conversations.length > 1 ? 's' : ''}
                </span>
                {conversations.length > 1 && (
                  <button
                    onClick={() => {
                      if (selectedIds.size === conversations.length) {
                        setSelectedIds(new Set());
                      } else {
                        setSelectedIds(new Set(conversations.map(c => c.id)));
                      }
                    }}
                    className="text-[11px] text-brand-600 hover:text-brand-700 font-bold uppercase tracking-wider transition-colors"
                  >
                    {selectedIds.size === conversations.length ? 'Desmarcar' : 'Selecionar'} todas
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {conversations.map(conv => {
                  const isActive = selectedConversation?.id === conv.id;
                  const isChecked = selectedIds.has(conv.id);
                  const riskCount = getRiskCount(conv);
                  const lastMsg = getLastMessage(conv);

                  return (
                    <div
                      key={conv.id}
                      onClick={() => setSelectedConversation(conv)}
                      className={`relative flex items-start gap-3.5 px-5 py-4 cursor-pointer transition-all border-b border-surface-100 last:border-0 ${isActive ? 'bg-brand-50/50' : 'hover:bg-surface-50/80 bg-white'
                        }`}
                    >
                      {/* Checkbox */}
                      {conversations.length > 1 && (
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={e => { e.stopPropagation(); toggleSelect(conv.id); }}
                            onClick={e => e.stopPropagation()}
                            className="w-4 h-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500 transition-colors cursor-pointer"
                          />
                        </div>
                      )}

                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center flex-shrink-0 shadow-soft shadow-brand-500/20">
                        <span className="text-white text-sm font-bold font-display">
                          {(conv.customerName || conv.customerEmail || '?')[0].toUpperCase()}
                        </span>
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`font-semibold text-sm truncate pr-2 ${isActive ? 'text-brand-900' : 'text-surface-900'}`}>
                            {conv.customerName || conv.customerEmail || 'Cliente'}
                          </span>
                          <span className="text-[10px] font-medium text-surface-400 flex-shrink-0 whitespace-nowrap bg-surface-100/50 px-1.5 py-0.5 rounded-md">
                            {formatTime(conv.updatedAt || conv.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mb-2.5">
                          <p className={`text-xs truncate flex-1 ${isActive ? 'text-brand-700/80' : 'text-surface-500'}`}>
                            {lastMsg.length > 40 ? lastMsg.substring(0, 40) + '...' : lastMsg}
                          </p>
                          {riskCount > 0 && (
                            <div className="flex items-center gap-1 text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded-md ml-2 flex-shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              {riskCount}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-bold text-surface-400 font-mono tracking-tighter bg-surface-100/30 px-1.5 py-0.5 rounded border border-surface-100/50">
                            #{conv.id.substring(conv.id.length - 6)}
                          </span>
                          {conv.status && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md border uppercase tracking-wider ${conv.status === 'Resolved'
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                : 'bg-brand-50 text-brand-600 border-brand-100'
                              }`}>
                              {conv.status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Chat Area - Detalhes da Conversa */}
        <div className="flex-1 flex flex-col card-glass overflow-hidden min-w-0">
          {!selectedConversation ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-12 bg-surface-50/20">
              <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mb-6 shadow-soft border border-surface-100">
                <MessageSquare className="w-10 h-10 text-surface-200" />
              </div>
              <h3 className="text-surface-900 font-bold text-lg mb-2">Selecione uma conversa</h3>
              <p className="text-surface-500 text-sm max-w-sm mx-auto leading-relaxed">
                Clique em uma conversa na lista lateral para visualizar as mensagens e analisar com inteligência artificial.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between bg-white/80 backdrop-blur-md z-10 shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-50 to-brand-100 flex items-center justify-center border border-brand-200/50 shadow-inner">
                    <User className="w-5 h-5 text-brand-600" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-surface-900">
                      {selectedConversation.customerName || selectedConversation.customerEmail || 'Conversa'}
                    </h2>
                    <p className="text-xs font-medium text-surface-500 flex items-center gap-1.5">
                      <Hash className="w-3 h-3" />
                      ID: {selectedConversation.id}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setShowPrivate(!showPrivate)}
                    className={`btn text-xs font-bold uppercase tracking-wider px-4 ${showPrivate
                        ? 'bg-amber-50 text-amber-700 border-amber-200'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                  >
                    Notas Privadas: {showPrivate ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface-50/30">
                {visibleMessages.length === 0 ? (
                  <div className="text-center py-20 px-10">
                    <p className="text-surface-400 text-sm font-medium">Nenhuma mensagem vísivel nesta conversa.</p>
                  </div>
                ) : (
                  visibleMessages.map((msg, idx) => {
                    const isUser = msg.actorType === 'USER';
                    const isPrivate = msg.messageType === 'PRIVATE';

                    return (
                      <div
                        key={idx}
                        className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}
                      >
                        <div className="flex items-center gap-2 mb-1.5 px-1">
                          {!isUser && (
                            <span className="text-[10px] font-bold text-surface-400 uppercase tracking-widest">
                              {msg.actorName || 'Agente'}
                            </span>
                          )}
                          {isPrivate && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold rounded uppercase tracking-wider border border-amber-200">
                              Privada
                            </span>
                          )}
                          {isUser && (
                            <span className="text-[10px] font-bold text-brand-600 uppercase tracking-widest">
                              Cliente
                            </span>
                          )}
                        </div>

                        <div
                          className={`max-w-[85%] group relative ${isUser
                              ? 'bg-white text-surface-800 rounded-2xl rounded-tl-none border border-surface-200/50 shadow-soft'
                              : isPrivate
                                ? 'bg-amber-50 text-amber-900 rounded-2xl rounded-tr-none border border-amber-200 shadow-soft'
                                : 'bg-brand-600 text-white rounded-2xl rounded-tr-none shadow-soft-brand'
                            }`}
                        >
                          <div
                            className="px-5 py-3.5 text-[13.5px] leading-relaxed break-words font-medium"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(msg.content) }}
                          />

                          {/* Media Attachments */}
                          <div className="px-5 pb-3">
                            {msg.mediaUrls.map((url, i) => {
                              const isImg = isImageUrl(url);
                              const isAud = isAudioUrl(url);
                              const isVid = isVideoUrl(url);

                              return (
                                <div key={i} className="mt-2 group/media relative">
                                  {isImg ? (
                                    <img
                                      src={url}
                                      alt="Anexo"
                                      className="max-w-full rounded-xl border border-black/5 shadow-sm hover:brightness-95 transition-all cursor-zoom-in"
                                      loading="lazy"
                                    />
                                  ) : isAud ? (
                                    <audio controls className="max-w-full h-10 rounded-lg">
                                      <source src={url} />
                                    </audio>
                                  ) : isVid ? (
                                    <video controls className="max-w-full rounded-xl border border-black/5 shadow-sm">
                                      <source src={url} />
                                    </video>
                                  ) : (
                                    <a
                                      href={url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${isUser
                                          ? 'bg-surface-50 border-surface-200 text-surface-700 hover:bg-surface-100'
                                          : isPrivate
                                            ? 'bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200'
                                            : 'bg-black/10 border-transparent text-white hover:bg-black/20'
                                        }`}
                                    >
                                      <Paperclip className="w-3.5 h-3.5" />
                                      Baixar Anexo {i + 1}
                                    </a>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {/* Time */}
                          <p className={`text-[10px] font-medium text-surface-400 mt-1 px-1.5 ${isUser ? '' : 'text-right'}`}>
                            {new Date(msg.createdAt).toLocaleTimeString('pt-BR', {
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Chat Footer - Info */}
              <div className="bg-surface-50/80 backdrop-blur-md border-t border-surface-100 px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-medium text-surface-500 z-10 shrink-0">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-surface-400" />
                  {new Date(selectedConversation.createdAt).toLocaleDateString('pt-BR', {
                    day: '2-digit', month: '2-digit', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </div>
                <div className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-surface-400" />
                  {selectedConversation.assignedAgentName || 'Sem agente atribuído'}
                </div>
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-surface-400" />
                  {selectedConversation.messages.length} mensagen{selectedConversation.messages.length !== 1 ? 's' : ''}
                </div>
                {selectedConversation.customerEmail && (
                  <div className="flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-surface-400" />
                    {selectedConversation.customerEmail}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
