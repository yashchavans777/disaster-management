/**
 * Minimal structured logger.
 * Drop-in replacement for console so log levels are explicit
 * and can be silenced by setting LOG_LEVEL=none.
 */

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LEVELS = { none: 0, error: 1, warn: 2, info: 3, debug: 4 };
const currentLevel = LEVELS[LOG_LEVEL] ?? LEVELS.info;

const timestamp = () => new Date().toISOString();

const logger = {
  info: (...args) => {
    if (currentLevel >= LEVELS.info) {
      process.stdout.write(`[${timestamp()}] INFO  ${args.join(' ')}\n`);
    }
  },
  warn: (...args) => {
    if (currentLevel >= LEVELS.warn) {
      process.stderr.write(`[${timestamp()}] WARN  ${args.join(' ')}\n`);
    }
  },
  error: (...args) => {
    if (currentLevel >= LEVELS.error) {
      process.stderr.write(`[${timestamp()}] ERROR ${args.join(' ')}\n`);
    }
  },
  debug: (...args) => {
    if (currentLevel >= LEVELS.debug) {
      process.stdout.write(`[${timestamp()}] DEBUG ${args.join(' ')}\n`);
    }
  },
};

module.exports = logger;
