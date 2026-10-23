package com.xpresso.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInstaller;
import android.os.Build;

/**
 * Receives the result of a PackageInstaller session started by XpressoUpdaterPlugin.
 *
 * STATUS_PENDING_USER_ACTION carries the system "Install / Update" screen as EXTRA_INTENT; it has to
 * be launched from here. Everything else is forwarded to JS as an "installStatus" event.
 * On STATUS_SUCCESS Android restarts the app with the new version, so JS may never see that event.
 */
public class UpdateInstallReceiver extends BroadcastReceiver {

    @Override
    @SuppressWarnings("deprecation")
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        int status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE);
        String message = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE);

        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            Intent confirm;
            if (Build.VERSION.SDK_INT >= 33) {
                confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT, Intent.class);
            } else {
                confirm = intent.getParcelableExtra(Intent.EXTRA_INTENT);
            }
            if (confirm != null) {
                confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    context.startActivity(confirm);
                } catch (Throwable t) {
                    XpressoUpdaterPlugin.emitInstallStatus(PackageInstaller.STATUS_FAILURE,
                            "Could not open the install screen: " + t.getMessage());
                    return;
                }
            }
        }

        XpressoUpdaterPlugin.emitInstallStatus(status, message);
    }
}
