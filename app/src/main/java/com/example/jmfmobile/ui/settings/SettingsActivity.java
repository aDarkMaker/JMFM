package com.example.jmfmobile.ui.settings;

import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.ViewGroup;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.preference.PreferenceFragmentCompat;
import androidx.preference.PreferenceManager;
import androidx.recyclerview.widget.RecyclerView;

import com.example.jmfmobile.R;

public class SettingsActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        try {
            // 使用无 ActionBar 的设置页专用暗色主题以避免冲突
            setTheme(R.style.JMF_Settings_Dark_NoActionBar);
            super.onCreate(savedInstanceState);
            setContentView(R.layout.activity_settings);

            // 设置 Toolbar 并注册为 ActionBar
            Toolbar toolbar = findViewById(R.id.toolbar);
            if (toolbar != null) {
                setSupportActionBar(toolbar);
            }

            if (getSupportActionBar() != null) {
                getSupportActionBar().setDisplayHomeAsUpEnabled(true);
                getSupportActionBar().setTitle("应用设置");
            }

            // 加载设置Fragment
            if (savedInstanceState == null) {
                getSupportFragmentManager()
                        .beginTransaction()
                        .replace(R.id.settings_container, new SettingsFragment())
                        .commit();
            }
        } catch (Exception e) {
            // 捕获任何初始化异常，避免闪退并给出提示
            e.printStackTrace();
            Toast.makeText(this, "设置页面加载失败: " + e.getMessage(), Toast.LENGTH_LONG).show();
            finish();
            return;
        }
    }

    @Override
    public boolean onSupportNavigateUp() {
        getOnBackPressedDispatcher().onBackPressed();
        return true;
    }

    public static class SettingsFragment extends PreferenceFragmentCompat
            implements SharedPreferences.OnSharedPreferenceChangeListener {

        @Override
        public void onCreatePreferences(Bundle savedInstanceState, String rootKey) {
            setPreferencesFromResource(R.xml.preferences, rootKey);
        }

        @Override
        public RecyclerView onCreateRecyclerView(LayoutInflater inflater, ViewGroup parent, Bundle savedInstanceState) {
            RecyclerView recyclerView = (RecyclerView) super.onCreateRecyclerView(inflater, parent, savedInstanceState);
            // 移除左右内边距，确保设置项与屏幕左侧对齐
            recyclerView.setPadding(0, recyclerView.getPaddingTop(), 0, recyclerView.getPaddingBottom());
            recyclerView.setClipToPadding(false);
            return recyclerView;
        }

        @Override
        public void onResume() {
            super.onResume();
            getPreferenceManager().getSharedPreferences()
                    .registerOnSharedPreferenceChangeListener(this);
        }

        @Override
        public void onPause() {
            super.onPause();
            getPreferenceManager().getSharedPreferences()
                    .unregisterOnSharedPreferenceChangeListener(this);
        }

        @Override
        public void onSharedPreferenceChanged(SharedPreferences sharedPreferences, String key) {
            if (key != null) {
                switch (key) {
                    case "download_path":
                        Toast.makeText(getContext(), "下载路径已更新", Toast.LENGTH_SHORT).show();
                        break;
                    case "retry_times":
                        Toast.makeText(getContext(), "重试次数已更新", Toast.LENGTH_SHORT).show();
                        break;
                    case "image_quality":
                        Toast.makeText(getContext(), "图片质量已更新", Toast.LENGTH_SHORT).show();
                        break;
                }
            }
        }
    }
}
