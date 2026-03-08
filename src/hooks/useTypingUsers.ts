import { useState, useEffect, useCallback, useRef } from 'react';
import { useFireChatContext } from './FireChatProvider';

interface UseTypingUsersReturn {
  typingUserIds: string[];
  startTyping: () => void;
  stopTyping: () => void;
}

export function useTypingUsers(
  roomId: string | undefined,
): UseTypingUsersReturn {
  const { firechat, ready } = useFireChatContext();
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

  useEffect(() => {
    if (!ready || !roomId) {
      setTypingUserIds([]);
      return;
    }

    return firechat.typing.subscribe(roomId, setTypingUserIds);
  }, [firechat, ready, roomId]);

  // Stop typing when unmounting or leaving room
  useEffect(() => {
    return () => {
      if (roomIdRef.current) {
        firechat.typing.stopTyping(roomIdRef.current);
      }
    };
  }, [firechat]);

  const startTyping = useCallback(() => {
    if (roomId) firechat.typing.startTyping(roomId);
  }, [firechat, roomId]);

  const stopTyping = useCallback(() => {
    if (roomId) firechat.typing.stopTyping(roomId);
  }, [firechat, roomId]);

  return { typingUserIds, startTyping, stopTyping };
}
