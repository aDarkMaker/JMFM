package com.example.jmfmobile.ui.viewer;

import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;
import androidx.core.content.res.ResourcesCompat;

import com.example.jmfmobile.R;

public class ErrorActivity extends AppCompatActivity {

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_error);

        // 应用自定义字体
        Typeface customFont = ResourcesCompat.getFont(this, R.font.aaguxilazhangguankeaideshen_2);

        Toolbar toolbar = findViewById(R.id.error_toolbar);
        setSupportActionBar(toolbar);
        if (getSupportActionBar() != null) {
            getSupportActionBar().setDisplayHomeAsUpEnabled(true);
            getSupportActionBar().setTitle(""); // 清空默认标题
        }

        // 设置自定义标题
        TextView titleView = new TextView(this);
        titleView.setText("错误信息");
        if (customFont != null) titleView.setTypeface(customFont);
        titleView.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        titleView.setTextSize(18);
        toolbar.addView(titleView);

        toolbar.setNavigationOnClickListener(v -> finish());

        TextView msgView = findViewById(R.id.error_message);
        String msg = getIntent().getStringExtra("error_msg");
        if (msg == null) msg = getString(R.string.error_generic);
        msgView.setText(msg);

        // 为按钮应用字体
        findViewById(R.id.error_ok).setOnClickListener(v -> finish());
        findViewById(R.id.error_reopen_tree).setOnClickListener(v -> {
            try {
                Intent it = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
                it.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                startActivity(it);
            } catch (Exception ex) {
                // fallback: just finish
            }
            finish();
        });
    }
}
