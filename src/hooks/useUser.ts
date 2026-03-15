import { useState, useEffect } from 'react';
import { useFireChatContext } from './FireChatProvider';
import type { ChatUser } from '../types/user';

interface UseUserReturn {
  user: ChatUser | null;
  loading: boolean;
}

export function useUser(userId: string | undefined): UseUserReturn {
  const { firechat, ready } = useFireChatContext();
  const [user, setUser] = useState<ChatUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !userId || !firechat.users) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    firechat.users.resolve(userId).then((resolved) => {
      setUser(resolved);
      setLoading(false);
    });
  }, [firechat, ready, userId]);

  return { user, loading };
}
