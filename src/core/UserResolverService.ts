import type { FireChat } from './FireChat';
import type { ChatUser } from '../types/user';
import type { UserResolver } from '../types/config';

interface CachedUser {
  user: ChatUser;
  cachedAt: number;
}

export class UserResolverService {
  private cache: Map<string, CachedUser> = new Map();
  private pendingRequests: Map<string, Promise<ChatUser>> = new Map();
  private readonly resolver: UserResolver;
  private readonly cacheTTL: number;

  constructor(private readonly firechat: FireChat, resolver: UserResolver) {
    this.resolver = resolver;
    this.cacheTTL = firechat.options.userResolverCacheTTL;
  }

  /**
   * Resolve a single user ID to a ChatUser.
   * Uses in-memory cache and deduplicates concurrent requests.
   */
  async resolve(userId: string): Promise<ChatUser> {
    // Check cache
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      return cached.user;
    }

    // Check if there's already a pending request for this user
    const pending = this.pendingRequests.get(userId);
    if (pending) {
      return pending;
    }

    // Create new request
    const request = this.resolver(userId)
      .then((user) => {
        this.cache.set(userId, { user, cachedAt: Date.now() });
        this.pendingRequests.delete(userId);
        return user;
      })
      .catch(() => {
        this.pendingRequests.delete(userId);
        // Return a fallback user on error
        const fallback: ChatUser = {
          id: userId,
          displayName: `User_${userId.slice(0, 6)}`,
        };
        return fallback;
      });

    this.pendingRequests.set(userId, request);
    return request;
  }

  /**
   * Resolve multiple user IDs in parallel.
   * Deduplicates and caches results.
   */
  async resolveMany(userIds: string[]): Promise<Map<string, ChatUser>> {
    const uniqueIds = [...new Set(userIds)];
    const results = await Promise.all(
      uniqueIds.map((id) => this.resolve(id)),
    );

    const map = new Map<string, ChatUser>();
    uniqueIds.forEach((id, index) => {
      map.set(id, results[index]);
    });
    return map;
  }

  /**
   * Get a cached user synchronously (returns undefined if not cached).
   */
  getCached(userId: string): ChatUser | undefined {
    const cached = this.cache.get(userId);
    if (cached && Date.now() - cached.cachedAt < this.cacheTTL) {
      return cached.user;
    }
    return undefined;
  }

  /**
   * Manually invalidate cache for a user (e.g., after profile update).
   */
  invalidate(userId: string): void {
    this.cache.delete(userId);
  }

  /**
   * Clear the entire cache.
   */
  clearCache(): void {
    this.cache.clear();
    this.pendingRequests.clear();
  }
}
