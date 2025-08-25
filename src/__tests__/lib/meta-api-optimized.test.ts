/**
 * Comprehensive tests for optimized Meta API service
 */

import { MetaAPIServiceOptimized, getGlobalCacheStats, clearGlobalCache } from '../../lib/meta-api-optimized';

// Mock fetch
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

// Mock logger
jest.mock('../../lib/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

describe('Optimized Meta API Service', () => {
  let service: MetaAPIServiceOptimized;
  const mockToken = 'test-access-token-123';

  beforeEach(() => {
    jest.clearAllMocks();
    clearGlobalCache();
    service = new MetaAPIServiceOptimized(mockToken);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Memory Management', () => {
    it('should track cache memory usage', () => {
      const stats = getGlobalCacheStats();
      
      expect(stats).toHaveProperty('entries');
      expect(stats).toHaveProperty('memoryUsageMB');
      expect(stats).toHaveProperty('maxMemoryMB');
      expect(stats).toHaveProperty('memoryUtilization');
      
      expect(typeof stats.entries).toBe('number');
      expect(typeof stats.memoryUsageMB).toBe('number');
      expect(typeof stats.maxMemoryMB).toBe('number');
      expect(typeof stats.memoryUtilization).toBe('number');
    });

    it('should prevent cache from exceeding memory limits', async () => {
      // Mock large response
      const largeData = Array(10000).fill(0).map((_, i) => ({
        id: `campaign-${i}`,
        name: `Campaign ${i}`,
        data: 'x'.repeat(1000) // 1KB per campaign
      }));

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: largeData })
      } as Response);

      // Make multiple requests to fill cache
      for (let i = 0; i < 10; i++) {
        await service.getCampaigns(`account-${i}`, { start: '2024-01-01', end: '2024-01-31' });
      }

      const stats = getGlobalCacheStats();
      expect(stats.memoryUsageMB).toBeLessThan(stats.maxMemoryMB);
    });

    it('should evict least used entries when cache is full', async () => {
      const smallData = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: smallData })
      } as Response);

      // Fill cache beyond max entries
      const promises = [];
      for (let i = 0; i < 1100; i++) { // More than max size (1000)
        promises.push(service.getCampaigns(`account-${i}`, { start: '2024-01-01', end: '2024-01-31' }));
      }

      await Promise.all(promises);

      const stats = getGlobalCacheStats();
      expect(stats.entries).toBeLessThanOrEqual(1000); // Should not exceed max size
    });
  });

  describe('API Requests', () => {
    it('should make successful API request', async () => {
      const mockCampaigns = [
        { id: 'campaign-1', name: 'Test Campaign 1', status: 'ACTIVE' },
        { id: 'campaign-2', name: 'Test Campaign 2', status: 'PAUSED' }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      const result = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });

      expect(result).toEqual(mockCampaigns);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('act_123456789/campaigns'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${mockToken}`
          })
        })
      );
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: {
            message: 'Invalid access token',
            type: 'OAuthException',
            code: 190
          }
        })
      } as Response);

      const result = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });

      expect(result).toEqual([]);
    });

    it('should handle network timeouts', async () => {
      // Mock timeout
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      const result = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });

      expect(result).toEqual([]);
    });

    it('should handle request timeout with AbortController', async () => {
      jest.useFakeTimers();

      // Mock long-running request
      mockFetch.mockImplementation(() => 
        new Promise((resolve) => 
          setTimeout(() => resolve({
            ok: true,
            json: () => Promise.resolve({ data: [] })
          } as Response), 35000) // 35 seconds - longer than timeout
        )
      );

      const requestPromise = service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });

      // Fast-forward time to trigger timeout
      jest.advanceTimersByTime(31000); // 31 seconds

      const result = await requestPromise;
      expect(result).toEqual([]);

      jest.useRealTimers();
    });
  });

  describe('Caching', () => {
    it('should cache successful responses', async () => {
      const mockCampaigns = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      // First request
      const result1 = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(result1).toEqual(mockCampaigns);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request - should use cache
      const result2 = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(result2).toEqual(mockCampaigns);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
    });

    it('should isolate cache between different tokens', async () => {
      const service2 = new MetaAPIServiceOptimized('different-token-456');
      const mockCampaigns = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      // Request with first service
      await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Request with second service (different token) - should make new API call
      await service2.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clear cache for specific token', async () => {
      const mockCampaigns = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      // Load data into cache
      await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Verify cache hit
      await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      service.clearCache();

      // Should make new API call
      await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Token Validation', () => {
    it('should validate valid token', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'user-123', name: 'Test User' })
      } as Response);

      const result = await service.validateToken();

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should detect invalid token', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({
          error: {
            message: 'Invalid access token',
            type: 'OAuthException',
            code: 190
          }
        })
      } as Response);

      const result = await service.validateToken();

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid access token');
    });

    it('should cache token validation results', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'user-123', name: 'Test User' })
      } as Response);

      // First validation
      const result1 = await service.validateToken();
      expect(result1.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second validation - should use cache
      const result2 = await service.validateToken();
      expect(result2.valid).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional API call
    });
  });

  describe('Performance', () => {
    it('should complete requests within reasonable time', async () => {
      const mockCampaigns = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      const startTime = performance.now();
      const result = await service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' });
      const endTime = performance.now();

      expect(result).toEqual(mockCampaigns);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should handle concurrent requests efficiently', async () => {
      const mockCampaigns = [{ id: 'campaign-1', name: 'Test Campaign' }];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: mockCampaigns })
      } as Response);

      // Make concurrent requests for same data
      const promises = Array(5).fill(0).map(() => 
        service.getCampaigns('123456789', { start: '2024-01-01', end: '2024-01-31' })
      );

      const results = await Promise.all(promises);

      // All should return same data
      results.forEach(result => {
        expect(result).toEqual(mockCampaigns);
      });

      // Should only make one API call due to caching
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
