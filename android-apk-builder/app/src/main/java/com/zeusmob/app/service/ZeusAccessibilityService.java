package com.zeusmob.app.service;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

public class ZeusAccessibilityService extends AccessibilityService {

    private static final String TAG = "ZeusAccessibility";

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                   | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                   | AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
        Log.d(TAG, "ZeusAccessibilityService conectado");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        int type = event.getEventType();

        // Registro de bloqueio de tela
        if (type == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkg = event.getPackageName();
            if (pkg != null) {
                Log.d(TAG, "Janela ativa: " + pkg);
            }
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "ZeusAccessibilityService interrompido");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        // Tentar reconectar automaticamente
        return true;
    }
}
