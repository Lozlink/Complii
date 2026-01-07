/**
 * Simple logger utility for debugging and monitoring
 */

type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug';

interface Logger {
  log: (...args: unknown[]) => void;
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
  debug: (...args: unknown[]) => void;
}

export function createLogger(namespace: string): Logger {
  const prefix = `[${namespace}]`;
  
  const createLogFn = (level: LogLevel) => {
    return (...args: unknown[]) => {
      if (level === 'debug' && process.env.NODE_ENV === 'production') {
        return; // Skip debug logs in production
      }
      
      console[level](prefix, ...args);
    };
  };

  return {
    log: createLogFn('log'),
    info: createLogFn('info'),
    warn: createLogFn('warn'),
    error: createLogFn('error'),
    debug: createLogFn('debug'),
  };
}
