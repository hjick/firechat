import { useState, useEffect } from 'react';
import { useFireChatContext } from './FireChatProvider';

interface UsePresenceReturn {
  isOnline: boolean;
  lastSeenAt: Date | null;
}

export function usePresence(userId: string | undefined): UsePresenceReturn {
  const { firechat, ready } = useFireChatContext();
  const [isOnline, setIsOnline] = useState(false);
  const [lastSeenAt, setLastSeenAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!ready || !userId) {
      setIsOnline(false);
      setLastSeenAt(null);
      return;
    }

    return firechat.presence.subscribe(userId, (data) => {
      setIsOnline(data.isOnline);
      setLastSeenAt(data.lastSeenAt);
    });
  }, [firechat, ready, userId]);

  return { isOnline, lastSeenAt };
}
