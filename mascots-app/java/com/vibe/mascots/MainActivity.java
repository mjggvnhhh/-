package com.vibe.mascots;

import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

public class MainActivity extends Activity {

    private TextView status;
    private Button startBtn;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER);
        root.setPadding(48, 48, 48, 48);
        root.setBackgroundResource(android.R.color.background_dark);

        TextView title = new TextView(this);
        title.setText("AI Mascots");
        title.setTextSize(30);
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, 0, 0, 24);
        root.addView(title, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        status = new TextView(this);
        status.setTextSize(16);
        status.setGravity(Gravity.CENTER);
        status.setPadding(0, 0, 0, 48);
        root.addView(status, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button grantBtn = new Button(this);
        grantBtn.setText(R.string.btn_grant);
        grantBtn.setOnClickListener(v -> {
            Intent i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:" + getPackageName()));
            startActivity(i);
        });
        root.addView(grantBtn, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        startBtn = new Button(this);
        startBtn.setText(R.string.btn_start);
        startBtn.setOnClickListener(v -> {
            if (Build.VERSION.SDK_INT >= 33 &&
                    checkSelfPermission("android.permission.POST_NOTIFICATIONS")
                            != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 1);
            }
            Intent i = new Intent(this, MascotService.class);
            i.setAction(MascotService.ACTION_START);
            startForegroundService(i);
        });
        root.addView(startBtn, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        Button stopBtn = new Button(this);
        stopBtn.setText(R.string.btn_stop);
        stopBtn.setOnClickListener(v -> stopService(new Intent(this, MascotService.class)));
        root.addView(stopBtn, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);
    }

    @Override
    protected void onResume() {
        super.onResume();
        refresh();
    }

    private void refresh() {
        boolean overlay = Settings.canDrawOverlays(this);
        boolean running = MascotService.running;
        if (!overlay) {
            status.setText(R.string.need_overlay);
            startBtn.setEnabled(false);
        } else if (running) {
            status.setText(R.string.status_running);
            startBtn.setEnabled(false);
        } else {
            status.setText(R.string.status_stopped);
            startBtn.setEnabled(true);
        }
    }
}
