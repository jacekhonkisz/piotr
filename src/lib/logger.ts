// Browser-safe logger that works in both client and server environments
const logger = {
  info: (message: string, ...args: any[]) => {
    if (typeof window === 'undefined') {
      // Server-side: use console for now (can be enhanced with winston later)
      console.log(`[INFO] ${message}`, ...args);
    } else {
      // Client-side: use console
      console.log(`[INFO] ${message}`, ...args);
    }
  },
  
  error: (message: string, ...args: any[]) => {
    if (typeof window === 'undefined') {
      console.error(`[ERROR] ${message}`, ...args);
    } else {
      console.error(`[ERROR] ${message}`, ...args);
    }
  },
  
  warn: (message: string, ...args: any[]) => {
    if (typeof window === 'undefined') {
      console.warn(`[WARN] ${message}`, ...args);
    } else {
      console.warn(`[WARN] ${message}`, ...args);
    }
  },
  
  debug: (message: string, ...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      if (typeof window === 'undefined') {
        console.debug(`[DEBUG] ${message}`, ...args);
      } else {
        console.debug(`[DEBUG] ${message}`, ...args);
      }
    }
  }
};

export default logger 