// React hooks and provider
export { FireChatProvider } from './hooks/FireChatProvider';
export { useFireChat } from './hooks/useFireChat';
export { useChatRooms } from './hooks/useChatRooms';
export { useMessages } from './hooks/useMessages';
export { useRoom } from './hooks/useRoom';
export { useTypingUsers } from './hooks/useTypingUsers';
export { useUnreadCount } from './hooks/useUnreadCount';
export { usePresence } from './hooks/usePresence';

// Re-export commonly used types for convenience
export type { FireChatConfig } from './types/config';
export type { ChatRoom, CreateRoomParams } from './types/room';
export type { Message, SendMessageParams } from './types/message';
export type { ChatUser } from './types/user';
