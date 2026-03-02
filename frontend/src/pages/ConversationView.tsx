// src/pages/ConversationView.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConversationStore } from '../store/useConversationStore';
import { analysisService } from '../services/analysis.service';
import { Button } from '../components/Common/Button';
import { Loading } from '../components/Common/Loading';
import { FileText, Calendar, User, CheckCircle2 } from 'lucide-react';

export const ConversationView = () => {
  const { conversations, selectedConversations, selectConversation, deselectConversation } = useConversationStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPrivateNotes, setShowPrivateNotes] = useState(false);
  const navigate = useNavigate();

  const handleAnalyze = async () => {
    if (selectedConversations.length === 0) {
      setError('Selecione pelo menos uma conversa para analisar');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const ids = selectedConversations.map(c => c.id);
      const result = await analysisService.create({ conversationIds: ids });
      navigate(`/analysis/${result.id}`);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Erro ao gerar an�lise');
    } finally {
      setLoading(false);
    }
  };

  const isSelected = (id: string) => {
    return selectedConversations.some(c => c.id === id);
  };

  const toggleSelection = (conversation: any) => {
    if (isSelected(conversation.id)) {
      deselectConversation(conversation.id);
    } else {
      selectConversation(conversation);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Conversas Encontradas
          </h1>
          <p className="text-gray-600">
            {conversations.length} conversa(s) • {selectedConversations.length} selecionada(s)
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showPrivateNotes}
              onChange={(e) => setShowPrivateNotes(e.target.checked)}
              className="rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            <span className="text-sm text-gray-700">Mostrar notas privadas</span>
          </label>

          <Button
            onClick={handleAnalyze}
            disabled={selectedConversations.length === 0}
            className="flex items-center space-x-2"
          >
            <FileText className="w-5 h-5" />
            <span>Gerar Análise</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      <div className="grid gap-6">
        {conversations.map((conversation) => (
          <div
            key={conversation.id}
            className={`card cursor-pointer transition-all ${
              isSelected(conversation.id) ? 'ring-2 ring-brand-500' : ''
            }`}
            onClick={() => toggleSelection(conversation)}
          >
            {/* Header */}
            <div className="flex items-start justify-between mb-4 pb-4 border-b">
              <div className="flex-1">
                <div className="flex items-center space-x-3 mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Conversa {conversation.id.substring(0, 8)}
                  </h3>
                  {isSelected(conversation.id) && (
                    <CheckCircle2 className="w-5 h-5 text-brand-600" />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center space-x-2 text-gray-600">
                    <User className="w-4 h-4" />
                    <span>{conversation.customerName || conversation.customerEmail}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(conversation.createdAt).toLocaleDateString('pt-BR')}</span>
                  </div>
                  <div className="flex items-center space-x-2 text-gray-600">
                    <FileText className="w-4 h-4" />
                    <span>{conversation.messages.length} mensagens</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {conversation.messages.map((message) => {
                // Filtrar notas privadas se necessário
                if (message.messageType === 'PRIVATE' && !showPrivateNotes) {
                  return null;
                }

                const isUser = message.actorType === 'USER';
                const isPrivate = message.messageType === 'PRIVATE';

                return (
                  <div
                    key={message.id}
                    className={`p-4 rounded-lg ${
                      isUser
                        ? 'bg-blue-50 ml-12'
                        : isPrivate
                        ? 'bg-yellow-50 mr-12'
                        : 'bg-gray-50 mr-12'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-sm text-gray-900">
                        {isUser ? 'Cliente' : isPrivate ? 'Nota Privada' : 'Agente'}
                        {message.isImportantNote && ' 🔔'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(message.createdAt).toLocaleTimeString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-gray-700 whitespace-pre-wrap">{message.content}</p>

                    {message.hasMedia && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {message.mediaUrls.map((url, idx) => (
                          <a
                            key={idx}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-brand-600 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            📎 Anexo {idx + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


