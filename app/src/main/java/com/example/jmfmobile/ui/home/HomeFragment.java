package com.example.jmfmobile.ui.home;

import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.Toast;
import android.text.SpannableStringBuilder;
import android.text.Spanned;
import android.text.style.ForegroundColorSpan;
import android.graphics.drawable.Drawable;

import androidx.annotation.NonNull;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.Fragment;

import com.example.jmfmobile.R;
import com.example.jmfmobile.databinding.FragmentHomeBinding;
import com.example.jmfmobile.core.JMcomicDownloader;

import java.io.File;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import android.content.SharedPreferences;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.preference.PreferenceManager;
import android.widget.ArrayAdapter;

public class HomeFragment extends Fragment {

    private FragmentHomeBinding binding;
    private JMcomicDownloader downloader;
    private Handler uiHandler;
    private ActivityResultLauncher<Uri> openTreeLauncher;

    // 状态枚举
    private enum AppStatus {
        IDLE("待命", R.drawable.status_idle),
        PROCESSING("处理中", R.drawable.status_processing),
        SUCCESS("完成", R.drawable.status_idle),
        ERROR("失败", R.drawable.status_error);

        private final String text;
        private final int drawableRes;

        AppStatus(String text, int drawableRes) {
            this.text = text;
            this.drawableRes = drawableRes;
        }

        public String getText() { return text; }
        public int getDrawableRes() { return drawableRes; }
    }

    @Override
    public View onCreateView(@NonNull LayoutInflater inflater,
                             ViewGroup container, Bundle savedInstanceState) {

        binding = FragmentHomeBinding.inflate(inflater, container, false);
        View root = binding.getRoot();

        // 初始化UI处理器
        uiHandler = new Handler(Looper.getMainLooper());

        // 注册目录选择回调（使用 OpenDocumentTree）
        openTreeLauncher = registerForActivityResult(new ActivityResultContracts.OpenDocumentTree(), uri -> {
            if (uri != null) {
                try {
                    // 持久化权限
                    final int takeFlags = Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION;
                    requireContext().getContentResolver().takePersistableUriPermission(uri, takeFlags);
                    // 保存到偏好，供下次直接打开
                    SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(requireContext());
                    prefs.edit().putString("saved_output_uri", uri.toString()).apply();
                    appendLog("📁 已保存并授予目录访问权限: " + uri);
                    showNotification("已保存输出目录权限", "success");
                } catch (Exception e) {
                    appendLog("⚠️ 授予持久权限失败: " + e.getMessage(), "warning");
                    showNotification("无法保存目录权限", "warning");
                }
            } else {
                appendLog("⚠️ 未选择目录", "warning");
            }
        });

        // 初始化下载器
        downloader = new JMcomicDownloader(requireContext());

        // 初始化UI
        initializeUI();

        // 设置事件监听器
        setupEventListeners();

        return root;
    }

    private void initializeUI() {
        // 设置初始状态
        setAppStatus(AppStatus.IDLE);
        appendLog("JMcomic Fetcher 已启动");
        updateLogHint("等待操作...");

        // 隐藏进度条
        showProgress(false, 0);
    }

    private void setupEventListeners() {
        // 下载按钮事件
        binding.btnDownload.setOnClickListener(v -> handleDownload());

        // 输入框事件
        binding.editComicId.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {}

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
                // 只允许数字输入
                String filtered = s.toString().replaceAll("[^0-9]", "");
                if (!s.toString().equals(filtered)) {
                    binding.editComicId.setText(filtered);
                    binding.editComicId.setSelection(filtered.length());
                }
            }

            @Override
            public void afterTextChanged(Editable s) {}
        });

        // 工具栏按钮事件
        binding.btnOpenOutput.setOnClickListener(v -> handleOpenOutputDir());
        binding.btnPreview.setOnClickListener(v -> handlePDFPreview());
        binding.btnSettings.setOnClickListener(v -> handleSettings());
        binding.btnClearLog.setOnClickListener(v -> handleClearLog());
    }

    private void handleDownload() {
        CharSequence raw = (binding.editComicId.getText() != null) ? binding.editComicId.getText() : "";
        String albumId = raw.toString().trim();

        if (TextUtils.isEmpty(albumId)) {
            showNotification("请输入本子ID", "error");
            binding.editComicId.requestFocus();
            return;
        }

        if (!albumId.matches("\\d+")) {
            showNotification("本子ID必须是数字", "error");
            binding.editComicId.requestFocus();
            return;
        }

        // 开始下载
        startDownload(albumId);
    }

    private void startDownload(String albumId) {
        setBusy(true);
        clearLog();
        appendLog("开始下载本子 ID: " + albumId);
        setAppStatus(AppStatus.PROCESSING);
        showProgress(true, 0);
        updateLogHint("正在处理，请稍等...");

        String title = "漫画_" + albumId;
        downloader.downloadComic(albumId, title, new JMcomicDownloader.DownloadCallback() {
            @Override
            public void onProgress(int progress, String message) {
                uiHandler.post(() -> {
                    showProgress(true, progress);
                    appendLog(message);
                    binding.textProgress.setText(String.format(Locale.getDefault(), "%d%%", progress));
                });
            }

            @Override
            public void onSuccess(String filePath) {
                uiHandler.post(() -> handleDownloadSuccess(filePath));
            }

            @Override
            public void onError(String error) {
                uiHandler.post(() -> handleDownloadError(error));
            }
        });
    }

    private void handleDownloadSuccess(String filePath) {
        setBusy(false);
        showProgress(false, 0);
        setAppStatus(AppStatus.SUCCESS);
        appendLog("✅ 下载和转换完成！", "success");
        appendLog("文件保存到: " + filePath, "success");
        updateLogHint("操作成功完成");
        showNotification("下载完成！", "success");
    }

    private void handleDownloadError(String error) {
        setBusy(false);
        showProgress(false, 0);
        setAppStatus(AppStatus.ERROR);
        appendLog("❌ 错误: " + error, "error");
        updateLogHint("发生错误，请检查日志");
        showNotification("操作出错", "error");

        // 如果是无法获取漫画信息，尝试在浏览器打开示例域名的 album 页面，帮助用户检查
        try {
            String lower = (error != null) ? error.toLowerCase() : "";
            if (lower.contains("无法获取漫画信息") || lower.contains("https 访问失败") || lower.contains("http 访问失败")) {
                String testUrl = "https://18comic-mygo.vip/album/" + (binding.editComicId.getText() != null ? binding.editComicId.getText().toString().trim() : "");
                appendLog("🔍 无法获取信息，尝试在浏览器打开: " + testUrl);
                Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(testUrl));
                if (browser.resolveActivity(requireContext().getPackageManager()) != null) {
                    startActivity(browser);
                }
            }
        } catch (Exception ex) {
            appendLog("⚠️ 在浏览器中打开失败: " + ex.getMessage(), "warning");
        }
    }

    private void handleOpenOutputDir() {
        try {
            appendLog("📁 即将打开目录选择器，请选择 JMcomic 输出目录（首次选择将保存权限）");

            // 优先使用已保存的 URI 作为初始位置
            SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(requireContext());
            String saved = prefs.getString("saved_output_uri", null);
            if (saved != null) {
                try {
                    Uri savedUri = Uri.parse(saved);
                    // launch with initial URI if supported
                    openTreeLauncher.launch(savedUri);
                    return;
                } catch (Exception e) {
                    // 解析失败，继续作为普通选择
                    appendLog("⚠️ 解析已保存 URI 失败，打开选择器: " + e.getMessage(), "warning");
                }
            }

            // 否则正常打开选择器
            openTreeLauncher.launch(null);
        } catch (Exception e) {
            appendLog("❌ 打开目录出错: " + e.getMessage(), "error");
            showNotification("操作失败", "error");
            // 回退：显示路径并复制到剪贴板
            try {
                File outputDir = new File(requireContext().getExternalFilesDir(android.os.Environment.DIRECTORY_DOWNLOADS), "JMcomic");
                String path = outputDir.getAbsolutePath();
                appendLog("⚠️ 手动查看目录: " + path, "warning");
                ClipboardManager clipboard = (ClipboardManager) requireContext().getSystemService(Context.CLIPBOARD_SERVICE);
                ClipData clip = ClipData.newPlainText("JMcomicPath", path);
                if (clipboard != null) clipboard.setPrimaryClip(clip);
            } catch (Exception ex) {
                // ignore
            }
        }
    }

    private void handlePDFPreview() {
        try {
            SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(requireContext());
            String saved = prefs.getString("saved_output_uri", null);
            if (saved == null) {
                showNotification("请先通过【目录】指定输出目录后再预览", "warning");
                appendLog("⚠️ 未配置输出目录，请先点击目录并授权");
                return;
            }

            Uri treeUri = Uri.parse(saved);
            // 验证是否仍然持有该树的持久权限
            boolean hasPersisted = false;
            try {
                // 某些编译环境下 android.content.ContentResolver.PersistableUriPermission 可能无法直接解析，
                // 此处使用通用 List 并通过反射安全读取 getUri() 和 isReadPermission() 方法。
                java.util.List<?> perms = requireContext().getContentResolver().getPersistedUriPermissions();
                if (perms != null) {
                    for (Object p : perms) {
                        try {
                            java.lang.reflect.Method mGetUri = p.getClass().getMethod("getUri");
                            java.lang.reflect.Method mIsRead = p.getClass().getMethod("isReadPermission");
                            Object uriObj = mGetUri.invoke(p);
                            Object readObj = mIsRead.invoke(p);
                            if (uriObj instanceof Uri && readObj instanceof Boolean) {
                                Uri u = (Uri) uriObj;
                                boolean isRead = (Boolean) readObj;
                                if (u.equals(treeUri) && isRead) {
                                    hasPersisted = true;
                                    break;
                                }
                            }
                        } catch (Throwable inner) {
                            // 忽略单个权限项的读取错误
                        }
                    }
                }
            } catch (Exception e) {
                // ignore
            }

            if (!hasPersisted) {
                showNotification("应用未持有已保存目录的持久权限，请重新选择目录", "warning");
                appendLog("⚠️ 未检测到持久权限: " + treeUri);
                return;
            }

            // 使用反射调用 DocumentFile，避免在某些 IDE/编译环境中直接引用导致的问题
            java.util.List<String> displayNames = new java.util.ArrayList<>();
            java.util.List<String> payloads = new java.util.ArrayList<>();

            boolean gotAny = false;
            Object tree = null;
            try {
                try {
                    Class<?> dfClass = Class.forName("androidx.documentfile.provider.DocumentFile");
                    java.lang.reflect.Method fromTree = dfClass.getMethod("fromTreeUri", android.content.Context.class, Uri.class);
                    tree = fromTree.invoke(null, requireContext(), treeUri);
                } catch (Throwable t) {
                    appendLog("⚠️ DocumentFile.fromTreeUri 反射调用失败，回退到文件系统扫描: " + t.getMessage(), "warning");
                }

                boolean treeIsDir = false;
                if (tree != null) {
                    try {
                        java.lang.reflect.Method isDir = tree.getClass().getMethod("isDirectory");
                        Object r = isDir.invoke(tree);
                        if (r instanceof Boolean) treeIsDir = (Boolean) r;
                    } catch (Throwable t) {
                        // ignore
                    }
                }

                if (tree == null || !treeIsDir) {
                    appendLog("⚠️ 已保存目录不可用或不可遍历，尝试回退到文件系统扫描: " + saved, "warning");
                    // don't return here; we'll try file system fallback below
                } else {
                    try {
                        java.lang.reflect.Method listFiles = tree.getClass().getMethod("listFiles");
                        Object listObj = listFiles.invoke(tree);
                        Object[] children = null;
                        if (listObj instanceof Object[]) {
                            children = (Object[]) listObj;
                        } else if (listObj instanceof java.util.Collection) {
                            children = ((java.util.Collection<?>) listObj).toArray();
                        }
                        if (children != null) {
                            for (Object child : children) {
                                try {
                                    java.lang.reflect.Method isFile = child.getClass().getMethod("isFile");
                                    java.lang.reflect.Method getName = child.getClass().getMethod("getName");
                                    java.lang.reflect.Method getUri = child.getClass().getMethod("getUri");
                                    Object isFileRes = isFile.invoke(child);
                                    Object nameObj = getName.invoke(child);
                                    Object uriObj = getUri.invoke(child);
                                    if (isFileRes instanceof Boolean && (Boolean) isFileRes
                                            && nameObj instanceof String && ((String) nameObj).toLowerCase().endsWith(".pdf")
                                            && uriObj != null) {
                                        displayNames.add((String) nameObj);
                                        payloads.add(uriObj.toString());
                                        gotAny = true;
                                    }
                                } catch (Throwable t) {
                                    // 忽略单个子项错误
                                }
                            }
                        }
                    } catch (Throwable t) {
                        appendLog("⚠️ DocumentFile 列举失败（反射），回退到文件系统扫描: " + t.getMessage(), "warning");
                    }
                }
            } catch (Throwable t) {
                appendLog("⚠️ DocumentFile 操作失败（反射），回退到文件系统扫描: " + t.getMessage(), "warning");
            }

            // Debug: 输出找到的条目数量
            appendLog("ℹ️ 找到 PDF 列表项: " + displayNames.size(), "info");

            if (!gotAny) {
                showNotification("指定目录下未找到任何 PDF 文件，请检查目录", "warning");
                appendLog("⚠️ 未找到 PDF（DocumentFile/文件系统均为空）: " + treeUri);
                return;
            }

            // 使用自定义的 PdfListActivity 显示列表（与主题一致）
            try {
                java.util.ArrayList<String> namesList = new java.util.ArrayList<>(displayNames);
                java.util.ArrayList<String> payloadList = new java.util.ArrayList<>(payloads);
                Intent listIntent = new Intent(requireContext(), com.example.jmfmobile.ui.viewer.PdfListActivity.class);
                listIntent.putStringArrayListExtra("pdf_names", namesList);
                listIntent.putStringArrayListExtra("pdf_payloads", payloadList);
                startActivity(listIntent);
                appendLog("🔎 打开自定义 PDF 列表（主题一致）");
            } catch (Exception e) {
                appendLog("❌ 启动自定义 PDF 列表失败: " + e.getMessage(), "error");
                // 回退：尝试使用旧的对话框（若需要，可实现），此处提示用户
                showNotification("打开列表失败", "error");
            }

         } catch (Exception e) {
             appendLog("❌ 选择本子失败: " + e.getMessage(), "error");
             showNotification("选择失败", "error");
         }
     }

    private void handleSettings() {
        // 启动设置界面，捕获异常以避免闪退
        try {
            Intent intent = new Intent(getActivity(), com.example.jmfmobile.ui.settings.SettingsActivity.class);
            startActivity(intent);
            appendLog("⚙️ 设置界面已打开");
        } catch (Exception e) {
            appendLog("❌ 打开设置页面失败: " + e.getMessage(), "error");
            showNotification("无法打开设置页", "error");
        }
    }

    private void handleClearLog() {
        clearLog();
        appendLog("日志已清空");
        updateLogHint("日志已清空");
        setAppStatus(AppStatus.IDLE);
    }

    // UI状态管理方法
    private void setAppStatus(AppStatus status) {
        binding.textStatus.setText(status.getText());
        Drawable statusDrawable = ContextCompat.getDrawable(requireContext(), status.getDrawableRes());
        binding.statusIndicator.setBackground(statusDrawable);
    }

    private void setBusy(boolean busy) {
        binding.btnDownload.setEnabled(!busy);
        binding.editComicId.setEnabled(!busy);
        // fab 已移除，跳过设置

        if (busy) {
            binding.btnDownload.setText("📥 处理中...");
        } else {
            binding.btnDownload.setText("📥 下载并转换");
        }
    }

    private void showProgress(boolean show, int progress) {
        if (show) {
            binding.progressContainer.setVisibility(View.VISIBLE);
            if (progress > 0) {
                binding.progressBar.setIndeterminate(false);
                binding.progressBar.setProgress(progress);
                binding.textProgress.setText(String.format(Locale.getDefault(), "%d%%", progress));
            } else {
                binding.progressBar.setIndeterminate(true);
                binding.textProgress.setText("准备中...");
            }
        } else {
            binding.progressContainer.setVisibility(View.GONE);
        }
    }

    private void updateLogHint(String hint) {
        binding.textLogHint.setText(hint);
    }

    private void appendLog(String message) {
        appendLog(message, "info");
    }

    private void appendLog(String message, String type) {
        String timestamp = new SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(new Date());
        String logEntry = "[" + timestamp + "] " + message + "\n";

        SpannableStringBuilder currentLog = new SpannableStringBuilder(binding.textLog.getText());
        SpannableStringBuilder newEntry = new SpannableStringBuilder(logEntry);

        // 根据类型设置颜色
        int color;
        switch (type) {
            case "error":
                color = ContextCompat.getColor(requireContext(), R.color.danger);
                break;
            case "success":
                color = ContextCompat.getColor(requireContext(), R.color.success);
                break;
            case "warning":
                color = ContextCompat.getColor(requireContext(), R.color.warning);
                break;
            default:
                color = ContextCompat.getColor(requireContext(), R.color.log_text);
                break;
        }

        newEntry.setSpan(new ForegroundColorSpan(color), 0, newEntry.length(), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE);
        currentLog.append(newEntry);

        binding.textLog.setText(currentLog);

        // 滚动到底部
        binding.textLog.post(() -> {
            View parent = (View) binding.textLog.getParent();
            if (parent instanceof androidx.core.widget.NestedScrollView) {
                ((androidx.core.widget.NestedScrollView) parent).fullScroll(View.FOCUS_DOWN);
            }
        });
    }

    private void clearLog() {
        binding.textLog.setText("JMcomic Fetcher 已启动\n");
    }

    private void showNotification(String message, String type) {
        int duration = Toast.LENGTH_SHORT;
        if ("error".equals(type) || "warning".equals(type)) {
            duration = Toast.LENGTH_LONG;
        }
        Toast.makeText(getContext(), message, duration).show();
    }

    @Override
    public void onDestroyView() {
        super.onDestroyView();
        if (downloader != null) {
            downloader.cleanup();
        }
        binding = null;
    }
}
