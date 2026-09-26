import winston from 'winston';

const PII_PATTERNS = [
  { regex: /"password(?:Hash)?"\s*:\s*"[^"]*"/gi, replacement: '"password":"[REDACTED]"' },
  { regex: /"(?:access|refresh)?[Tt]oken(?:Hash)?"\s*:\s*"[^"]*"/gi, replacement: '"token":"[REDACTED]"' },
  { regex: /Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, replacement: 'Bearer [REDACTED]' },
];

const redactPii = winston.format((info) => {
  if (typeof info.message === 'string') {
    for (const { regex, replacement } of PII_PATTERNS) {
      info.message = info.message.replace(regex, replacement);
    }
  }
  return info;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: winston.format.combine(
    redactPii(),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: { service: 'poshanai-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message, service, ...rest }) => {
          const extra = Object.keys(rest).length ? ` ${JSON.stringify(rest)}` : '';
          return `${timestamp} [${service}] ${level}: ${message}${extra}`;
        }),
      ),
    }),
  ],
});

export default logger;
