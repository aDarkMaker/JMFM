package com.example.jmfmobile;

import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import androidx.core.content.res.ResourcesCompat;

import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.util.FitPolicy;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

public class PDFViewerActivity extends AppCompatActivity {
    private static final String TAG = "PDFViewerActivity";
    private PDFView pdfView;
    private ProgressBar progressBar;
    private ImageButton backBtn;
    private TextView titleView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 隐藏系统状态栏，删除紫色条
        hideSystemStatusBar();

        setContentView(R.layout.activity_pdf_viewer);

        initViews();
        loadPdf();
    }

    private void hideSystemStatusBar() {
        // 使用 WindowInsetsControllerCompat 隐藏状态栏，替代已过时的 setSystemUiVisibility
        try {
            WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
            WindowInsetsControllerCompat controller = new WindowInsetsControllerCompat(getWindow(), getWindow().getDecorView());
            controller.hide(WindowInsetsCompat.Type.statusBars());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        } catch (Exception ignored) {}

        // 保持屏幕常亮
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    private void initViews() {
        pdfView = findViewById(R.id.pdfView);
        progressBar = findViewById(R.id.pdf_progress);
        backBtn = findViewById(R.id.pdf_back_btn);
        titleView = findViewById(R.id.pdf_title);

        // 应用项目自定义字体
        if (titleView != null) {
            try {
                android.graphics.Typeface tf = ResourcesCompat.getFont(this, R.font.aaguxilazhangguankeaideshen_2);
                if (tf != null) titleView.setTypeface(tf);
            } catch (Exception ignore) {}
        }

        // 设置返回按钮点击事件
        if (backBtn != null) {
            backBtn.setOnClickListener(v -> finish());
        }
    }

    private void loadPdf() {
        String payload = getIntent().getStringExtra("pdf_payload");
        if (payload == null || payload.trim().isEmpty()) {
            finish();
            return;
        }
        payload = payload.trim();

        // 设置PDF名称到标题
        if (titleView != null) {
            titleView.setText(extractFileName(payload));
        }

        showLoading(true);

        try {
            if (payload.startsWith("content://")) {
                loadFromUri(payload);
            } else if (payload.startsWith("file://")) {
                loadFromFile(payload);
            } else if (payload.startsWith("http://") || payload.startsWith("https://")) {
                downloadAndLoad(payload);
            } else {
                loadFromPath(payload);
            }
        } catch (Exception e) {
            Log.e(TAG, "Load PDF error", e);
            finish();
        }
    }

    private void loadFromUri(String payload) {
        Uri uri = Uri.parse(payload);
        pdfView.fromUri(uri)
                .enableSwipe(true)
                .swipeHorizontal(false)
                .enableAnnotationRendering(false)
                .pageFitPolicy(FitPolicy.WIDTH)
                .spacing(0)
                .autoSpacing(false)
                .pageSnap(false)
                .pageFling(false)
                .enableDoubletap(true)
                .scrollHandle(null)
                .onLoad(nbPages -> onPdfLoaded())
                .onError(t -> {
                    Log.e(TAG, "PDF load error: " + t.getMessage(), t);
                    finish();
                })
                .load();
    }

    private void loadFromFile(String payload) {
        try {
            File f = new File(Uri.parse(payload).getPath());
            if (f.exists()) {
                loadPdfFromFile(f);
            } else {
                finish();
            }
        } catch (Exception e) {
            finish();
        }
    }

    private void loadFromPath(String payload) {
        File f = new File(payload);
        if (f.exists()) {
            loadPdfFromFile(f);
        } else {
            finish();
        }
    }

    private void loadPdfFromFile(File file) {
        pdfView.fromFile(file)
                .enableSwipe(true)
                .swipeHorizontal(false)
                .enableAnnotationRendering(false)
                .pageFitPolicy(FitPolicy.WIDTH)
                .spacing(0)
                .autoSpacing(false)
                .pageSnap(false)
                .pageFling(false)
                .enableDoubletap(true)
                .scrollHandle(null)
                .onLoad(nbPages -> onPdfLoaded())
                .onError(t -> finish())
                .load();
    }

    private void downloadAndLoad(String urlStr) {
        new Thread(() -> {
            InputStream is = null;
            FileOutputStream fos = null;
            File outFile = null;
            try {
                URL url = new URL(urlStr);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setRequestProperty("User-Agent", "Mozilla/5.0");
                conn.connect();

                if (conn.getResponseCode() != HttpURLConnection.HTTP_OK) {
                    throw new Exception("HTTP " + conn.getResponseCode());
                }

                is = conn.getInputStream();
                outFile = new File(getCacheDir(), "jm_temp.pdf");
                fos = new FileOutputStream(outFile);

                byte[] buf = new byte[8192];
                int len;
                while ((len = is.read(buf)) != -1) {
                    fos.write(buf, 0, len);
                }
                fos.flush();

                final File finalFile = outFile;
                runOnUiThread(() -> loadPdfFromFile(finalFile));

            } catch (Exception e) {
                if (outFile != null && outFile.exists()) outFile.delete();
                runOnUiThread(this::finish);
            } finally {
                try { if (is != null) is.close(); } catch (Exception ignored) {}
                try { if (fos != null) fos.close(); } catch (Exception ignored) {}
            }
        }).start();
    }

    private void onPdfLoaded() {
        runOnUiThread(() -> showLoading(false));
    }

    private void showLoading(boolean show) {
        if (progressBar != null) {
            progressBar.setVisibility(show ? View.VISIBLE : View.GONE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemStatusBar();
        }
    }

    private String extractFileName(String payload) {
        if (payload == null) return "PDF预览";
        try {
            String fileName = payload;

            // 从路径中提取文件名
            if (payload.contains("/")) {
                String[] parts = payload.split("/");
                fileName = parts[parts.length - 1];
            }

            // URL解码处理乱码
            try {
                fileName = java.net.URLDecoder.decode(fileName, "UTF-8");
            } catch (Exception e) {
                // 解码失败，使用原始文件名
            }

            // 移除常见的前缀：primary:jm/, secondary:, content: 等
            if (fileName.contains(":")) {
                String[] prefixParts = fileName.split(":", 2);
                if (prefixParts.length > 1) {
                    // 检查是否是路径前缀（如 primary:jm/, content: 等）
                    String prefix = prefixParts[0].toLowerCase();
                    if (prefix.matches("^(primary|secondary|content|external|internal)$")) {
                        fileName = prefixParts[1];
                        // 如果还有斜杠，再次提取最后部分
                        if (fileName.contains("/")) {
                            String[] pathParts = fileName.split("/");
                            fileName = pathParts[pathParts.length - 1];
                        }
                    }
                }
            }

            // 移除文件扩展名
            if (fileName.toLowerCase().endsWith(".pdf")) {
                fileName = fileName.substring(0, fileName.length() - 4);
            }

            // 如果文件名为空或只包含特殊字符，返回默认名称
            if (fileName.trim().isEmpty() || fileName.matches("^[^\\p{L}\\p{N}]+$")) {
                return "PDF预览";
            }

            return fileName.trim();
        } catch (Exception e) {
            return "PDF预览";
        }
    }
}
