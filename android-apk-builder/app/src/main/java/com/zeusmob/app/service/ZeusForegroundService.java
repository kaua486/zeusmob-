package com.zeusmob.app.service;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import com.zeusmob.app.R;

public class ZeusForegroundService extends Service {

    private static final String TAG        = "ZeusForeground";
    private static final String CHANNEL_ID = "zeus_foreground_channel";
    private static final int    NOTIF_ID   = 1001;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        startForeground(NOTIF_ID, buildNotification());
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
        super.onDestroy();
        Log.d(TAG, "ZeusForegroundService encerrado — reiniciando...");
        Intent restart = new Intent(getApplicationContext(), ZeusForegroundService.class);
        startService(restart);
    }

    private void createNotificationChannel() {
        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Zeus Mob Service",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Mantém o ZEUS MOB ativo em segundo plano");
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) {
            nm.createNotificationChannel(channel);
        }
    }

    private Notification buildNotification() {
        return new NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("ZEUS MOB")
            .setContentText("Serviço ativo")
            .setSmallIcon(R.drawable.ic_zeus_notif)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .build();
    }
}
