import { useNavigate } from '@tanstack/react-router';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import TextAreaChat from '@/components/TextAreaChat';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { Model } from '@shared/types';
import { MessageItem } from '../types/misc.ts';
import { LimitReachedMessage } from '@/components/LimitReachedMessage';
import { LowPromptsWarningMessage } from '@/components/LowPromptsWarningMessage';
import { FreePlanTrialPill } from '@/components/FreePlanTrialPill';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';
import { SelectedItemsContext } from '@/contexts/SelectedItemsContext';
import posthog from 'posthog-js';
import * as Sentry from '@sentry/react';
import { useLayoutContext } from '@/contexts/LayoutContext';
import { apiUrl } from '@/services/api';
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithToolCalls,
} from 'ai';
import { createAndCacheAiChat } from '@/hooks/useCachedAiChat';
import type { AppUIMessage } from '@shared/chatAi';
import { ensureInputRecords } from '@/lib/aiMessages';
import { persistUserMessage } from '@/services/messageService';

export function PromptView() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, billing, isLoading } = useAuth();
  const totalTokens = billing?.tokens.total ?? 0;
  const { isSidebarOpen } = useLayoutContext();
  const queryClient = useQueryClient();

  const [model, setModel] = useState<Model>('openai/gpt-4o');

  const [isLoaded, setIsLoaded] = useState(false);
  const isMobile = useIsMobile();
  const [images, setImages] = useState<MessageItem[]>([]);
  const [mesh, setMesh] = useState<MessageItem | null>(null);

  const [draftConversationId, setDraftConversationId] = useState(() =>
    crypto.randomUUID(),
  );

  const lowPrompts = useMemo(() => {
    if (isLoading) return false;
    return totalTokens > 0 && totalTokens <= 10;
  }, [totalTokens, isLoading]);

  const limitReached = useMemo(() => {
    if (isLoading) return false;
    return totalTokens <= 0;
  }, [totalTokens, isLoading]);

  // Trigger fade in on mount
  useEffect(() => {
    // Use requestAnimationFrame to ensure the initial render is complete
    const frame = requestAnimationFrame(() => {
      setIsLoaded(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const { mutate: handleGenerate, isPending: isGenerating } = useMutation({
    mutationFn: async (parts: AppUIMessage['parts']) => {
      if (!user?.id) throw new Error('User must be authenticated');
      const conversationId = draftConversationId;

      const text = parts
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
      const imageCount = parts.filter(
        (p) => p.type === 'file' && p.mediaType.startsWith('image/'),
      ).length;
      const meshCount = parts.filter(
        (p) => p.type === 'data-mesh-context',
      ).length;

      posthog.capture('new_conversation', {
        type: 'parametric',
        model_name: model,
        text: text.trim().slice(0, 100),
        image_count: imageCount,
        mesh_count: meshCount,
        conversation_id: conversationId,
      });

      // Create conversation immediately with 'New Conversation'
      const { data: conversation, error: conversationError } = await supabase
        .from('conversations')
        .insert([
          {
            id: conversationId,
            user_id: user.id,
            title: 'New Conversation',
            type: 'parametric',
            settings: {
              model: model,
            },
          },
        ])
        .select()
        .single();

      if (conversationError) throw conversationError;

      await ensureInputRecords({
        parts,
        conversationId: conversation.id,
        userId: user.id,
      });
      if (parts.length === 0) throw new Error('No message parts to send');

      // Persist the user message before kicking off the chat. The
      // `update_leaf_trigger` on `public.messages` advances the
      // conversation's `current_message_leaf_id` to this row, which is
      // what the server-side chat handler walks to build the model
      // branch — so the row has to land first.
      const userMessageId = await persistUserMessage({
        conversationId: conversation.id,
        parts,
        metadata: { model },
        parentMessageId: null,
      });

      const chat = createAndCacheAiChat({
        id: conversation.id,
        generateId: () => crypto.randomUUID(),
        messages: [],
        transport: new DefaultChatTransport<AppUIMessage>({
          api: apiUrl('parametric-chat'),
          headers: async (): Promise<Record<string, string>> => {
            const accessToken = (await supabase.auth.getSession()).data.session
              ?.access_token;
            const headers: Record<string, string> = {};
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            return headers;
          },
          prepareSendMessagesRequest: ({ body }) => ({
            body: {
              conversationId: conversation.id,
              model,
              ...(body ?? {}),
            },
          }),
        }),
        sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
      });
      void chat
        .sendMessage({ id: userMessageId, parts, metadata: { model } })
        .catch((error) => {
          Sentry.captureException(error, {
            extra: {
              hook: 'PromptView initial chat',
              conversationId: conversation.id,
            },
          });
        });

      return {
        conversationId: conversation.id,
      };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      navigate({ to: '/editor/$id', params: { id: data.conversationId } });
    },
    onError: (error) => {
      setDraftConversationId(crypto.randomUUID());
      Sentry.captureException(error);
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to process prompt',
        variant: 'destructive',
      });
    },
  });

  return (
    <div
      className={cn(
        'relative h-full min-h-full w-full transition-all duration-300 ease-in-out',
        isSidebarOpen && !isMobile && user?.id && 'pb-6 pr-6 pt-6',
      )}
    >
      <div
        className={cn(
          'h-full min-h-full bg-adam-bg-secondary-dark',
          isSidebarOpen &&
            !isMobile &&
            user?.id &&
            'rounded-xl shadow-[0_0_15px_rgba(0,0,0,0.1)]',
        )}
      >
        <main className="relative flex h-full w-full flex-col items-center justify-center px-4 md:px-8">
          <div className="mx-auto flex max-w-3xl flex-col items-center justify-center">
            {/* The pill floats above the greeting (absolute, out of flow) so
                it mounting after billing resolves — or never showing for paid
                users — never reflows the centered greeting. */}
            <div className="relative flex flex-col items-center">
              <div className="absolute bottom-full left-1/2 mb-16 w-max -translate-x-1/2">
                <FreePlanTrialPill />
              </div>
              <h1
                className={cn(
                  'mb-8 text-center text-2xl font-medium text-adam-text-primary md:text-3xl lg:text-4xl',
                  'motion-safe:transition-opacity motion-safe:duration-1000 motion-safe:ease-out',
                  isLoaded ? 'opacity-100' : 'opacity-0',
                )}
              >
                Generate your Microneedle Array Patch!
              </h1>
            </div>
          </div>
          <div className="flex w-full flex-col items-center">
            <div className="w-full max-w-3xl space-y-4 pb-12">
              <SelectedItemsContext.Provider
                value={{ images, setImages, mesh, setMesh }}
              >
                <TextAreaChat
                  onSubmit={handleGenerate}
                  conversation={{
                    id: draftConversationId,
                    user_id: user?.id ?? '',
                  }}
                  placeholder="Start building with Kele..."
                  disabled={limitReached || isGenerating}
                  model={model}
                  setModel={setModel}
                  showPromptGenerator={true}
                  showFullLabels={true}
                />
              </SelectedItemsContext.Provider>
              <div className="relative">
                {isLoading && (
                  <div className="absolute left-0 right-0 top-0">
                    <div className="h-5 w-5 animate-spin rounded-full border-2 border-adam-blue border-t-transparent" />
                  </div>
                )}
                {!isLoading && user && limitReached && (
                  <div className="absolute left-0 right-0 top-0">
                    <LimitReachedMessage />
                  </div>
                )}
                {!isLoading && user && lowPrompts && !limitReached && (
                  <div className="absolute left-0 right-0 top-0">
                    <LowPromptsWarningMessage tokensRemaining={totalTokens} />
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
