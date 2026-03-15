import type { FirebaseApp } from 'firebase/app';
import type { ChatUser } from './user';
import type { StorageAdapter } from './adapter';
import type { FileUploader } from './uploader';

/** Callback to resolve a userId to user profile (name, avatar, etc.) */
export type UserResolver = (userId: string) => Promise<ChatUser>;

export type AuthConfig =
  | { type: 'firebase' }
  | {
      type: 'custom-token';
      /** Returns a Firebase Custom Token from your server */
      getToken: () => string | Promise<string>;
      /** Returns the current user info (id should match the uid used to create the custom token) */
      getUser: () => ChatUser | Promise<ChatUser>;
    }
  | { type: 'anonymous'; displayName?: string };

export interface FireChatOptions {
  /** Firestore collection name prefix. Default: 'firechat' */
  collectionPrefix?: string;
  /** Enable user online/offline presence tracking via RTDB. Default: false */
  enablePresence?: boolean;
  /** Enable typing indicators. Default: true */
  enableTypingIndicator?: boolean;
  /** Enable read receipts and unread counts. Default: true */
  enableReadReceipts?: boolean;
  /** Number of messages to load per page. Default: 30 */
  pageSize?: number;
  /** Typing indicator timeout in ms. Default: 5000 */
  typingTimeout?: number;
  /** User resolver cache TTL in milliseconds. Default: 300000 (5 minutes) */
  userResolverCacheTTL?: number;
}

export interface FireChatConfig {
  /** Initialized Firebase app instance */
  firebaseApp: FirebaseApp;
  /** Authentication configuration */
  auth: AuthConfig;
  /** Optional storage adapter for syncing with external databases */
  adapter?: StorageAdapter;
  /** Optional file uploader for image/file message uploads */
  uploader?: FileUploader;
  /** Optional callback to resolve userId to user profile (name, avatar). SDK caches results. */
  userResolver?: UserResolver;
  /** Library options */
  options?: FireChatOptions;
}

export const DEFAULT_OPTIONS: Required<FireChatOptions> = {
  collectionPrefix: 'firechat',
  enablePresence: false,
  enableTypingIndicator: true,
  enableReadReceipts: true,
  pageSize: 30,
  typingTimeout: 5000,
  userResolverCacheTTL: 300000,
};
