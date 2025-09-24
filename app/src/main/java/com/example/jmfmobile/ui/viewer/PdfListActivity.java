package com.example.jmfmobile.ui.viewer;

import android.content.ClipData;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.MenuItem;
import android.view.View;
import android.view.ViewGroup;
import android.widget.ArrayAdapter;
import android.widget.ImageView;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.Toolbar;
import androidx.core.content.ContextCompat;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

import com.example.jmfmobile.R;

import java.util.ArrayList;
import java.util.List;

public class PdfListActivity extends AppCompatActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_pdf_list);

        Toolbar toolbar = findViewById(R.id.pdf_list_toolbar);
        setSupportActionBar(toolbar);

        // 根视图用于接收 WindowInsets，确保状态栏高度被正确应用
        View root = findViewById(R.id.pdf_list_root);
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            int statusBarTop = insets.getInsets(WindowInsetsCompat.Type.statusBars()).top;
            try {
                // 仅应用一次：扩展 toolbar 高度以包含状态栏并避免重复叠加
                Object applied = toolbar.getTag();
                if (!(applied instanceof Boolean) || !((Boolean) applied)) {
                    ViewGroup.LayoutParams lp = toolbar.getLayoutParams();
                    if (lp != null && lp.height > 0) {
                        lp.height = lp.height + statusBarTop;
                        toolbar.setLayoutParams(lp);
                    }
                    toolbar.setTag(Boolean.TRUE);
                }
            } catch (Throwable ignored) {}

            // 将状态栏高度作为 toolbar 的顶端内边距，使内部子控件垂直居中
            toolbar.setPadding(toolbar.getPaddingLeft(), statusBarTop, toolbar.getPaddingRight(), toolbar.getPaddingBottom());
            // 同步右侧占位（若存在）padding 以保持视觉一致
            View rightPlace = findViewById(R.id.pdf_list_right_placeholder);
            if (rightPlace != null) rightPlace.setPadding(rightPlace.getPaddingLeft(), statusBarTop, rightPlace.getPaddingRight(), rightPlace.getPaddingBottom());
            return insets;
        });
        ViewCompat.requestApplyInsets(root);

        // 居中标题 TextView
        TextView centerTitle = findViewById(R.id.pdf_list_center_title);

        // 设置返回按钮并上色
        try {
            toolbar.setNavigationIcon(R.drawable.ic_arrow_back);
            if (toolbar.getNavigationIcon() != null) {
                toolbar.getNavigationIcon().setTint(ContextCompat.getColor(this, R.color.text_primary));
            }
            toolbar.setNavigationOnClickListener(v -> finish());
        } catch (Exception ignored) {}

        ListView listView = findViewById(R.id.pdf_list_view);

        Intent intent = getIntent();
        ArrayList<String> names = intent.getStringArrayListExtra("pdf_names");
        ArrayList<String> payloads = intent.getStringArrayListExtra("pdf_payloads");

        if (names == null || payloads == null || names.isEmpty() || payloads.isEmpty()) {
            Toast.makeText(this, "未找到任何 PDF", Toast.LENGTH_SHORT).show();
            finish();
            return;
        }

        // 设置居中标题文本（显示数量）
        String titleText = getString(R.string.pdf_list_title) + "（" + names.size() + "）";
        centerTitle.setText(titleText);

        // 设置右侧不可见占位宽度为导航图标宽度，保证视觉居中
        try {
            View rightPlace = findViewById(R.id.pdf_list_right_placeholder);
            View leftPlace = findViewById(R.id.pdf_list_left_placeholder);
            if ((rightPlace != null || leftPlace != null) && toolbar.getNavigationIcon() != null) {
                int navW = toolbar.getNavigationIcon().getIntrinsicWidth();
                if (rightPlace != null) {
                    ViewGroup.LayoutParams rlp = rightPlace.getLayoutParams();
                    if (rlp != null) {
                        rlp.width = navW;
                        rightPlace.setLayoutParams(rlp);
                        rightPlace.setVisibility(View.INVISIBLE);
                    }
                }
                if (leftPlace != null) {
                    ViewGroup.LayoutParams llp = leftPlace.getLayoutParams();
                    if (llp != null) {
                        // 左侧占位使用导航图标宽度的一半，使标题更靠近左侧箭头
                        llp.width = Math.max( (navW / 2),  dpToPx(4) );
                        leftPlace.setLayoutParams(llp);
                        leftPlace.setVisibility(View.INVISIBLE);
                    }
                }
            }
        } catch (Exception ignored) {}

        PdfAdapter adapter = new PdfAdapter(this, names, payloads);
        listView.setAdapter(adapter);

        listView.setOnItemClickListener((parent, view, position, id) -> {
            String payload = payloads.get(position);
            try {
                Intent in = new Intent(PdfListActivity.this, com.example.jmfmobile.PDFViewerActivity.class);
                in.putExtra("pdf_payload", payload);

                if (payload != null) {
                    String p = payload.trim();
                    if (p.startsWith("content://") || p.startsWith("file://") || p.startsWith("http://") || p.startsWith("https://")) {
                        Uri uri = Uri.parse(p);
                        in.setData(uri);
                        in.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        ClipData clip = ClipData.newRawUri("pdf", uri);
                        in.setClipData(clip);
                        try {
                            grantUriPermission(getPackageName(), uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        } catch (Exception ignored) {}
                    }
                }

                startActivity(in);
            } catch (Exception e) {
                Toast.makeText(PdfListActivity.this, "无法打开预览: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        });
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        if (item.getItemId() == android.R.id.home) {
            finish();
            return true;
        }
        return super.onOptionsItemSelected(item);
    }

    // 使用自定义 ArrayAdapter，以 item_pdf_list 布局渲染每一项，保持原来的美观样式
    private static class PdfAdapter extends ArrayAdapter<String> {
        private final LayoutInflater inflater;
        private final List<String> payloads;
        private final int resource = R.layout.item_pdf_list;

        PdfAdapter(android.content.Context context, List<String> names, List<String> payloads) {
            super(context, R.layout.item_pdf_list, names);
            this.inflater = LayoutInflater.from(context);
            this.payloads = payloads;
        }

        @Override
        public View getView(int position, View convertView, ViewGroup parent) {
            ViewHolder vh;
            if (convertView == null) {
                convertView = inflater.inflate(resource, parent, false);
                vh = new ViewHolder();
                vh.title = convertView.findViewById(R.id.item_pdf_title);
                vh.subtitle = convertView.findViewById(R.id.item_pdf_subtitle);
                vh.icon = convertView.findViewById(android.R.id.icon);
                convertView.setTag(vh);
            } else {
                vh = (ViewHolder) convertView.getTag();
            }

            String name = getItem(position);
            vh.title.setText(name != null ? name : getContext().getString(R.string.unnamed_pdf));
            vh.subtitle.setText(getContext().getString(R.string.click_to_preview));

            return convertView;
        }

        private static class ViewHolder {
            TextView title;
            TextView subtitle;
            ImageView icon;
        }
    }

    private int getStatusBarHeight() {
        int result = 0;
        int resourceId = getResources().getIdentifier("status_bar_height", "dimen", "android");
        if (resourceId > 0) {
            result = getResources().getDimensionPixelSize(resourceId);
        }
        return result;
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round((float) dp * density);
    }
}
