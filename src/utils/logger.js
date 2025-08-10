const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

// Log levels
const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3
};

// Current log level (can be changed via environment variable)
const currentLogLevel = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO;

class Logger {
  static error(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.ERROR) {
      console.log(`${colors.red}${colors.bright}[ERROR]${colors.reset} ${message}`, ...args);
    }
  }

  static warn(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.WARN) {
      console.log(`${colors.yellow}${colors.bright}[WARN]${colors.reset} ${message}`, ...args);
    }
  }

  static info(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.blue}${colors.bright}[INFO]${colors.reset} ${message}`, ...args);
    }
  }

  static debug(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(`${colors.cyan}[DEBUG]${colors.reset} ${message}`, ...args);
    }
  }

  // Special loggers for different systems
  static rcon(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.green}${colors.bright}[RCON]${colors.reset} ${message}`, ...args);
    }
  }

  static nightSkip(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.magenta}${colors.bright}[NIGHT SKIP]${colors.reset} ${message}`, ...args);
    }
  }

  static event(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.cyan}${colors.bright}[EVENT]${colors.reset} ${message}`, ...args);
    }
  }

  static kit(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.yellow}${colors.bright}[KIT]${colors.reset} ${message}`, ...args);
    }
  }

  static link(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.blue}${colors.bright}[LINK]${colors.reset} ${message}`, ...args);
    }
  }

  static playerCount(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.green}[PLAYER COUNT]${colors.reset} ${message}`, ...args);
    }
  }

  static adminFeed(message, ...args) {
    if (currentLogLevel >= LOG_LEVELS.INFO) {
      console.log(`${colors.magenta}[ADMINFEED]${colors.reset} ${message}`, ...args);
    }
  }

  // Quiet mode for very verbose logs
  static quiet(message, ...args) {
    // Only show in DEBUG mode
    if (currentLogLevel >= LOG_LEVELS.DEBUG) {
      console.log(`${colors.white}[QUIET]${colors.reset} ${message}`, ...args);
    }
  }
}

module.exports = Logger; 