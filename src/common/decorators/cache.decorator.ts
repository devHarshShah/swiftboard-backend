import { SetMetadata } from '@nestjs/common';

export const CACHE_KEY_METADATA = 'cache_key_metadata';
export const CACHE_TTL_METADATA = 'cache_ttl_metadata';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  key?: string | ((request: any) => string); // Custom cache key or function to generate it
}

export const Cache = (options: CacheOptions = {}) => {
  return (target: any, key: string, descriptor: any) => {
    if (options.ttl !== undefined) {
      SetMetadata(CACHE_TTL_METADATA, options.ttl)(target, key, descriptor);
    }
    if (options.key !== undefined) {
      SetMetadata(CACHE_KEY_METADATA, options.key)(target, key, descriptor);
    }
    return descriptor;
  };
};
