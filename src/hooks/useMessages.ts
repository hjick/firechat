import { useState, useEffect, useCallback, useRef } from 'react';
import { useFireChatContext } from './FireChatProvider';
import type { Message, SendMessageParams, MessageWithSender } from '../types/message';
import type { ChatUser } from '../types/user';

interface UseMessagesReturn {
  messages: MessageWithSender[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  send: (params: SendMessageParams) => Promise<Message | null>;
}

export function useMessages(roomId: string | undefined): UseMessagesReturn {
  const { firechat, ready } = useFireChatContext();
  const [rawMessages, setRawMessages] = useState<Message[]>([]);
  const [senderMap, setSenderMap] = useState<Map<string, ChatUser>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const loadingMore = useRef(false);

  // Initial load + real-time subscription
  useEffect(() => {
    if (!ready || !roomId) return;

    setLoading(true);
    setError(null);
    setRawMessages([]);
    setSenderMap(new Map());

    // Load initial messages
    firechat.messages
      .fetch(roomId)
      .then((page) => {
        setRawMessages(page.messages);
        setHasMore(page.hasMore);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error('Failed to load messages'));
        setLoading(false);
      });

    // Subscribe to new messages
    const unsubscribe = firechat.messages.subscribe(roomId, (newMessages) => {
      setRawMessages((prev) => {
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

  // Resolve senders when messages change and userResolver is configured
  useEffect(() => {
    if (!firechat.users || rawMessages.length === 0) return;

    const uniqueSenderIds = [...new Set(rawMessages.map((m) => m.senderId))];
    const allCached = uniqueSenderIds.every((id) => firechat.users!.getCached(id));

    if (allCached) {
      const map = new Map<string, ChatUser>();
      uniqueSenderIds.forEach((id) => {
        const cached = firechat.users!.getCached(id);
        if (cached) map.set(id, cached);
      });
      setSenderMap(map);
      return;
    }

    firechat.users.resolveMany(uniqueSenderIds).then((resolved) => {
      setSenderMap(resolved);
    });
  }, [firechat, rawMessages]);

  // Enrich messages with sender info
  const messages: MessageWithSender[] = rawMessages.map((msg) => ({
    ...msg,
    sender: senderMap.get(msg.senderId),
  }));

  // Load more (pagination)
  const loadMore = useCallback(async () => {
    if (!roomId || !hasMore || loadingMore.current) return;

    loadingMore.current = true;
    try {
      const oldestMessage = rawMessages[rawMessages.length - 1];
      if (!oldestMessage) return;

      const page = await firechat.messages.fetch(roomId, {
        before: oldestMessage.createdAt,
      });

      setRawMessages((prev) => [...prev, ...page.messages]);
      setHasMore(page.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load more messages'));
    } finally {
      loadingMore.current = false;
    }
  }, [firechat, roomId, rawMessages, hasMore]);

  // Send message with optimistic update
  const send = useCallback(
    async (params: SendMessageParams): Promise<Message | null> => {
      if (!roomId) return null;

      try {
        const message = await firechat.messages.send(roomId, params);

        // Add to local state immediately (optimistic)
        setRawMessages((prev) => {
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
