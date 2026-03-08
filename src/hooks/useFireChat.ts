import { useFireChatContext } from './FireChatProvider';
import type { FireChat } from '../core/FireChat';
import type { ChatUser } from '../types/user';

interface UseFireChatReturn {
  firechat: FireChat;
  currentUser: ChatUser | null;
  ready: boolean;
}

export function useFireChat(): UseFireChatReturn {
  const { firechat, ready } = useFireChatContext();

  let currentUser: ChatUser | null = null;
  try {
    currentUser = firechat.getCurrentUser();
  } catch {
    // Not authenticated yet
  }

  return { firechat, currentUser, ready };
}
