export interface ChatUser {
  /** Unique user identifier */
  id: string;
  /** Display name shown in chat */
  displayName: string;
  /** Avatar image URL */
  avatarUrl?: string;
  /** Whether the user is currently online */
  isOnline?: boolean;
  /** Last time the user was seen online */
  lastSeenAt?: Date;
  /** Custom metadata for app-specific user data */
  metadata?: Record<string, unknown>;
}
