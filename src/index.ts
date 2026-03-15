// Core
export { FireChat } from './core/FireChat';
export { RoomService } from './core/RoomService';
export { MessageService } from './core/MessageService';
export { TypingService } from './core/TypingService';
export { ReadReceiptService } from './core/ReadReceiptService';
export { PresenceService } from './core/PresenceService';

// Storage
export { FirebaseStorageUploader } from './storage/FirebaseStorageUploader';

// React hooks and provider
export { FireChatProvider } from './hooks/FireChatProvider';
export { useFireChat } from './hooks/useFireChat';
export { useChatRooms } from './hooks/useChatRooms';
export { usePublicRooms } from './hooks/usePublicRooms';
export { useMessages } from './hooks/useMessages';
export { useRoom } from './hooks/useRoom';
export { useTypingUsers } from './hooks/useTypingUsers';
export { useUnreadCount } from './hooks/useUnreadCount';
export { usePresence } from './hooks/usePresence';

// Types
export type { FireChatConfig, FireChatOptions, AuthConfig } from './types/config';
export type { ChatRoom, RoomType, RoomMember, MemberRole, LastMessage, CreateRoomParams, PublicRoomListOptions } from './types/room';
export type { Message, MessageType, DeliveryStatus, SendMessageParams, MessagePage } from './types/message';
export type { ChatUser } from './types/user';
export type { StorageAdapter } from './types/adapter';
export type { FileUploader, UploadResult, UploadProgress } from './types/uploader';

// Constants
export { DEFAULT_OPTIONS } from './types/config';
