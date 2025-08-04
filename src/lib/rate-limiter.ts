import rateLimit from 'express-rate-limit'
import logger from './logger'

export const createRateLimiter = (options: {
  windowMs?: number
  max?: number
  message?: string
  keyGenerator?: (req: any) => string
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: options.message || 'Too many requests from this IP',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: options.keyGenerator || ((req) => req.ip),
    handler: (req, res) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        endpoint: req.path,
        userAgent: req.get('User-Agent')
      })
      res.status(429).json({
        error: options.message || 'Too many requests from this IP, please try again later.'
      })
    }
  })
}

export const apiLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many API requests from this IP, please try again later.'
})

export const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: 'Too many authentication attempts, please try again later.'
})

export const reportGenerationLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // limit each IP to 10 report generations per hour
  message: 'Too many report generation requests, please try again later.'
}) 