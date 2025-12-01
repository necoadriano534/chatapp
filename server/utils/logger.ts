import fs from 'fs';
import path from 'path';

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  
  // Log levels
  info: '\x1b[36m',      // Cyan
  warn: '\x1b[33m',      // Yellow
  error: '\x1b[31m',     // Red
  debug: '\x1b[35m',     // Magenta
  success: '\x1b[32m',   // Green
  
  // HTTP methods
  GET: '\x1b[32m',       // Green
  POST: '\x1b[34m',      // Blue
  PUT: '\x1b[33m',       // Yellow
  PATCH: '\x1b[33m',     // Yellow
  DELETE: '\x1b[31m',    // Red
  
  // Other
  module: '\x1b[35m',    // Magenta
  path: '\x1b[36m',      // Cyan
  timestamp: '\x1b[90m'  // Gray
};

const logsDir = path.join(process.cwd(), 'data', 'logs');

// Ensure logs directory exists
function ensureLogsDir() {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
}

function getLogFilePath(): string {
  const date = new Date().toISOString().split('T')[0];
  return path.join(logsDir, `${date}.log`);
}

function formatTimestamp(): string {
  return new Date().toISOString();
}

function writeToFile(message: string) {
  ensureLogsDir();
  const logPath = getLogFilePath();
  // Strip ANSI codes for file
  const cleanMessage = message.replace(/\x1b\[[0-9;]*m/g, '');
  fs.appendFileSync(logPath, cleanMessage + '\n');
}

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'success';

interface LogOptions {
  module?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  path?: string;
  payload?: unknown;
  statusCode?: number;
}

function formatLog(level: LogLevel, message: string, options: LogOptions = {}): string {
  const timestamp = formatTimestamp();
  const parts: string[] = [];
  
  // Module
  if (options.module) {
    parts.push(`${colors.module}[${options.module}]${colors.reset}`);
  }
  
  // Timestamp
  parts.push(`${colors.timestamp}${timestamp}${colors.reset}`);
  
  // Level
  parts.push(`${colors[level]}${level.toUpperCase()}${colors.reset}`);
  
  // HTTP Method
  if (options.method) {
    const methodColor = colors[options.method] || colors.info;
    parts.push(`${methodColor}${options.method}${colors.reset}`);
  }
  
  // Path
  if (options.path) {
    parts.push(`${colors.path}${options.path}${colors.reset}`);
  }
  
  // Status code
  if (options.statusCode) {
    const statusColor = options.statusCode >= 400 ? colors.error : 
                        options.statusCode >= 300 ? colors.warn : colors.success;
    parts.push(`${statusColor}${options.statusCode}${colors.reset}`);
  }
  
  // Message
  parts.push(`- ${colors[level]}${message}${colors.reset}`);
  
  // Payload
  if (options.payload) {
    parts.push(`${colors.dim}${JSON.stringify(options.payload)}${colors.reset}`);
  }
  
  return parts.join(' ');
}

export const logger = {
  info(message: string, options?: LogOptions) {
    const formatted = formatLog('info', message, options);
    console.log(formatted);
    writeToFile(formatted);
  },
  
  warn(message: string, options?: LogOptions) {
    const formatted = formatLog('warn', message, options);
    console.warn(formatted);
    writeToFile(formatted);
  },
  
  error(message: string, options?: LogOptions) {
    const formatted = formatLog('error', message, options);
    console.error(formatted);
    writeToFile(formatted);
  },
  
  debug(message: string, options?: LogOptions) {
    if (process.env.NODE_ENV === 'development') {
      const formatted = formatLog('debug', message, options);
      console.log(formatted);
      writeToFile(formatted);
    }
  },
  
  success(message: string, options?: LogOptions) {
    const formatted = formatLog('success', message, options);
    console.log(formatted);
    writeToFile(formatted);
  },
  
  http(method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE', path: string, statusCode: number, payload?: unknown) {
    const options: LogOptions = {
      module: 'HTTP',
      method,
      path,
      statusCode,
      payload
    };
    const level: LogLevel = statusCode >= 400 ? 'error' : 'info';
    const formatted = formatLog(level, 'Request', options);
    console.log(formatted);
    writeToFile(formatted);
  }
};

export default logger;
