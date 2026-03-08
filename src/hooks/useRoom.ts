import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { useFireChatContext } from './FireChatProvider';
import type { ChatRoom } from '../types/room';
import { roomConverter } from '../utils/converter';

interface UseRoomReturn {
  room: ChatRoom | null;
  loading: boolean;
  error: Error | null;
}

export function useRoom(roomId: string | undefined): UseRoomReturn {
  const { firechat, ready } = useFireChatContext();
  const [room, setRoom] = useState<ChatRoom | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!ready || !roomId) {
      setRoom(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const roomRef = doc(
      firechat.firestore,
      firechat.roomsCollection,
      roomId,
    ).withConverter(roomConverter);

    const unsubscribe = onSnapshot(
      roomRef,
      (snapshot) => {
        setRoom(snapshot.exists() ? snapshot.data() : null);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [firechat, ready, roomId]);

  return { room, loading, error };
}
