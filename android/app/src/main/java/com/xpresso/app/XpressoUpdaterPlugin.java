package com.xpresso.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.security.MessageDigest;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * In-app APK updater for beta builds distributed outside Google Play.
 *
 * Flow (driven from JS, see src/services/nativeUpdateService.ts):
 *   canInstall()          -> is "install unknown apps" allowed for Xpresso?
 *   openInstallSettings() -> opens the system toggle for it (one-time)
 *   download({url,sha256})-> streams the APK into the app cache, verifies SHA-256
 *   install()             -> hands the file to PackageInstaller
 *
 * Android itself refuses to replace the app unless the new APK has the SAME signing key and a
 * HIGHER versionCode, so a wrong or tampered file can never overwrite the installed app.
 * Install results arrive asynchronously through UpdateInstallReceiver -> "installStatus" event.
 *
 * Registered in MainActivity before super.onCreate(), like XpressoClipboardPlugin.
 */
@CapacitorPlugin(name = "XpressoUpdater")
public class XpressoUpdaterPlugin extends Plugin {

    static final String ACTION_INSTALL_STATUS = "com.xpresso.app.INSTALL_STATUS";

    private static volatile XpressoUpdaterPlugin active;

    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);

    @Override
    public void load() {
        active = this;
        // A leftover file means a previous update was cancelled or already applied; never keep it.
        File f = apkFile();
        if (f.exists()) {
            //noinspection ResultOfMethodCallIgnored
            f.delete();
        }
    }

    @Override
    protected void handleOnDestroy() {
        if (active == this) active = null;
        io.shutdownNow();
    }

    private File updatesDir() {
        File dir = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        dir.mkdirs();
        return dir;
    }

    private File apkFile() {
        return new File(updatesDir(), "xpresso-update.apk");
    }

    private boolean canRequestInstalls() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;
        return getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("value", canRequestInstalls());
        call.resolve(ret);
    }

    @PluginMethod
    public void openInstallSettings(PluginCall call) {
        try {
            Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getContext().getPackageName()));
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Throwable t) {
            call.reject("Could not open install settings: " + t.getMessage());
        }
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String urlStr = call.getString("url");
        final String expectedSha = call.getString("sha256");
        if (urlStr == null || !urlStr.startsWith("https://")) {
            call.reject("An https url is required");
            return;
        }
        if (!busy.compareAndSet(false, true)) {
            call.reject("An update download is already running");
            return;
        }

        io.execute(() -> {
            File part = new File(updatesDir(), "xpresso-update.apk.part");
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) URI.create(urlStr).toURL().openConnection();
                conn.setConnectTimeout(15_000);
                conn.setReadTimeout(30_000);
                conn.setInstanceFollowRedirects(true);
                int code = conn.getResponseCode();
                if (code != HttpURLConnection.HTTP_OK) {
                    call.reject("Download failed: HTTP " + code);
                    return;
                }

                final long total = conn.getContentLengthLong();
                MessageDigest sha = MessageDigest.getInstance("SHA-256");
                long done = 0;
                int lastPercent = -1;

                try (InputStream in = conn.getInputStream();
                     FileOutputStream out = new FileOutputStream(part)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        sha.update(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject ev = new JSObject();
                                ev.put("percent", percent);
                                notifyListeners("downloadProgress", ev);
                            }
                        }
                    }
                    out.getFD().sync();
                }

                String actual = hex(sha.digest());
                if (expectedSha != null && !expectedSha.isEmpty()
                        && !expectedSha.toLowerCase(Locale.ROOT).equals(actual)) {
                    //noinspection ResultOfMethodCallIgnored
                    part.delete();
                    call.reject("Checksum mismatch; the downloaded file was discarded");
                    return;
                }

                File target = apkFile();
                if (target.exists() && !target.delete()) {
                    call.reject("Could not replace the previous update file");
                    return;
                }
                if (!part.renameTo(target)) {
                    call.reject("Could not store the downloaded update");
                    return;
                }

                JSObject ret = new JSObject();
                ret.put("bytes", done);
                ret.put("sha256", actual);
                call.resolve(ret);
            } catch (Throwable t) {
                //noinspection ResultOfMethodCallIgnored
                part.delete();
                call.reject("Download failed: " + t.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
                busy.set(false);
            }
        });
    }

    @PluginMethod
    public void install(final PluginCall call) {
        final File apk = apkFile();
        if (!apk.exists()) {
            call.reject("No downloaded update to install");
            return;
        }
        if (!canRequestInstalls()) {
            call.reject("Installing from this app is not allowed yet");
            return;
        }

        io.execute(() -> {
            Context ctx = getContext();
            PackageInstaller installer = ctx.getPackageManager().getPackageInstaller();
            PackageInstaller.SessionParams params =
                    new PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL);
            params.setAppPackageName(ctx.getPackageName());
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Lets Android skip the confirmation screen when it is allowed to (Android 12+,
                // updating an app this app installed). Otherwise the system still asks once.
                params.setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED);
            }

            int sessionId = -1;
            PackageInstaller.Session session = null;
            try {
                sessionId = installer.createSession(params);
                session = installer.openSession(sessionId);

                try (InputStream in = new FileInputStream(apk);
                     OutputStream out = session.openWrite("xpresso.apk", 0, apk.length())) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                    session.fsync(out);
                }

                Intent statusIntent = new Intent(ctx, UpdateInstallReceiver.class)
                        .setAction(ACTION_INSTALL_STATUS)
                        .setPackage(ctx.getPackageName());
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                    // PackageInstaller must be able to add the status extras to this intent.
                    flags |= PendingIntent.FLAG_MUTABLE;
                }
                PendingIntent pending = PendingIntent.getBroadcast(ctx, sessionId, statusIntent, flags);

                session.commit(pending.getIntentSender());
                call.resolve();
            } catch (Throwable t) {
                if (session != null && sessionId != -1) {
                    try { installer.abandonSession(sessionId); } catch (Throwable ignored) { /* already gone */ }
                }
                call.reject("Install failed: " + t.getMessage());
            } finally {
                if (session != null) session.close();
            }
        });
    }

    /** Called by UpdateInstallReceiver with the PackageInstaller result. */
    static void emitInstallStatus(int status, String message) {
        XpressoUpdaterPlugin plugin = active;
        if (plugin == null) return;
        JSObject ev = new JSObject();
        ev.put("status", statusName(status));
        ev.put("message", message == null ? "" : message);
        plugin.notifyListeners("installStatus", ev);
    }

    private static String statusName(int status) {
        switch (status) {
            case PackageInstaller.STATUS_SUCCESS: return "success";
            case PackageInstaller.STATUS_PENDING_USER_ACTION: return "pending-user-action";
            case PackageInstaller.STATUS_FAILURE_ABORTED: return "aborted";
            case PackageInstaller.STATUS_FAILURE_CONFLICT: return "conflict";
            case PackageInstaller.STATUS_FAILURE_INCOMPATIBLE: return "incompatible";
            case PackageInstaller.STATUS_FAILURE_INVALID: return "invalid";
            case PackageInstaller.STATUS_FAILURE_STORAGE: return "storage";
            case PackageInstaller.STATUS_FAILURE_BLOCKED: return "blocked";
            default: return "failure";
        }
    }

    private static String hex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(bytes.length * 2);
        for (byte b : bytes) sb.append(String.format(Locale.ROOT, "%02x", b));
        return sb.toString();
    }
}
