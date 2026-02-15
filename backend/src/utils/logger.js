const winston = require('winston');
const config = require('../config');

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp: ts, ...meta }) => {
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${ts} [${level}]: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: config.isProduction ? 'info' : 'debug',
  defaultMeta: { service: 'bazaar-api' },
  transports: [
    new winston.transports.Console({
      format: config.isProduction
        ? combine(timestamp(), json())
        : combine(timestamp({ format: 'HH:mm:ss' }), colorize(), devFormat),
    }),
  ],
  // Don't exit on uncaught exceptions — let the process manager handle restarts
  exitOnError: false,
});

// Stream for Morgan HTTP logging
logger.stream = {
  write: (message) => logger.http(message.trim()),
};

module.exports = logger;
