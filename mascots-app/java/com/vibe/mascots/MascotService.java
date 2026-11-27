package com.vibe.mascots;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.PixelFormat;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.view.Gravity;
import android.view.WindowManager;

public class MascotService extends Service {

    static final String ACTION_START = "com.vibe.mascots.START";
    static final String ACTION_STOP = "com.vibe.mascots.STOP";
    static final String ACTION_PREV = "com.vibe.mascots.PREV";
    static final String ACTION_NEXT = "com.vibe.mascots.NEXT";
    static volatile boolean running = false;

    private static final String CHANNEL = "mascots";
    private static final int NOTIF_ID = 42;

    private WindowManager wm;
    private MascotView view;
    private int mascotIndex;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent != null ? intent.getAction() : ACTION_START;
        if (ACTION_STOP.equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        SharedPreferences prefs = getSharedPreferences("mascots", MODE_PRIVATE);
        mascotIndex = prefs.getInt("index", 0);
        createChannel();
        startForeground(NOTIF_ID, buildNotification());
        if (ACTION_PREV.equals(action)) {
            mascotIndex = (mascotIndex + MascotView.COUNT - 1) % MascotView.COUNT;
        } else if (ACTION_NEXT.equals(action)) {
            mascotIndex = (mascotIndex + 1) % MascotView.COUNT;
        }
        prefs.edit().putInt("index", mascotIndex).apply();
        handler.post(() -> showMascot());
        updateNotification();
        return START_STICKY;
    }

    private void showMascot() {
        if (view != null) {
            wm.removeView(view);
            view = null;
        }
        wm = (WindowManager) getSystemService(WINDOW_SERVICE);
        view = new MascotView(this, mascotIndex);
        WindowManager.LayoutParams p = new WindowManager.LayoutParams(
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.WRAP_CONTENT,
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT);
        p.gravity = Gravity.TOP | Gravity.START;
        p.x = 40;
        p.y = 200;
        try {
            wm.addView(view, p);
            running = true;
        } catch (Exception e) {
            running = false;
            stopSelf();
        }
    }

    private void createChannel() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL,
                getString(R.string.app_name), NotificationManager.IMPORTANCE_LOW);
        ch.setShowBadge(false);
        nm.createNotificationChannel(ch);
    }

    private Notification buildNotification() {
        Intent prev = new Intent(this, MascotService.class).setAction(ACTION_PREV);
        Intent next = new Intent(this, MascotService.class).setAction(ACTION_NEXT);
        Intent stop = new Intent(this, MascotService.class).setAction(ACTION_STOP);
        Notification.Builder b = new Notification.Builder(this, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setContentTitle(getString(R.string.notif_title))
                .setContentText(getString(R.string.notif_text))
                .setOngoing(true)
                .addAction(0, getString(R.string.action_prev),
                        PendingIntent.getService(this, 1, prev,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .addAction(0, getString(R.string.action_next),
                        PendingIntent.getService(this, 2, next,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE))
                .addAction(0, getString(R.string.action_stop),
                        PendingIntent.getService(this, 3, stop,
                                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        Intent open = new Intent(this, MainActivity.class);
        b.setContentIntent(PendingIntent.getActivity(this, 4, open,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        return b.build();
    }

    private void updateNotification() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        nm.notify(NOTIF_ID, buildNotification());
    }

    @Override
    public void onDestroy() {
        running = false;
        handler.post(() -> {
            if (view != null && wm != null) {
                try {
                    wm.removeView(view);
                } catch (Exception ignored) {
                }
                view = null;
            }
        });
        super.onDestroy();
    }
}
