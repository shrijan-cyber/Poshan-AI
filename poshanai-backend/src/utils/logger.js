import winston from 'winston';

const baseLogger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(winston.format.timestamp(), winston.format.errors(), winston.format.json()),
  transports: [new winston.transports.Console()],
});

// Accept fixed, non-sensitive messages only. Avoid passing request bodies, emails, tokens, or errors.
export const logger = Object.freeze({
  info: (message) => baseLogger.info(String(message)),
  warn: (message) => baseLogger.warn(String(message)),
  error: (message) => baseLogger.error(String(message)),
});

export default logger;
