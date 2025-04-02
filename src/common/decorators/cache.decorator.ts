import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key_metadata';
export const CACHE_TTL_METADATA = 'cache_ttl_metadata';
export const CACHE_TAGS_METADATA = 'cache_tags_metadata';
export const NO_CACHE_KEY = 'no-cache';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string | ((request: any) => string); // Custom cache key or function to generate it
  tags?: string[]; // Tags for group invalidation
}

export const Cache = (options: CacheOptions = {}) => {
  return (target: any, key: string, descriptor: any) => {
    if (options.ttl !== undefined) {
      SetMetadata(CACHE_TTL_METADATA, options.ttl)(target, key, descriptor);
    }
    if (options.key !== undefined) {
      SetMetadata(CACHE_KEY_METADATA, options.key)(target, key, descriptor);
    }
    if (options.tags !== undefined) {
      SetMetadata(CACHE_TAGS_METADATA, options.tags)(target, key, descriptor);
    }
    return descriptor;
  };
};

// Helper decorators for common use cases
export const NoCache = () => SetMetadata(NO_CACHE_KEY, true);

// Short-lived cache for frequently changing data
export const ShortCache = (
  options: Omit<CacheOptions, 'ttl'> & { ttl?: number } = {},
) => {
  return Cache({
    ttl: options.ttl || 60, // Default 1 minute
    key: options.key,
    tags: options.tags,
  });
};

// Long-lived cache for relatively static data
export const LongCache = (
  options: Omit<CacheOptions, 'ttl'> & { ttl?: number } = {},
) => {
  return Cache({
    ttl: options.ttl || 3600, // Default 1 hour
    key: options.key,
    tags: options.tags,
  });
};

// User-specific cache
export const UserCache = (ttl: number = 300, tags: string[] = []) => {
  return Cache({
    ttl,
    tags: ['user-specific', ...tags],
    key: (req: any) => {
      const userId = req.user?.id || req.user?.sub || 'anonymous';
      return `${req.method}:${req.originalUrl}:user:${userId}`;
    },
  });
};
