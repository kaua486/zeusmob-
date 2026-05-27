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
import java.util.concurrent.TimeUnit;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;
import okio.ByteString;

public class ZeusForegroundService extends Service {

    private static final String TAG        = "ZEUS_DEBUG";
    private static final String CHANNEL_ID = "zeus_foreground_channel";
    private static final int    NOTIF_ID   = 1001;

    // WebSocket endpoint — wss:// obrigatório para HTTPS
    private static final String WS_BASE =
        "wss://67cc0a24-f21b-4384-b1dc-7ea4a07ae976-00-3s3efgf80iyzd.kirk.replit.dev/api/ws";

    private OkHttpClient wsClient;
    private WebSocket    webSocket;
    private Handler      reconnectHandler;
    private boolean      destroyed = false;
    private String       deviceId;

    // ── Lifecycle ─────────────────────────────────────────────────
    @Override
    public void onCreate() {
        super.onCreate();
        Log.d(TAG, "=== ZeusForegroundService.onCreate() — SERVIÇO INICIADO ===");

        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());
        reconnectHandler = new Handler(Looper.getMainLooper());

        // ID único e persistente do dispositivo
        deviceId = Settings.Secure.getString(getContentResolver(), Settings.Secure.ANDROID_ID);
        if (deviceId == null || deviceId.isEmpty()) deviceId = "device-" + System.currentTimeMillis();
        Log.d(TAG, "Device ID obtido: " + deviceId);

        connectWebSocket();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        Log.d(TAG, "onStartCommand — flags=" + flags + " startId=" + startId);
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        destroyed = true;
        Log.d(TAG, "onDestroy — reiniciando serviço automaticamente");
        if (webSocket != null) webSocket.close(1000, "Service destroyed");
        if (wsClient  != null) wsClient.dispatcher().executorService().shutdown();
        super.onDestroy();
        // Auto-restart
        startService(new Intent(getApplicationContext(), ZeusForegroundService.class));
    }

    // ── WebSocket ─────────────────────────────────────────────────
    private void connectWebSocket() {
        if (destroyed) return;

        // URL inclui role=device e deviceId para o servidor identificar este aparelho
        String wsUrl = WS_BASE + "?role=device&deviceId=" + deviceId;
        Log.d(TAG, "Tentando conectar ao WebSocket: " + wsUrl);

        wsClient = new OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build();

        Request request = new Request.Builder().url(wsUrl).build();

        webSocket = wsClient.newWebSocket(request, new WebSocketListener() {

            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "✅ WebSocket CONECTADO! HTTP " + response.code()
                    + " | URL: " + WS_BASE);

                // Enviar sinal de identificação ao servidor
                String json = "{"
                    + "\"event\":\"device_online\","
                    + "\"app\":\"ZeusMob\","
                    + "\"deviceId\":\"" + deviceId + "\""
                    + "}";
                boolean sent = ws.send(json);
                Log.d(TAG, "Sinal device_online enviado: " + sent
                    + " | payload: " + json);
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                Log.d(TAG, "WS mensagem recebida: " + text);
                if (text.contains("device_registered")) {
                    Log.d(TAG, "✅ Dispositivo REGISTADO com sucesso no servidor!");
                }
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {
                Log.d(TAG, "WS frame binário: " + bytes.size() + " bytes");
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                int code = (response != null) ? response.code() : -1;
                Log.w(TAG, "❌ WS FALHA — erro: " + t.getMessage()
                    + " | código: " + code
                    + " | Verifique se o URL usa wss:// e o servidor está online"
                    + " — reconectando em 15s");
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WS fechado — código: " + code + " | motivo: " + reason
                    + " — reconectando em 15s");
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (destroyed) return;
        reconnectHandler.postDelayed(() -> {
            if (!destroyed) {
                Log.d(TAG, "Reconectando ao WebSocket...");
                connectWebSocket();
            }
        }, 15_000);
    }

    // ── Notificação persistente ────────────────────────────────────
    private void createNotificationChannel() {
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID, "Zeus Mob — Serviço Ativo", NotificationManager.IMPORTANCE_LOW);
        ch.setDescription("Mantém o ZEUS MOB ativo e online em segundo plano");
        ch.setShowBadge(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ZEUS MOB")
            .setContentText("Serviço ativo — online")
            .setSmallIcon(R.drawable.ic_zeus_notif)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .build();
    }
}
