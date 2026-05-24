package com.zeusmob.app.receiver;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

public class ZeusDeviceAdminReceiver extends DeviceAdminReceiver {
    private static final String TAG = "ZeusDeviceAdmin";

    @Override
    public void onEnabled(Context context, Intent intent) {
        Log.d(TAG, "Device Admin ativado — exclusão protegida");
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        return "O ZEUS MOB não pode ser removido sem autorização.";
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        Log.d(TAG, "Device Admin desativado");
    }
}
