package com.zeusmob.app.service;

import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import com.zeusmob.app.MainActivity;
import com.zeusmob.app.R;
import com.zeusmob.app.ZeusMobApp;

public class ZeusForegroundService extends Service {

    private static final int NOTIF_ID = 1001;
    private PowerManager.WakeLock wakeLock;

    @Override
    public void onCreate() {
        super.onCreate();
        acquireWakeLock();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification());
        // PREVENIR PARADAS: reinicia automaticamente se morrer
        return START_STICKY;
    }

    // ── Wake Lock (Prevenir Modo Sono) ─────────────────────────
    private void acquireWakeLock() {
        PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "ZeusMob::WakeLock"
            );
            wakeLock.acquire();
        }
    }

    private Notification buildNotification() {
        Intent notifIntent = new Intent(this, MainActivity.class);
        PendingIntent pi = PendingIntent.getActivity(this, 0, notifIntent,
            PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);

        return new NotificationCompat.Builder(this, ZeusMobApp.CHANNEL_ID_FOREGROUND)
            .setContentTitle("ZEUS MOB")
            .setContentText("Serviço ativo")
            .setSmallIcon(R.drawable.ic_zeus_notif)
            .setContentIntent(pi)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build();
    }

    @Override
    public void onDestroy() {
        if (wakeLock != null && wakeLock.isHeld()) wakeLock.release();
        // Reiniciar o serviço ao ser encerrado
        Intent restart = new Intent(getApplicationContext(), ZeusForegroundService.class);
        startService(restart);
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) { return null; }
}
