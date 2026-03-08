import { useState, useEffect } from 'react';
import { useFireChatContext } from './FireChatProvider';

interface UseUnreadCountReturn {
  count: number;
  markAsRead: () => Promise<void>;
}

export function useUnreadCount(
  roomId: string | undefined,
): UseUnreadCountReturn {
  const { firechat, ready } = useFireChatContext();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!ready || !roomId) {
      setCount(0);
      return;
    }

    return firechat.readReceipts.subscribeToUnreadCount(roomId, setCount);
  }, [firechat, ready, roomId]);

  const markAsRead = async () => {
    if (roomId) {
      await firechat.readReceipts.markAsRead(roomId);
    }
  };

  return { count, markAsRead };
}
