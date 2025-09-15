/**
 * AI Summary Generator Tests
 * 
 * Comprehensive tests for AI summary generation functionality
 */

import { generateAISummary } from '../ai-summary-generator';
import { ExecutiveSummaryData } from '../ai-summary-generator';

// Mock the dependencies
jest.mock('../logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
}));

jest.mock('../ai-summary-config', () => ({
  getAISummaryConfig: jest.fn(() => ({
    openai: {
      model: 'gpt-3.5-turbo',
      maxTokens: 300,
      temperature: 0.5,
      maxRetries: 3,
      retryDelayMs: 1000
    },
    costControl: {
      maxDailyCost: 10.0,
      maxMonthlyCost: 300.0,
      costPerToken: 0.0015 / 1000
    },
    fallback: {
      enabled: true,
      useInDevelopment: true,
      useInCheapMode: true
    }
  })),
  validateConfig: jest.fn(() => ({ isValid: true, errors: [] }))
}));

jest.mock('../ai-summary-rate-limiter', () => ({
  getInstance: jest.fn(() => ({
    checkRateLimit: jest.fn(() => ({ allowed: true })),
    recordRequest: jest.fn()
  }))
}));

jest.mock('../ai-summary-cost-tracker', () => ({
  getInstance: jest.fn(() => ({
    checkDailyLimit: jest.fn(() => ({ exceeded: false, current: 0, limit: 10 })),
    recordCost: jest.fn()
  }))
}));

// Mock fetch for OpenAI API calls
global.fetch = jest.fn();

describe('AI Summary Generator', () => {
  const mockSummaryData: ExecutiveSummaryData = {
    totalSpend: 1000,
    totalImpressions: 10000,
    totalClicks: 100,
    totalConversions: 5,
    averageCtr: 1.0,
    averageCpc: 10.0,
    averageCpa: 200.0,
    currency: 'PLN',
    dateRange: {
      start: '2024-01-01',
      end: '2024-01-31'
    },
    clientName: 'Test Client',
    reservations: 5,
    reservationValue: 1000,
    roas: 1.0,
    costPerReservation: 200.0
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.OPENAI_API_KEY = 'test-key';
  });

  describe('generateAISummary', () => {
    it('should return fallback summary in development mode', async () => {
      process.env.NODE_ENV = 'development';
      
      const result = await generateAISummary(mockSummaryData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
      expect(result).toContain('[DEV MODE - Fallback Summary]');
    });

    it('should return fallback summary when cheap mode is enabled', async () => {
      process.env.AI_CHEAP_MODE = 'true';
      
      const result = await generateAISummary(mockSummaryData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
      expect(result).toContain('[DEV MODE - Fallback Summary]');
    });

    it('should return fallback summary when rate limit is exceeded', async () => {
      const { AISummaryRateLimiter } = require('../ai-summary-rate-limiter');
      const mockRateLimiter = AISummaryRateLimiter.getInstance();
      mockRateLimiter.checkRateLimit.mockReturnValue({
        allowed: false,
        reason: 'Rate limit exceeded'
      });
      
      const result = await generateAISummary(mockSummaryData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should return fallback summary when daily cost limit is exceeded', async () => {
      const { AISummaryCostTracker } = require('../ai-summary-cost-tracker');
      const mockCostTracker = AISummaryCostTracker.getInstance();
      mockCostTracker.checkDailyLimit.mockReturnValue({
        exceeded: true,
        current: 15,
        limit: 10
      });
      
      const result = await generateAISummary(mockSummaryData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should return fallback summary for invalid input data', async () => {
      const invalidData = {
        ...mockSummaryData,
        clientName: '' // Invalid: empty client name
      };
      
      const result = await generateAISummary(invalidData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should call OpenAI API in production mode', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_CHEAP_MODE = 'false';
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test AI summary response'
            }
          }]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await generateAISummary(mockSummaryData);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-key'
          },
          body: expect.stringContaining('gpt-3.5-turbo')
        })
      );
      
      expect(result).toBe('Test AI summary response');
    });

    it('should retry on OpenAI API failures', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_CHEAP_MODE = 'false';
      
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await generateAISummary(mockSummaryData);
      
      // Should retry 3 times, then return fallback
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should handle rate limit responses with retry-after header', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_CHEAP_MODE = 'false';
      
      const mockResponse = {
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: jest.fn().mockReturnValue('60')
        }
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const result = await generateAISummary(mockSummaryData);
      
      // Should retry after rate limit
      expect(global.fetch).toHaveBeenCalledTimes(3);
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should record cost and rate limit data', async () => {
      process.env.NODE_ENV = 'production';
      process.env.AI_CHEAP_MODE = 'false';
      
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Test AI summary response'
            }
          }]
        })
      };
      
      (global.fetch as jest.Mock).mockResolvedValue(mockResponse);
      
      const { AISummaryRateLimiter } = require('../ai-summary-rate-limiter');
      const { AISummaryCostTracker } = require('../ai-summary-cost-tracker');
      const mockRateLimiter = AISummaryRateLimiter.getInstance();
      const mockCostTracker = AISummaryCostTracker.getInstance();
      
      await generateAISummary(mockSummaryData, 'test-client-id');
      
      expect(mockRateLimiter.recordRequest).toHaveBeenCalledWith('test-client-id');
      expect(mockCostTracker.recordCost).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  describe('Data validation', () => {
    it('should validate required fields', async () => {
      const invalidData = {
        totalSpend: 1000,
        totalImpressions: 10000,
        totalClicks: 100,
        totalConversions: 5,
        averageCtr: 1.0,
        averageCpc: 10.0,
        averageCpa: 200.0,
        currency: 'PLN',
        dateRange: {
          start: '2024-01-01',
          end: '2024-01-31'
        },
        clientName: '', // Invalid: empty client name
        reservations: 5,
        reservationValue: 1000,
        roas: 1.0,
        costPerReservation: 200.0
      };
      
      const result = await generateAISummary(invalidData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should validate date range', async () => {
      const invalidData = {
        ...mockSummaryData,
        dateRange: {
          start: '', // Invalid: empty start date
          end: '2024-01-31'
        }
      };
      
      const result = await generateAISummary(invalidData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });

    it('should validate numeric values', async () => {
      const invalidData = {
        ...mockSummaryData,
        totalSpend: -1000 // Invalid: negative spend
      };
      
      const result = await generateAISummary(invalidData);
      
      expect(result).toContain('W okresie od');
      expect(result).toContain('kampanie reklamowe');
    });
  });
});
