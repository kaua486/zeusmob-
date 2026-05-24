package com.zeusmob.app;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.multidex.MultiDex;
import android.content.Context;

public class ZeusMobApp extends Application {

    public static final String CHANNEL_ID_FOREGROUND = "zeus_foreground";
    public static final String CHANNEL_ID_ALERTS     = "zeus_alerts";

    @Override
    protected void attachBaseContext(Context base) {
        super.attachBaseContext(base);
        MultiDex.install(this);
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);

            NotificationChannel foreground = new NotificationChannel(
                CHANNEL_ID_FOREGROUND,
                "Zeus Serviço",
                NotificationManager.IMPORTANCE_LOW
            );
            foreground.setDescription("Serviço em execução em segundo plano");

            NotificationChannel alerts = new NotificationChannel(
                CHANNEL_ID_ALERTS,
                "Zeus Alertas",
                NotificationManager.IMPORTANCE_HIGH
            );
            alerts.setDescription("Notificações e alertas do ZEUS MOB");

            nm.createNotificationChannel(foreground);
            nm.createNotificationChannel(alerts);
        }
    }
}
