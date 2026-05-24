package com.zeusmob.app.receiver;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class ScreenLockReceiver extends BroadcastReceiver {
    private static final String TAG = "ScreenLockReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        if (Intent.ACTION_SCREEN_OFF.equals(action)) {
            Log.d(TAG, "Tela bloqueada — registrado");
        } else if (Intent.ACTION_SCREEN_ON.equals(action)) {
            Log.d(TAG, "Tela ligada");
        } else if (Intent.ACTION_USER_PRESENT.equals(action)) {
            Log.d(TAG, "Usuário desbloqueou o dispositivo");
        }
    }
}
