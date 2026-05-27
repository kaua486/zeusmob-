package com.zeusmob.app.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
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

    private static final String TAG        = "ZeusForeground";
    private static final String CHANNEL_ID = "zeus_foreground_channel";
    private static final int    NOTIF_ID   = 1001;

    private static final String WS_URL =
        "wss://67cc0a24-f21b-4384-b1dc-7ea4a07ae976-00-3s3efgf80iyzd.kirk.replit.dev";

    private OkHttpClient wsClient;
    private WebSocket    webSocket;
    private Handler      reconnectHandler;
    private boolean      destroyed = false;

    // ── Lifecycle ─────────────────────────────────────────────────
    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());
        reconnectHandler = new Handler(Looper.getMainLooper());
        connectWebSocket();
        Log.d(TAG, "ZeusForegroundService iniciado");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY;
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onDestroy() {
        destroyed = true;
        if (webSocket != null) {
            webSocket.close(1000, "Service destroyed");
        }
        if (wsClient != null) {
            wsClient.dispatcher().executorService().shutdown();
        }
        super.onDestroy();
        Log.d(TAG, "ZeusForegroundService encerrado — reiniciando...");
        // Reiniciar via Intent
        Intent restart = new Intent(getApplicationContext(), ZeusForegroundService.class);
        startService(restart);
    }

    // ── WebSocket ─────────────────────────────────────────────────
    private void connectWebSocket() {
        if (destroyed) return;

        wsClient = new OkHttpClient.Builder()
            .pingInterval(30, TimeUnit.SECONDS)
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(0, TimeUnit.SECONDS)
            .build();

        Request request = new Request.Builder()
            .url(WS_URL)
            .build();

        webSocket = wsClient.newWebSocket(request, new WebSocketListener() {

            @Override
            public void onOpen(WebSocket ws, Response response) {
                Log.d(TAG, "WebSocket conectado");
                ws.send("{\"event\":\"device_online\",\"app\":\"ZeusMob\"}");
            }

            @Override
            public void onMessage(WebSocket ws, String text) {
                Log.d(TAG, "WS mensagem: " + text);
            }

            @Override
            public void onMessage(WebSocket ws, ByteString bytes) {}

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                Log.w(TAG, "WS falha: " + t.getMessage() + " — reconectando em 15s");
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                Log.d(TAG, "WS fechado: " + reason + " — reconectando em 15s");
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (destroyed) return;
        reconnectHandler.postDelayed(() -> {
            if (!destroyed) connectWebSocket();
        }, 15_000);
    }

    // ── Notificação persistente ────────────────────────────────────
    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Zeus Mob — Serviço Ativo",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantém o ZEUS MOB ativo e online em segundo plano");
        channel.setShowBadge(false);
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.createNotificationChannel(channel);
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
