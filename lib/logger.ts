type LogContext = Record<string, string | number | boolean | null | undefined>;

type LogLevel = "info" | "warn" | "error";

const sensitiveKeyPattern = /(key|secret|token|password|authorization|cookie)/i;

function sanitizeContext(context: LogContext): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      sensitiveKeyPattern.test(key) ? "[REDACTED]" : value,
    ]),
  );
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  const entry = JSON.stringify({
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitizeContext(context),
  });

  if (level === "error") {
    console.error(entry);
    return;
  }

  if (level === "warn") {
    console.warn(entry);
    return;
  }

  console.info(entry);
}

export const logger = {
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, context?: LogContext) {
    write("error", message, context);
  },
};
