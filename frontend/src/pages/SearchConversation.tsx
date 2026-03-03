// src/pages/SearchConversation.tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { conversationService } from '../services/conversation.service';
import { useConversationStore } from '../store/useConversationStore';
import { Button } from '../components/Common/Button';
import { Input } from '../components/Common/Input';
import { Search, Plus, X } from 'lucide-react';

export const SearchConversation = () => {
  const [conversationIds, setConversationIds] = useState<string[]>(['']);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const navigate = useNavigate();
  const { setConversations, clearSelected } = useConversationStore();

  const addIdField = () => {
    setConversationIds([...conversationIds, '']);
  };

  const removeIdField = (index: number) => {
    setConversationIds(conversationIds.filter((_, i) => i !== index));
  };

  const updateId = (index: number, value: string) => {
    const newIds = [...conversationIds];
    newIds[index] = value;
    setConversationIds(newIds);
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const validIds = conversationIds.filter(id => id.trim() !== '');

    if (validIds.length === 0) {
      setError('Adicione pelo menos um ID de conversa');
      setLoading(false);
      return;
    }

    try {
      const conversations = await conversationService.getMultiple(validIds);
      setConversations(conversations);
      clearSelected();
      navigate('/conversations');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao buscar conversas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Buscar Atendimentos
        </h1>
        <p className="text-gray-600">
          Digite os IDs das conversas do Freshchat para análise
        </p>
      </div>

      <div className="card">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-3">
            {conversationIds.map((id, index) => (
              <div key={index} className="flex items-center space-x-2">
                <Input
                  placeholder={`ID da conversa ${index + 1}`}
                  value={id}
                  onChange={(e) => updateId(index, e.target.value)}
                  className="flex-1"
                />
                {conversationIds.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeIdField(index)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addIdField}
            className="flex items-center space-x-2 text-brand-600 hover:text-brand-700 font-medium"
          >
            <Plus className="w-5 h-5" />
            <span>Adicionar outro ID</span>
          </button>

          <div className="pt-4 border-t">
            <Button
              type="submit"
              variant="primary"
              isLoading={loading}
              className="w-full flex items-center justify-center space-x-2"
            >
              <Search className="w-5 h-5" />
              <span>Buscar Conversas</span>
            </Button>
          </div>
        </form>
      </div>

      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">💡 Dica</h3>
        <p className="text-sm text-blue-800">
          Você pode buscar múltiplas conversas do mesmo cliente para fazer uma análise consolidada.
          Isso é especialmente útil para identificar problemas recorrentes.
        </p>
      </div>
    </div>
  );
};
