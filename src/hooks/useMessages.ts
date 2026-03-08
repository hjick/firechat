import { useState, useEffect, useCallback, useRef } from 'react';
import { useFireChatContext } from './FireChatProvider';
import type { Message, SendMessageParams } from '../types/message';

interface UseMessagesReturn {
  messages: Message[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  send: (params: SendMessageParams) => Promise<Message | null>;
}

export function useMessages(roomId: string | undefined): UseMessagesReturn {
  const { firechat, ready } = useFireChatContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingMore = useRef(false);

  // Initial load + real-time subscription
  useEffect(() => {
    if (!ready || !roomId) return;

    setLoading(true);
    setError(null);
    setMessages([]);

    // Load initial messages
    firechat.messages
      .fetch(roomId)
      .then((page) => {
        setMessages(page.messages);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to load messages'));
        setLoading(false);
      });

    // Subscribe to new messages
    const unsubscribe = firechat.messages.subscribe(roomId, (newMessages) => {
      setMessages((prev) => {
        // Deduplicate by id
        const existingIds = new Set(prev.map((m) => m.id));
        const unique = newMessages.filter((m) => !existingIds.has(m.id));
        return [...unique, ...prev];
      });
    });

    // Mark as read when entering room
    if (firechat.options.enableReadReceipts) {
      firechat.readReceipts.markAsRead(roomId);
    }

    return unsubscribe;
  }, [firechat, ready, roomId]);

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loadingMore.current) return;

    loadingMore.current = true;
    try {
      const oldestMessage = messages[messages.length - 1];
      if (!oldestMessage) return;

      const page = await firechat.messages.fetch(roomId, {
        before: oldestMessage.createdAt,
      });

      setMessages((prev) => [...prev, ...page.messages]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more messages'));
    } finally {
      loadingMore.current = false;
    }
  }, [firechat, roomId, messages, hasMore]);

  // Send message with optimistic update
  const send = useCallback(
    async (params: SendMessageParams): Promise<Message | null> => {
      if (!roomId) return null;

      try {
        const message = await firechat.messages.send(roomId, params);

        // Add to local state immediately (optimistic)
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === message.id);
          if (exists) return prev;
          return [message, ...prev];
        });

        // Mark as read after sending
        if (firechat.options.enableReadReceipts) {
          firechat.readReceipts.markAsRead(roomId);
        }

        return message;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to send message'));
        return null;
      }
    },
    [firechat, roomId],
  );

  return { messages, loading, error, hasMore, loadMore, send };
}
