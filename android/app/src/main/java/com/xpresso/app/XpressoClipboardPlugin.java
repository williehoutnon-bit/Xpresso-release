package com.xpresso.app;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * System clipboard access for the math editor.
 *
 * write(): plain text + optional HTML in ONE ClipData, so other apps paste readable text while
 *          Xpresso can read the lossless math tree back out of the HTML part.
 * read():  returns the first clip item as { text, html } (html is "" when absent).
 *
 * Registered in MainActivity before super.onCreate(), same as CrashReporterPlugin.
 */
@CapacitorPlugin(name = "XpressoClipboard")
public class XpressoClipboardPlugin extends Plugin {

    private ClipboardManager manager() {
        return (ClipboardManager) getContext().getSystemService(Context.CLIPBOARD_SERVICE);
    }

    @PluginMethod
    public void write(final PluginCall call) {
        final String text = call.getString("text");
        if (text == null) {
            call.reject("text is required");
            return;
        }
        final String html = call.getString("html");

        if (getActivity() == null) {
            call.reject("Activity unavailable");
            return;
        }
        getActivity().runOnUiThread(() -> {
            try {
                ClipboardManager cm = manager();
                if (cm == null) {
                    call.reject("Clipboard service unavailable");
                    return;
                }
                ClipData clip = (html != null && !html.isEmpty())
                        ? ClipData.newHtmlText("Xpresso", text, html)
                        : ClipData.newPlainText("Xpresso", text);
                cm.setPrimaryClip(clip);
                call.resolve();
            } catch (Throwable t) {
                call.reject("Clipboard write failed: " + t.getMessage());
            }
        });
    }

    @PluginMethod
    public void read(final PluginCall call) {
        if (getActivity() == null) {
            JSObject empty = new JSObject();
            empty.put("text", "");
            empty.put("html", "");
            call.resolve(empty);
            return;
        }
        getActivity().runOnUiThread(() -> {
            String text = "";
            String html = "";
            try {
                ClipboardManager cm = manager();
                if (cm != null && cm.hasPrimaryClip()) {
                    ClipData clip = cm.getPrimaryClip();
                    if (clip != null && clip.getItemCount() > 0) {
                        ClipData.Item item = clip.getItemAt(0);
                        CharSequence cs = item.coerceToText(getContext());
                        if (cs != null) text = cs.toString();
                        String h = item.getHtmlText();
                        if (h != null) html = h;
                    }
                }
            } catch (Throwable ignored) {
                // Unreadable clipboard (e.g. restricted by the OS): resolve empty so JS can fall back.
            }
            JSObject ret = new JSObject();
            ret.put("text", text);
            ret.put("html", html);
            call.resolve(ret);
        });
    }
}
