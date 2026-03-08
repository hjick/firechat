import { useState, useEffect } from 'react';
import { useFireChatContext } from './FireChatProvider';
import type { ChatRoom } from '../types/room';

interface UseChatRoomsReturn {
  rooms: ChatRoom[];
  loading: boolean;
  error: Error | null;
}

export function useChatRooms(): UseChatRoomsReturn {
  const { firechat, ready } = useFireChatContext();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ready) return;

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = firechat.rooms.subscribe((updatedRooms) => {
        setRooms(updatedRooms);
        setLoading(false);
      });

      return unsubscribe;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load rooms'));
      setLoading(false);
    }
  }, [firechat, ready]);

  return { rooms, loading, error };
}
