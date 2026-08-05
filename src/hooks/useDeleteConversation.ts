import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from '@tanstack/react-router';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Conversation } from '@shared/types';
import { HistoryConversation } from '@/types/misc';

export function useDeleteConversation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const params = useParams({ strict: false }) as { id?: string };

  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .delete()
        .eq('id', conversationId);

      if (error) throw error;

      void supabase.storage
        .from('images')
        .list(`${user?.id}/${conversationId}`)
        .then(({ data: list }) => {
          if (!list?.length) return;
          const filesToRemove = list.map(
            (file: { name: string }) =>
              `${user?.id}/${conversationId}/${file.name}`,
          );
          void supabase.storage.from('images').remove(filesToRemove);
        });
    },
    onMutate: async (conversationId) => {
      await queryClient.cancelQueries({ queryKey: ['conversations'] });
      const previousConversations = queryClient.getQueryData(['conversations']);
      const previousRecent = queryClient.getQueryData([
        'conversations',
        'recent',
      ]);

      queryClient.setQueryData(
        ['conversations'],
        (old: HistoryConversation[] | undefined) =>
          old?.filter((conv) => conv.id !== conversationId),
      );
      queryClient.setQueryData(
        ['conversations', 'recent'],
        (old: Conversation[] | undefined) =>
          old?.filter((conv) => conv.id !== conversationId),
      );

      return { previousConversations, previousRecent };
    },
    onSuccess: (_data, conversationId) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast({
        title: 'Success',
        description: 'Conversation deleted successfully',
      });
      if (params.id === conversationId) {
        void navigate({ to: '/' });
      }
    },
    onError: (error: unknown, _conversationId, context) => {
      console.error('Error deleting conversation:', error);
      if (context?.previousConversations !== undefined) {
        queryClient.setQueryData(
          ['conversations'],
          context.previousConversations,
        );
      }
      if (context?.previousRecent !== undefined) {
        queryClient.setQueryData(
          ['conversations', 'recent'],
          context.previousRecent,
        );
      }
      toast({
        title: 'Error',
        description: 'Failed to delete conversation',
        variant: 'destructive',
      });
    },
  });
}
