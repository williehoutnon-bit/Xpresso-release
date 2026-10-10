package com.xpresso.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Safeguard against uncaught runtime exceptions from Firebase/ShortcutBadger/Push background threads
        final Thread.UncaughtExceptionHandler defaultHandler = Thread.getDefaultUncaughtExceptionHandler();
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            if (throwable != null) {
                String msg = throwable.getMessage() != null ? throwable.getMessage() : "";
                String str = throwable.toString();
                if (msg.contains("FirebaseApp") || str.contains("Firebase") || str.contains("ShortcutBadger") || str.contains("PushNotifications")) {
                    Log.e(TAG, "Suppressed non-fatal native notification exception: " + str, throwable);
                    return;
                }
            }
            if (defaultHandler != null) {
                defaultHandler.uncaughtException(thread, throwable);
            }
        });

        // Defensively initialize FirebaseApp if not already initialized
        try {
            if (FirebaseApp.getApps(this).isEmpty()) {
                FirebaseApp.initializeApp(this);
                Log.i(TAG, "FirebaseApp initialized successfully");
            }
        } catch (Throwable t) {
            Log.w(TAG, "FirebaseApp initialization handled non-fatally: " + t.getMessage());
        }
    }
}
