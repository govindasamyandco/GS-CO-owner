/**
 * Client Error Telemetry & Diagnostics Utility
 * Captures unhandled exceptions, audit logs, and performance metrics for Admin Portal.
 */

export class TelemetryLogger {
  constructor(serviceName = 'GS-CO-Owner') {
    this.serviceName = serviceName;
  }

  logInfo(message, context = {}) {
    console.info(`[${this.serviceName}] [INFO] ${new Date().toISOString()} - ${message}`, context);
  }

  logWarn(message, context = {}) {
    console.warn(`[${this.serviceName}] [WARN] ${new Date().toISOString()} - ${message}`, context);
  }

  logError(error, context = {}) {
    const errorPayload = {
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      message: error?.message || String(error),
      stack: error?.stack || null,
      context,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown'
    };

    console.error(`[${this.serviceName}] [ERROR]`, errorPayload);
  }

  measurePerformance(label, fn) {
    const start = performance.now();
    try {
      const result = fn();
      const duration = (performance.now() - start).toFixed(2);
      this.logInfo(`Perf [${label}]: ${duration}ms`);
      return result;
    } catch (err) {
      this.logError(err, { label });
      throw err;
    }
  }
}

export const logger = new TelemetryLogger('GS-CO-Owner');
