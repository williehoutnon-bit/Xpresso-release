package com.xpresso.app;

import android.os.Bundle;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(CrashReporterPlugin.class);
        super.onCreate(savedInstanceState);

        // Immediately auto-copy any previous crash log and save to public Downloads
        XpressoApplication.copyCrashLogToClipboardAndDownloads(this);

        // Defensively initialize FirebaseApp with fallback before plugins execute
        XpressoApplication.initializeFirebaseSafely(this);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Also auto-copy on resume in case a crash was recorded while minimized
        XpressoApplication.copyCrashLogToClipboardAndDownloads(this);
    }
}

