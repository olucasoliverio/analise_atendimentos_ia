import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analysisService } from '../services/analysis.service';

export const useAnalyses = () => {
  return useQuery({
    queryKey: ['analyses'],
    queryFn: () => analysisService.list(),
    staleTime: 1000 * 60 * 5, // Cache por 5 minutos
  });
};

export const useAnalysis = (id: string) => {
  return useQuery({
    queryKey: ['analysis', id],
    queryFn: () => analysisService.getById(id),
    enabled: !!id, // Só buscar se ID existir
  });
};

export const useCreateAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: { conversationIds: string[] }) => 
      analysisService.create(data),
    
    onSuccess: () => {
      // ✅ Invalidar cache para refetch automático
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    }
  });
};

export const useDeleteAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => analysisService.delete(id),
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    }
  });
};

export const useBatchAnalysis = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationIds: string[]) => 
      analysisService.createBatch(conversationIds),
    
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['analyses'] });
    }
  });
};

