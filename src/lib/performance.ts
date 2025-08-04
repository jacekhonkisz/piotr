import logger from './logger'

export class PerformanceMonitor {
  private static instance: PerformanceMonitor
  private metrics: Map<string, number[]> = new Map()
  
  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor()
    }
    return PerformanceMonitor.instance
  }
  
  recordMetric(name: string, value: number): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }
    this.metrics.get(name)!.push(value)
    
    // Log performance metrics for monitoring
    logger.info('Performance metric recorded', { metric: name, value })
  }
  
  getAverageMetric(name: string): number {
    const values = this.metrics.get(name) || []
    if (values.length === 0) return 0
    return values.reduce((sum, val) => sum + val, 0) / values.length
  }
  
  getMetrics(): Record<string, number> {
    const result: Record<string, number> = {}
    this.metrics.forEach((_, name) => {
      result[name] = this.getAverageMetric(name)
    })
    return result
  }
  
  clearMetrics(): void {
    this.metrics.clear()
    logger.info('Performance metrics cleared')
  }
  
  // Convenience methods for common metrics
  recordAPICall(endpoint: string, duration: number): void {
    this.recordMetric(`api.${endpoint}.duration`, duration)
  }
  
  recordDatabaseQuery(table: string, duration: number): void {
    this.recordMetric(`db.${table}.duration`, duration)
  }
  
  recordPageLoad(page: string, duration: number): void {
    this.recordMetric(`page.${page}.load`, duration)
  }
}

export const performanceMonitor = PerformanceMonitor.getInstance() 