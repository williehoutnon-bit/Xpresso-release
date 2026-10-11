package com.xpresso.app;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

@CapacitorPlugin(name = "CrashReporter")
public class CrashReporterPlugin extends Plugin {

    @PluginMethod
    public void getCrashLogs(PluginCall call) {
        JSObject ret = new JSObject();
        Context ctx = getContext();

        // 1. Read latest Java/Kotlin uncaught exception crash report if exists
        String crashContent = readFile(new File(ctx.getFilesDir(), XpressoApplication.CRASH_FILE_NAME));
        ret.put("uncaughtCrash", crashContent);

        // 2. Read latest historical exit reasons
        String exitContent = readFile(new File(ctx.getFilesDir(), "latest_exit_reason.txt"));
        
        // Also query live in case it wasn't saved yet
        if (exitContent.isEmpty() && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                ActivityManager am = (ActivityManager) ctx.getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    List<android.app.ApplicationExitInfo> exitList = am.getHistoricalProcessExitReasons(ctx.getPackageName(), 0, 3);
                    if (exitList != null && !exitList.isEmpty()) {
                        StringBuilder sb = new StringBuilder();
                        for (android.app.ApplicationExitInfo info : exitList) {
                            String reasonName;
                            switch (info.getReason()) {
                                case android.app.ApplicationExitInfo.REASON_CRASH: reasonName = "CRASH (Java Exception)"; break;
                                case android.app.ApplicationExitInfo.REASON_CRASH_NATIVE: reasonName = "CRASH_NATIVE (Signal/C++)"; break;
                                case android.app.ApplicationExitInfo.REASON_ANR: reasonName = "ANR (Application Not Responding)"; break;
                                case android.app.ApplicationExitInfo.REASON_LOW_MEMORY: reasonName = "LOW_MEMORY (System LMK)"; break;
                                case android.app.ApplicationExitInfo.REASON_USER_REQUESTED: reasonName = "USER_REQUESTED"; break;
                                case android.app.ApplicationExitInfo.REASON_USER_STOPPED: reasonName = "USER_STOPPED"; break;
                                case android.app.ApplicationExitInfo.REASON_INITIALIZATION_FAILURE: reasonName = "INITIALIZATION_FAILURE"; break;
                                case android.app.ApplicationExitInfo.REASON_PERMISSION_CHANGE: reasonName = "PERMISSION_CHANGE"; break;
                                case android.app.ApplicationExitInfo.REASON_EXCESSIVE_RESOURCE_USAGE: reasonName = "EXCESSIVE_RESOURCE_USAGE"; break;
                                default: reasonName = "REASON_CODE_" + info.getReason(); break;
                            }
                            String dateStr = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date(info.getTimestamp()));
                            sb.append("Exit Time: ").append(dateStr)
                              .append(" | PID: ").append(info.getPid())
                              .append(" | Reason: ").append(reasonName)
                              .append(" | Status: ").append(info.getStatus())
                              .append(" | Description: ").append(info.getDescription())
                              .append("\n");
                        }
                        exitContent = sb.toString();
                    }
                }
            } catch (Throwable t) {
                // ignore
            }
        }
        ret.put("historicalExitReasons", exitContent);

        boolean hasCrash = !crashContent.isEmpty() || (exitContent.contains("CRASH") || exitContent.contains("ANR"));
        ret.put("hasCrash", hasCrash);

        if (hasCrash) {
            XpressoApplication.copyCrashLogToClipboardAndDownloads(ctx);
        }

        call.resolve(ret);
    }

    @PluginMethod
    public void clearCrashLogs(PluginCall call) {
        Context ctx = getContext();
        File f1 = new File(ctx.getFilesDir(), XpressoApplication.CRASH_FILE_NAME);
        if (f1.exists()) f1.delete();

        File f2 = new File(ctx.getFilesDir(), "latest_exit_reason.txt");
        if (f2.exists()) f2.delete();

        File extDir = ctx.getExternalFilesDir(null);
        if (extDir != null) {
            File ext1 = new File(extDir, XpressoApplication.CRASH_FILE_NAME);
            if (ext1.exists()) ext1.delete();
            File ext2 = new File(extDir, "latest_exit_reason.txt");
            if (ext2.exists()) ext2.delete();
        }

        JSObject ret = new JSObject();
        ret.put("cleared", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void shareCrashLog(PluginCall call) {
        String logText = call.getString("logText", "");
        if (logText.isEmpty()) {
            call.reject("logText is empty");
            return;
        }

        try {
            Intent sendIntent = new Intent();
            sendIntent.setAction(Intent.ACTION_SEND);
            sendIntent.putExtra(Intent.EXTRA_TEXT, logText);
            sendIntent.putExtra(Intent.EXTRA_TITLE, "Xpresso Crash Log");
            sendIntent.setType("text/plain");

            Intent shareIntent = Intent.createChooser(sendIntent, "Share Xpresso Crash Report");
            shareIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(shareIntent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Failed to share crash log", e);
        }
    }

    private String readFile(File file) {
        if (!file.exists()) return "";
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(file), "UTF-8"))) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line).append("\n");
            }
        } catch (Throwable t) {
            return "";
        }
        return sb.toString();
    }
}
