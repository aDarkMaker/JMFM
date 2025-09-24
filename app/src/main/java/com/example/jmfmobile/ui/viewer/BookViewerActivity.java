package com.example.jmfmobile.ui.viewer;

import android.content.Intent;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.content.ContextCompat;
import androidx.core.content.res.ResourcesCompat;

import com.example.jmfmobile.R;
import com.github.barteksc.pdfviewer.PDFView;

public class BookViewerActivity extends AppCompatActivity {

    private static final String TAG = "BookViewerActivity";

    private PDFView pdfView;
    private Typeface customTypeface;
    private TextView titleView;
    private TextView pageNumberView;
    private ProgressBar progressBar;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_book_viewer);

        pdfView = findViewById(R.id.book_pdfView);
        customTypeface = ResourcesCompat.getFont(this, R.font.aaguxilazhangguankeaideshen_2);
        titleView = findViewById(R.id.book_center_title);
        pageNumberView = findViewById(R.id.book_page_number);
        progressBar = findViewById(R.id.book_progress);

        // toolbar 已在布局中定义标题 TextView（book_center_title），使用该视图并左对齐
        if (titleView != null) {
            titleView.setTextAlignment(View.TEXT_ALIGNMENT_VIEW_START);
            titleView.setGravity(android.view.Gravity.CENTER_VERTICAL | android.view.Gravity.START);
            titleView.setIncludeFontPadding(false);
            if (customTypeface != null) titleView.setTypeface(customTypeface);
            titleView.setTextColor(ContextCompat.getColor(this, R.color.text_primary));
        }

        // 隐藏页码，等待加载完成时显示
        if (pageNumberView != null) pageNumberView.setVisibility(View.GONE);

        Intent intent = getIntent();
        String pdfUri = intent.getStringExtra("pdf_uri");
        String bookName = intent.getStringExtra("book_name");

        if (bookName != null && titleView != null) titleView.setText(bookName);

        if (pdfUri == null) {
            Toast.makeText(this, "未指定要打开的 PDF", Toast.LENGTH_LONG).show();
            return;
        }

        // 显示加载指示器
        if (progressBar != null) progressBar.setVisibility(View.VISIBLE);

        try {
            Uri uri = Uri.parse(pdfUri);
            try {
                pdfView.fromUri(uri)
                        .enableSwipe(true)
                        .swipeHorizontal(false)
                        .enableDoubletap(true)
                        .defaultPage(0)
                        .enableAnnotationRendering(true)
                        .spacing(8) // 页面间距
                        .onPageChange((page, pageCount) -> {
                            if (pageNumberView != null) {
                                final String txt = (page + 1) + "/" + pageCount;
                                runOnUiThread(() -> pageNumberView.setText(txt));
                            }
                        })
                        .onLoad(nbPages -> {
                            if (progressBar != null) runOnUiThread(() -> progressBar.setVisibility(View.GONE));
                            if (pageNumberView != null) runOnUiThread(() -> {
                                pageNumberView.setText("1/" + nbPages);
                                pageNumberView.setVisibility(View.VISIBLE);
                            });
                        })
                        .onError(t -> {
                            Log.e(TAG, "PDF加载错误", t);
                            if (progressBar != null) runOnUiThread(() -> progressBar.setVisibility(View.GONE));
                            runOnUiThread(() -> Toast.makeText(BookViewerActivity.this,
                                    "PDF加载失败，请检查文件是否完整", Toast.LENGTH_LONG).show());
                        })
                        .load();
            } catch (Exception e) {
                Log.e(TAG, "加载 PDF 失败", e);
                // 回退尝试：将 content URI 的数据拷贝到应用缓存并从文件加载
                try {
                    if (uri.getScheme() != null && (uri.getScheme().equals("content") || uri.getScheme().equals("file"))) {
                        java.io.InputStream in = getContentResolver().openInputStream(uri);
                        if (in != null) {
                            java.io.File tmp = new java.io.File(getCacheDir(), "jmf_preview.pdf");
                            java.io.FileOutputStream out = null;
                            try {
                                out = new java.io.FileOutputStream(tmp);
                                byte[] buf = new byte[8192];
                                int len;
                                while ((len = in.read(buf)) > 0) {
                                    out.write(buf, 0, len);
                                }
                                out.flush();
                                // 从临时文件加载 PDF
                                pdfView.fromFile(tmp)
                                        .enableSwipe(true)
                                        .swipeHorizontal(false)
                                        .enableDoubletap(true)
                                        .defaultPage(0)
                                        .enableAnnotationRendering(true)
                                        .spacing(8)
                                        .onPageChange((page, pageCount) -> {
                                            if (pageNumberView != null) {
                                                final String txt = (page + 1) + "/" + pageCount;
                                                runOnUiThread(() -> pageNumberView.setText(txt));
                                            }
                                        })
                                        .onLoad(nbPages -> {
                                            if (progressBar != null) runOnUiThread(() -> progressBar.setVisibility(View.GONE));
                                            if (pageNumberView != null) runOnUiThread(() -> {
                                                pageNumberView.setText("1/" + nbPages);
                                                pageNumberView.setVisibility(View.VISIBLE);
                                            });
                                        })
                                        .onError(t -> {
                                            Log.e(TAG, "临时文件PDF加载错误", t);
                                            if (progressBar != null) runOnUiThread(() -> progressBar.setVisibility(View.GONE));
                                            runOnUiThread(() -> Toast.makeText(BookViewerActivity.this,
                                                    "PDF文件损坏或格式不支持", Toast.LENGTH_LONG).show());
                                        })
                                        .load();
                                return;
                            } finally {
                                try { if (in != null) in.close(); } catch (Exception _ignored) {}
                                try { if (out != null) out.close(); } catch (Exception _ignored) {}
                            }
                        }
                    }
                } catch (Exception ex) {
                    Log.e(TAG, "回退拷贝 URI 到缓存失败", ex);
                }

                if (progressBar != null) progressBar.setVisibility(View.GONE);
                Toast.makeText(this, "无法打开PDF: " + e.getMessage(), Toast.LENGTH_LONG).show();
                return;
            }
        } catch (Exception e) {
            if (progressBar != null) progressBar.setVisibility(View.GONE);
            Toast.makeText(this, "URI解析失败: " + e.getMessage(), Toast.LENGTH_LONG).show();
            Log.e(TAG, "解析 PDF URI 失败", e);
            return;
        }
    }
}
