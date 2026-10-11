import { registerPlugin, Capacitor } from '@capacitor/core';

export interface CrashLogsResult {
  hasCrash: boolean;
  uncaughtCrash?: string;
  historicalExitReasons?: string;
}

export interface CrashReporterPluginInterface {
  getCrashLogs(): Promise<CrashLogsResult>;
  clearCrashLogs(): Promise<{ cleared: boolean }>;
  shareCrashLog(options: { logText: string }): Promise<void>;
}

export const CrashReporter = registerPlugin<CrashReporterPluginInterface>('CrashReporter');

export async function checkAndRetrieveCrashLog(): Promise<CrashLogsResult | null> {
  if (!Capacitor.isNativePlatform()) {
    return null;
  }
  try {
    const logs = await CrashReporter.getCrashLogs();
    if (logs && (logs.hasCrash || logs.uncaughtCrash || logs.historicalExitReasons)) {
      return logs;
    }
  } catch (err) {
    console.warn('[CrashReporter] Failed to read native crash logs:', err);
  }
  return null;
}
