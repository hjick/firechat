import { useState, useEffect } from 'react';
import { useFireChatContext } from './FireChatProvider';
import type { ChatRoom } from '../types/room';

interface UsePublicRoomsOptions {
  /** Maximum number of public rooms to subscribe to. Default: 20 */
  limit?: number;
}

interface UsePublicRoomsReturn {
  rooms: ChatRoom[];
  loading: boolean;
  error: Error | null;
}

export function usePublicRooms(options?: UsePublicRoomsOptions): UsePublicRoomsReturn {
  const { firechat, ready } = useFireChatContext();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ready) return;

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = firechat.rooms.subscribePublic(
        (updatedRooms) => {
          setRooms(updatedRooms);
          setLoading(false);
        },
        { limit: options?.limit },
      );

      return unsubscribe;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load public rooms'));
      setLoading(false);
    }
  }, [firechat, ready, options?.limit]);

  return { rooms, loading, error };
}
