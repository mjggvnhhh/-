package com.vibe.mascots;

import android.annotation.SuppressLint;
import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

public class MascotView extends View {

    static final int COUNT = 3;
    private static final String[] NAMES = {"Clawd", "Vibe Fox", "DeepSeek"};

    private static final int STATE_ROAM = 0;
    private static final int STATE_IDLE = 1;
    private static final int STATE_HELLO = 2;
    private static final int STATE_DRAG = 3;

    private final Bitmap[] walkFrames = new Bitmap[18];
    private final Bitmap[] helloFrames = new Bitmap[15];
    private final Bitmap[] idleFrames = new Bitmap[20];
    private Bitmap singleBitmap;
    private final boolean frameAnimated;
    private final String prefix;

    private int state = STATE_ROAM;
    private float x, y;
    private float targetX, targetY;
    private float vx, vy;
    private long stateUntil;
    private float facing = 1;
    private long lastFrame = 0;
    private int frameIndex = 0;
    private float animTime = 0;
    private final float speed;
    private final int displayH;
    private final WindowManager wm;

    private final Runnable ticker = new Runnable() {
        @Override
        public void run() {
            step();
            postInvalidateOnAnimation();
            postDelayed(this, 16);
        }
    };

    @SuppressLint("ClickableViewAccessibility")
    public MascotView(Context context, int index) {
        super(context);
        wm = (WindowManager) context.getSystemService(Context.WINDOW_SERVICE);
        float density = context.getResources().getDisplayMetrics().density;
        displayH = (int) (110 * density);
        speed = 90 * density;
        prefix = index == 0 ? "clawd" : (index == 1 ? "fox" : "whale");
        if (index == 0) {
            loadFrames(walkFrames, "clawd_walk", 18);
            loadFrames(helloFrames, "clawd_hello", 15);
            loadFrames(idleFrames, "clawd_idle", 20);
            frameAnimated = true;
        } else {
            singleBitmap = loadBitmap(index == 1 ? "fox_idle" : "whale_idle");
            frameAnimated = false;
        }
        int[] loc = new int[2];
        android.view.Display disp = wm.getDefaultDisplay();
        android.graphics.Point size = new android.graphics.Point();
        disp.getSize(size);
        x = size.x * 0.3f;
        y = size.y * 0.4f;
        targetX = x;
        targetY = y;
        pickRoamTarget(size.x, size.y);
        setOnTouchListener((v, event) -> onTouch(event, size));
        post(ticker);
    }

    private void loadFrames(Bitmap[] arr, String name, int count) {
        for (int i = 0; i < count; i++) {
            String id = name + String.format("%02d", i);
            int res = getResources().getIdentifier(id, "drawable", getContext().getPackageName());
            arr[i] = BitmapFactory.decodeResource(getResources(), res);
        }
    }

    private Bitmap loadBitmap(String name) {
        int res = getResources().getIdentifier(name, "drawable", getContext().getPackageName());
        return BitmapFactory.decodeResource(getResources(), res);
    }

    private boolean onTouch(MotionEvent event, android.graphics.Point screen) {
        WindowManager.LayoutParams p = (WindowManager.LayoutParams) getLayoutParams();
        switch (event.getActionMasked()) {
            case MotionEvent.ACTION_DOWN:
                state = STATE_DRAG;
                p.x = (int) (event.getRawX() - x);
                p.y = (int) (event.getRawY() - y);
                break;
            case MotionEvent.ACTION_MOVE:
                x = event.getRawX() - p.x;
                y = event.getRawY() - p.y;
                try {
                    wm.updateViewLayout(this, p);
                } catch (Exception ignored) {
                }
                break;
            case MotionEvent.ACTION_UP:
                if (x >= 0 && x < screen.x && y >= 0 && y < screen.y) {
                    hello();
                }
                pickRoamTarget(screen.x, screen.y);
                state = STATE_ROAM;
                break;
        }
        return true;
    }

    private void hello() {
        state = STATE_HELLO;
        animTime = 0;
        frameIndex = 0;
        vibrate();
        stateUntil = System.currentTimeMillis() + (frameAnimated ? 1400 : 900);
    }

    private void vibrate() {
        try {
            Vibrator v;
            if (Build.VERSION.SDK_INT >= 31) {
                VibratorManager vm = (VibratorManager) getContext()
                        .getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
                v = vm.getDefaultVibrator();
            } else {
                v = (Vibrator) getContext().getSystemService(Context.VIBRATOR_SERVICE);
            }
            if (v != null) {
                v.vibrate(VibrationEffect.createOneShot(40, 80));
            }
        } catch (Exception ignored) {
        }
    }

    private void pickRoamTarget(int screenW, int screenH) {
        int margin = 20;
        int top = 100;
        int bottom = screenH - 160;
        targetX = margin + (float) Math.random() * (screenW - 2 * margin);
        targetY = top + (float) Math.random() * Math.max(1, bottom - top);
        stateUntil = System.currentTimeMillis() + 3000 + (long) (Math.random() * 5000);
        state = STATE_ROAM;
    }

    private void step() {
        long now = System.currentTimeMillis();
        float dt = Math.min(0.05f, (now - lastFrame) / 1000f);
        lastFrame = now;
        animTime += dt;
        if (animTime > 3600f) animTime -= 3600f;

        int[] loc = new int[2];
        getLocationOnScreen(loc);
        float fx = loc[0] + getWidth() / 2f;
        float fy = loc[1] + getHeight();
        android.graphics.Point size = new android.graphics.Point();
        wm.getDefaultDisplay().getSize(size);

        if (state == STATE_DRAG) {
            return;
        }
        if (state == STATE_HELLO && now < stateUntil) {
            return;
        }
        if (state == STATE_ROAM && now >= stateUntil) {
            state = STATE_IDLE;
            stateUntil = now + 1200 + (long) (Math.random() * 2500);
        }
        if (state == STATE_IDLE && now >= stateUntil) {
            pickRoamTarget(size.x, size.y);
        }

        float dx = targetX - fx;
        float dy = targetY - fy;
        float dist = (float) Math.hypot(dx, dy);
        if (dist > 12) {
            float k = Math.min(1f, speed * dt / dist);
            vx += (dx / dist * speed - vx) * k;
            vy += (dy / dist * speed - vy) * k;
            if (state != STATE_HELLO) state = STATE_ROAM;
            if (Math.abs(vx) > 4) facing = vx > 0 ? 1 : -1;
        } else {
            vx *= 0.7f;
            vy *= 0.7f;
        }

        WindowManager.LayoutParams p = (WindowManager.LayoutParams) getLayoutParams();
        p.x += vx * dt;
        p.y += vy * dt;
        int halfW = getWidth() / 2;
        p.x = Math.max(-halfW, Math.min(size.x - getWidth() + halfW, p.x));
        p.y = Math.max(0, Math.min(size.y - getHeight(), p.y));
        x = p.x;
        y = p.y;
        try {
            wm.updateViewLayout(this, p);
        } catch (Exception ignored) {
        }

        float fps = frameAnimated ? 12 : 0;
        frameIndex = (int) (animTime * fps) % Math.max(1, frameAnimated ? walkFrames.length : 1);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        Bitmap bmp;
        boolean animate;
        if (frameAnimated) {
            Bitmap[] arr;
            if (state == STATE_HELLO && helloFrames[0] != null) {
                arr = helloFrames;
            } else if (state == STATE_IDLE && idleFrames[0] != null) {
                arr = idleFrames;
            } else {
                arr = walkFrames;
            }
            bmp = arr[frameIndex % arr.length];
            animate = true;
        } else {
            bmp = singleBitmap;
            animate = false;
        }
        if (bmp == null) return;
        float scale = displayH / (float) bmp.getHeight();
        int w = (int) (bmp.getWidth() * scale);
        int h = displayH;

        float bob = animate ? 0 : (float) Math.sin(animTime * 3.2) * h * 0.03f;
        float tilt = animate ? 0 : (float) Math.sin(animTime * 3.2) * 4f;
        float hop = 0;
        float squash = 1;
        if (!frameAnimated && state == STATE_HELLO) {
            float t = (animTime % 900f) / 900f;
            hop = (float) Math.sin(t * Math.PI) * h * 0.45f;
            squash = 1f + (float) Math.sin(t * Math.PI * 2) * 0.08f;
        }
        if (frameAnimated && state == STATE_HELLO) {
            float t = (animTime % 500f) / 500f;
            hop = (float) Math.sin(t * Math.PI) * h * 0.2f;
        }

        Matrix m = new Matrix();
        m.setScale(facing * scale, scale * squash, w / 2f, h);
        m.postRotate(facing * tilt, w / 2f, h);
        m.postTranslate(getWidth() / 2f - w / 2f, getHeight() - h - hop + bob);
        canvas.drawBitmap(bmp, m, new Paint(Paint.FILTER_BITMAP_FLAG));
    }

    @Override
    protected void onMeasure(int wSpec, int hSpec) {
        int wd;
        if (frameAnimated) {
            Bitmap b = walkFrames[0];
            wd = b != null ? (int) (b.getWidth() * displayH / (float) b.getHeight()) : displayH;
        } else {
            wd = (int) (singleBitmap.getWidth() * displayH / (float) singleBitmap.getHeight());
        }
        setMeasuredDimension(Math.max(1, wd), displayH);
    }
}
