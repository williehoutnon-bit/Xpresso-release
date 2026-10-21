package com.xpresso.app;

import android.app.ActivityManager;
import android.app.Application;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.ContentValues;
import android.content.Context;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.Log;
import android.widget.Toast;

import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class XpressoApplication extends Application {
    private static final String TAG = "XpressoApplication";
    public static final String CRASH_FILE_NAME = "latest_crash.txt";

    @Override
    public void onCreate() {
        super.onCreate();

        // 1. Install Global UncaughtExceptionHandler at Application level
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            try {
                saveCrashReport(thread, throwable);
            } catch (Throwable t) {
                Log.e(TAG, "Failed writing crash report", t);
            } finally {
                if (defaultHandler != null) {
                    defaultHandler.uncaughtException(thread, throwable);
                }
            }
        });

        // 2. Query ApplicationExitInfo API (Android 11 / API 30+) to inspect previous process termination
        checkHistoricalExitReasons();

        // 3. Immediately copy any detected crash log / exit reason to clipboard and public Downloads folder
        copyCrashLogToClipboardAndDownloads(this);

        // 4. Defensively initialize FirebaseApp with programmatic options fallback before any plugin runs
        initializeFirebaseSafely(this);
    }

    private void saveCrashReport(Thread thread, Throwable throwable) {
        try {
            File crashFile = new File(getFilesDir(), CRASH_FILE_NAME);
            StringWriter sw = new StringWriter();
            PrintWriter pw = new PrintWriter(sw);

            String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(new Date());
            pw.println("=== XPRESSO NATIVE CRASH REPORT ===");
            pw.println("Timestamp: " + timestamp);
            pw.println("Thread: " + (thread != null ? thread.getName() + " (ID " + thread.getId() + ")" : "unknown"));
            pw.println("Android OS: " + Build.VERSION.RELEASE + " (SDK " + Build.VERSION.SDK_INT + ")");
            pw.println("Device: " + Build.MANUFACTURER + " " + Build.MODEL + " (" + Build.DEVICE + ")");
            pw.println("----------------------------------------");
            if (throwable != null) {
                throwable.printStackTrace(pw);
            } else {
                pw.println("No Throwable provided.");
            }
            pw.println("========================================");
            pw.flush();

            try (FileOutputStream fos = new FileOutputStream(crashFile)) {
                fos.write(sw.toString().getBytes("UTF-8"));
            }
            Log.e(TAG, "Crash report recorded to " + crashFile.getAbsolutePath() + ":\n" + sw.toString());

            // Clipboard crash reports are limited to debuggable builds because the clipboard is readable by other apps.
            try {
                if (!isDebuggable(this)) throw new IllegalStateException("release build");
                ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                if (cm != null) {
                    ClipData clip = ClipData.newPlainText("Xpresso Crash Report", sw.toString());
                    cm.setPrimaryClip(clip);
                }
            } catch (Throwable ignored) {}

            // Mirror to app-specific external files dir for easy file manager / USB access
            try {
                File extDir = getExternalFilesDir(null);
                if (extDir != null) {
                    File extCrashFile = new File(extDir, CRASH_FILE_NAME);
                    try (FileOutputStream extFos = new FileOutputStream(extCrashFile)) {
                        extFos.write(sw.toString().getBytes("UTF-8"));
                    }
                    Log.i(TAG, "Mirrored crash report to external storage: " + extCrashFile.getAbsolutePath());
                }
            } catch (Throwable extErr) {
                Log.w(TAG, "Could not mirror crash report to external files dir", extErr);
            }
        } catch (Throwable e) {
            Log.e(TAG, "Failed to persist crash report", e);
        }
    }

    private void checkHistoricalExitReasons() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            try {
                ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
                if (am != null) {
                    List<android.app.ApplicationExitInfo> exitList = am.getHistoricalProcessExitReasons(getPackageName(), 0, 3);
                    if (exitList != null && !exitList.isEmpty()) {
                        StringBuilder sb = new StringBuilder();
                        sb.append("=== HISTORICAL PROCESS EXIT REASONS (API 30+) ===\n");
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

                            // If trace stream exists (e.g. for ANR or Native Crash)
                            try (InputStream is = info.getTraceInputStream()) {
                                if (is != null) {
                                    sb.append("--- TRACE BEGIN ---\n");
                                    BufferedReader reader = new BufferedReader(new InputStreamReader(is));
                                    String line;
                                    int lineCount = 0;
                                    while ((line = reader.readLine()) != null && lineCount < 200) {
                                        sb.append(line).append("\n");
                                        lineCount++;
                                    }
                                    sb.append("--- TRACE END ---\n");
                                }
                            } catch (Throwable t) {
                                // Ignore trace stream errors
                            }
                            sb.append("--------------------------------------------------\n");
                        }
                        
                        File exitFile = new File(getFilesDir(), "latest_exit_reason.txt");
                        try (FileOutputStream fos = new FileOutputStream(exitFile)) {
                            fos.write(sb.toString().getBytes("UTF-8"));
                        }
                        try {
                            File extDir = getExternalFilesDir(null);
                            if (extDir != null) {
                                File extExitFile = new File(extDir, "latest_exit_reason.txt");
                                try (FileOutputStream extFos = new FileOutputStream(extExitFile)) {
                                    extFos.write(sb.toString().getBytes("UTF-8"));
                                }
                            }
                        } catch (Throwable extErr) {
                            Log.w(TAG, "Could not mirror exit reason to external files dir", extErr);
                        }
                        Log.i(TAG, sb.toString());
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "Failed reading historical exit reasons", t);
            }
        }
    }

    static boolean isDebuggable(Context context) {
        return context != null && (context.getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    public static void copyCrashLogToClipboardAndDownloads(Context context) {
        if (context == null || !isDebuggable(context)) return;
        try {
            File f1 = new File(context.getFilesDir(), CRASH_FILE_NAME);
            File f2 = new File(context.getFilesDir(), "latest_exit_reason.txt");
            StringBuilder sb = new StringBuilder();

            if (f1.exists() && f1.length() > 0) {
                try (FileInputStream fis = new FileInputStream(f1);
                     BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                } catch (Throwable ignored) {}
            }

            if (f2.exists() && f2.length() > 0) {
                if (sb.length() > 0) sb.append("\n\n");
                try (FileInputStream fis = new FileInputStream(f2);
                     BufferedReader reader = new BufferedReader(new InputStreamReader(fis, StandardCharsets.UTF_8))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line).append("\n");
                    }
                } catch (Throwable ignored) {}
            }

            String fullReport = sb.toString().trim();
            if (fullReport.isEmpty()) return;

            // 1. Copy to Android System Clipboard
            new Handler(Looper.getMainLooper()).post(() -> {
                try {
                    ClipboardManager cm = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                    if (cm != null) {
                        ClipData clip = ClipData.newPlainText("Xpresso Crash Report", fullReport);
                        cm.setPrimaryClip(clip);
                        Toast.makeText(context, "⚠️ Crash log copied to clipboard!", Toast.LENGTH_LONG).show();
                        Log.i(TAG, "Crash log successfully copied to Android system clipboard");
                    }
                } catch (Throwable t) {
                    Log.w(TAG, "Failed setting primary clip", t);
                }
            });

            // 2. Write to public Downloads folder so user can open in My Files without Scoped Storage restrictions
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues values = new ContentValues();
                    values.put(MediaStore.MediaColumns.DISPLAY_NAME, "xpresso_crash_log.txt");
                    values.put(MediaStore.MediaColumns.MIME_TYPE, "text/plain");
                    values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);

                    Uri uri = context.getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                    if (uri != null) {
                        try (OutputStream os = context.getContentResolver().openOutputStream(uri)) {
                            if (os != null) {
                                os.write(fullReport.getBytes(StandardCharsets.UTF_8));
                                os.flush();
                                Log.i(TAG, "Mirrored crash log to MediaStore Downloads: xpresso_crash_log.txt");
                            }
                        }
                    }
                } else {
                    File downloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
                    if (downloads != null) {
                        if (!downloads.exists()) downloads.mkdirs();
                        File dest = new File(downloads, "xpresso_crash_log.txt");
                        try (FileOutputStream fos = new FileOutputStream(dest)) {
                            fos.write(fullReport.getBytes(StandardCharsets.UTF_8));
                            fos.flush();
                            Log.i(TAG, "Mirrored crash log to Downloads file: " + dest.getAbsolutePath());
                        }
                    }
                }
            } catch (Throwable t) {
                Log.w(TAG, "Failed writing crash log to Downloads", t);
            }
        } catch (Throwable t) {
            Log.w(TAG, "Failed copyCrashLogToClipboardAndDownloads", t);
        }
    }

    public static void initializeFirebaseSafely(Context context) {
        if (context == null) return;
        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                try {
                    FirebaseApp.initializeApp(context);
                    Log.i(TAG, "FirebaseApp initialized via standard resources");
                } catch (Throwable t) {
                    Log.w(TAG, "Standard Firebase resource initialization failed: " + t.getMessage());
                }
            }
        } catch (Throwable ignored) {}

        try {
            if (FirebaseApp.getApps(context).isEmpty()) {
                FirebaseOptions options = new FirebaseOptions.Builder()
                        .setApplicationId("1:402509981366:android:39037421a743359d166817")
                        .setApiKey("AIzaSyCh1nimoHBX-h8gpLctrHU8Bz4tKLDJxUE")
                        .setProjectId("xpresso-5e681")
                        .setStorageBucket("xpresso-5e681.firebasestorage.app")
                        .setGcmSenderId("402509981366")
                        .build();
                FirebaseApp.initializeApp(context, options);
                Log.i(TAG, "FirebaseApp successfully initialized with explicit programmatic options");
            }
        } catch (Throwable t) {
            Log.e(TAG, "Failed initializing FirebaseApp with explicit options", t);
        }
    }
}
