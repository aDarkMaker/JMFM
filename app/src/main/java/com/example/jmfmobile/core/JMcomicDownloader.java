package com.example.jmfmobile.core;

import android.content.Context;
import android.os.Environment;
import android.util.Log;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import android.content.SharedPreferences;
import androidx.preference.PreferenceManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.pdf.PdfDocument;
import android.graphics.Canvas;
import android.graphics.Paint;

/**
 * 基于sampledata实现的下载器
 * 参考sampledata/core/downloader.py的逻辑
 *
 * 要点：
 * - 禁用图片分割/解密逻辑，直接保存所有图片字节（webp会解码并保存为 PNG）
 * - 下载完成后直接把所有图片合并成一个 PDF（不再压缩为 ZIP）
 */
public class JMcomicDownloader {
    private static final String TAG = "JMcomicDownloader";

    // 一些域名备用
    private static final String[] DOMAINS = {
            "18comic-mygo.vip",
            "18comic-mygo.org",
            "18comic-MHWs.CC",
            "jmcomic-zzz.one",
            "jmcomic-zzz.org"
    };

    private final ExecutorService executor;
    private final File downloadDir;
    private final int maxRetries = 3;
    private final int timeout = 30000; // ms

    // 代理支持
    private boolean enableProxy = false;
    private String proxyAddress = null;

    public interface DownloadCallback {
        void onProgress(int progress, String message);
        void onSuccess(String filePath);
        void onError(String error);
    }

    public JMcomicDownloader(Context context) {
        this.executor = Executors.newCachedThreadPool();

        File selectedDir;
        if (Environment.getExternalStorageState().equals(Environment.MEDIA_MOUNTED)) {
            File publicDownloads = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS);
            selectedDir = new File(publicDownloads, "JMcomic");
        } else {
            Log.w(TAG, "外部存储不可用，使用应用私有目录");
            File ext = context.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
            if (ext == null) selectedDir = new File(context.getFilesDir(), "JMcomic");
            else selectedDir = new File(ext, "JMcomic");
        }

        this.downloadDir = selectedDir;
        ensureStoragePermissions();

        try {
            SharedPreferences prefs = PreferenceManager.getDefaultSharedPreferences(context);
            this.enableProxy = prefs.getBoolean("enable_proxy", false);
            this.proxyAddress = prefs.getString("proxy_address", null);
            if (enableProxy && proxyAddress != null) Log.i(TAG, "代理启用: " + proxyAddress);
        } catch (Exception e) {
            Log.w(TAG, "读取偏好失败: " + e.getMessage());
        }
    }

    public void downloadComic(String albumId, String title, DownloadCallback callback) {
        executor.execute(() -> {
            try {
                callback.onProgress(0, "开始下载: " + title);

                String comicInfo = getComicInfo(albumId);
                if (comicInfo == null) { callback.onError("无法获取漫画信息"); return; }

                callback.onProgress(20, "解析漫画信息...");
                List<String> chapters = parseChapters(comicInfo, albumId);
                if (chapters.isEmpty()) { callback.onError("未找到章节"); return; }

                callback.onProgress(40, "找到 " + chapters.size() + " 个章节");

                String pdfPath = downloadAndCreatePDF(albumId, title, chapters, callback);
                if (pdfPath != null) callback.onSuccess(pdfPath);
                else callback.onError("PDF生成失败");

            } catch (Exception e) {
                Log.e(TAG, "下载失败", e);
                callback.onError("下载失败: " + e.getMessage());
            }
        });
    }

    private String getComicInfo(String albumId) {
        for (String domain : DOMAINS) {
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                String httpsUrl = "https://" + domain + "/album/" + albumId;
                try {
                    String response = httpGet(httpsUrl);
                    if (response != null && response.contains("album")) return response;
                } catch (Exception e) {
                    Log.w(TAG, "HTTPS 访问失败: " + httpsUrl + " -> " + e.getMessage());
                }

                String httpUrl = "http://" + domain + "/album/" + albumId;
                try {
                    String response = httpGet(httpUrl);
                    if (response != null && response.contains("album")) return response;
                } catch (Exception e) {
                    Log.w(TAG, "HTTP 访问失败: " + httpUrl + " -> " + e.getMessage());
                }

                try { Thread.sleep(500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); return null; }
            }
        }
        return null;
    }

    private String httpGet(String urlString) throws IOException {
        URL url = new URL(urlString);
        HttpURLConnection connection;

        if (enableProxy && proxyAddress != null && proxyAddress.contains(":")) {
            try {
                String[] parts = proxyAddress.split(":" );
                Proxy proxy = new Proxy(Proxy.Type.HTTP, new InetSocketAddress(parts[0], Integer.parseInt(parts[1])));
                connection = (HttpURLConnection) url.openConnection(proxy);
            } catch (Exception e) {
                Log.w(TAG, "解析代理失败，回退直连: " + e.getMessage());
                connection = (HttpURLConnection) url.openConnection();
            }
        } else {
            connection = (HttpURLConnection) url.openConnection();
        }

        connection.setRequestMethod("GET");
        connection.setConnectTimeout(timeout);
        connection.setReadTimeout(timeout);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");

        int responseCode = connection.getResponseCode();
        if (responseCode == 200) {
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) sb.append(line).append('\n');
                return sb.toString();
            }
        }
        Log.w(TAG, "HTTP 请求返回代码: " + responseCode + " for " + urlString);
        return null;
    }

    private List<String> parseChapters(String html, String albumId) {
        Set<String> chapters = new LinkedHashSet<>();
        try {
            int ulStart = html.indexOf("<ul class=\"chapter-list\"");
            int ulEnd = ulStart != -1 ? html.indexOf("</ul>", ulStart) : -1;
            String listHtml = (ulStart != -1 && ulEnd != -1) ? html.substring(ulStart, ulEnd) : null;

            if (listHtml != null) {
                int startIndex = 0;
                while ((startIndex = listHtml.indexOf("/photo/", startIndex)) != -1) {
                    int endIndex = listHtml.indexOf('"', startIndex);
                    if (endIndex == -1) endIndex = listHtml.indexOf('\'', startIndex);
                    if (endIndex == -1) endIndex = listHtml.indexOf('>', startIndex);
                    if (endIndex > startIndex) {
                        String link = listHtml.substring(startIndex, endIndex);
                        String id = link.replace("/photo/", "").replaceAll("[^\\d]", "");
                        if (!id.isEmpty()) chapters.add(id);
                    }
                    startIndex = Math.max(endIndex, startIndex + 1);
                }
            }

            if (chapters.isEmpty()) {
                int idx = html.indexOf("/photo/");
                if (idx != -1) {
                    int endIdx = html.indexOf('"', idx);
                    if (endIdx == -1) endIdx = html.indexOf('\'', idx);
                    if (endIdx == -1) endIdx = html.indexOf('>', idx);
                    if (endIdx > idx) {
                        String link = html.substring(idx, endIdx);
                        String id = link.replace("/photo/", "").replaceAll("[^\\d]", "");
                        if (!id.isEmpty()) chapters.add(id);
                    }
                }
            }

            if (chapters.isEmpty() && albumId != null && !albumId.isEmpty()) chapters.add(albumId);
        } catch (Exception e) {
            Log.w(TAG, "解析章节失败", e);
        }
        return new ArrayList<>(chapters);
    }

    private List<String> getImageUrls(String chapterId, DownloadCallback callback) {
        List<String> imgUrls = new ArrayList<>();
        String chapterHtml = getChapterInfo(chapterId, callback);
        if (chapterHtml == null) return imgUrls;

        java.util.regex.Pattern pageArrPattern = java.util.regex.Pattern.compile("var page_arr = (\\[.*?]);");
        java.util.regex.Matcher pageArrMatcher = pageArrPattern.matcher(chapterHtml);

        String[] imageNames = null;
        if (pageArrMatcher.find()) {
            String pageArrStr = pageArrMatcher.group(1);
            if (pageArrStr != null) {
                java.util.regex.Pattern namePattern = java.util.regex.Pattern.compile("\"([^\"]+)\"");
                java.util.regex.Matcher nameMatcher = namePattern.matcher(pageArrStr);
                List<String> names = new ArrayList<>();
                while (nameMatcher.find()) names.add(nameMatcher.group(1));
                imageNames = names.toArray(new String[0]);
            }
        }

        java.util.regex.Pattern domainPattern = java.util.regex.Pattern.compile("data-original=\"(.*?)\"[^>]*?id=\"album_photo[^>]*?data-page=\"0\"");
        java.util.regex.Matcher domainMatcher = domainPattern.matcher(chapterHtml);
        String baseUrl = null;
        if (domainMatcher.find()) {
            String firstImageUrl = domainMatcher.group(1);
            if (firstImageUrl != null) {
                int lastSlash = firstImageUrl.lastIndexOf('/');
                if (lastSlash > 0) baseUrl = firstImageUrl.substring(0, lastSlash + 1);
            }
        }

        if (imageNames != null && baseUrl != null) {
            for (String name : imageNames) imgUrls.add(baseUrl + name);
            callback.onProgress(60, "精确解析到图片数: " + imgUrls.size());
            return imgUrls;
        }

        java.util.regex.Pattern scramblePattern = java.util.regex.Pattern.compile("var scramble_id = (\\d+);");
        java.util.regex.Matcher scrambleMatcher = scramblePattern.matcher(chapterHtml);
        String scrambleId = scrambleMatcher.find() ? scrambleMatcher.group(1) : "";

        java.util.regex.Pattern aidPattern = java.util.regex.Pattern.compile("var aid = (\\d+);");
        java.util.regex.Matcher aidMatcher = aidPattern.matcher(chapterHtml);
        String aid = aidMatcher.find() ? aidMatcher.group(1) : "";

        if (!scrambleId.isEmpty() && !aid.isEmpty()) {
            java.util.regex.Pattern countPattern = java.util.regex.Pattern.compile("var total_pics = (\\d+);");
            java.util.regex.Matcher countMatcher = countPattern.matcher(chapterHtml);
            int imgCount = 0;
            if (countMatcher.find()) imgCount = Integer.parseInt(countMatcher.group(1));
            else if (imageNames != null) imgCount = imageNames.length;

            for (int i = 1; i <= imgCount; i++) {
                imgUrls.add(String.format(Locale.US, "https://cdn-msp.jmapiproxy.cc/media/photos/%s/%05d.jpg", aid, i));
            }
            callback.onProgress(60, "降级解析到图片数: " + imgUrls.size());
            return imgUrls;
        }

        callback.onProgress(60, "最终解析到图片数: " + imgUrls.size());
        return imgUrls;
    }

    private String getChapterInfo(String chapterId, DownloadCallback callback) {
        for (String domain : DOMAINS) {
            for (int attempt = 1; attempt <= maxRetries; attempt++) {
                String httpsUrl = "https://" + domain + "/photo/" + chapterId;
                try {
                    callback.onProgress(50, "获取章节: " + httpsUrl + " （第" + attempt + "次）");
                    String resp = httpGet(httpsUrl);
                    if (resp != null && (resp.contains("scramble_id") || resp.contains("img_list"))) return resp;
                } catch (Exception e) {
                    Log.w(TAG, "HTTPS 章节访问失败: " + httpsUrl + " -> " + e.getMessage());
                }

                String httpUrl = "http://" + domain + "/photo/" + chapterId;
                try {
                    callback.onProgress(50, "回退尝试章节: " + httpUrl + " （第" + attempt + "次）");
                    String resp = httpGet(httpUrl);
                    if (resp != null && (resp.contains("scramble_id") || resp.contains("img_list"))) return resp;
                } catch (Exception e) {
                    Log.w(TAG, "HTTP 章节访问失败: " + httpUrl + " -> " + e.getMessage());
                }

                try { Thread.sleep(1000); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); return null; }
            }
        }
        return null;
    }

    private String downloadAndCreatePDF(String albumId, String title, List<String> chapters, DownloadCallback callback) {
        try {
            File tempDir = new File(downloadDir, "temp_" + sanitizeFilename(title) + "_" + albumId + "_" + System.currentTimeMillis());
            if (!tempDir.mkdirs()) Log.w(TAG, "创建临时目录失败: " + tempDir.getAbsolutePath());

            List<File> allImages = new ArrayList<>();
            for (int ci = 0; ci < chapters.size(); ci++) {
                String chapterId = chapters.get(ci);
                callback.onProgress(40 + (int)(30.0 * ci / chapters.size()), "下载章节 " + (ci + 1) + "/" + chapters.size());

                List<String> imageUrls = getImageUrls(chapterId, callback);
                if (imageUrls.isEmpty()) continue;

                File chapterDir = new File(tempDir, String.format(Locale.US, "chapter_%03d", ci + 1));
                if (!chapterDir.exists()) chapterDir.mkdirs();

                List<File> imgs = downloadImages(imageUrls, chapterDir, callback, chapterId);
                allImages.addAll(imgs);
            }

            if (allImages.isEmpty()) { callback.onError("未下载到任何图片"); return null; }

            callback.onProgress(75, "开始合并PDF，共 " + allImages.size() + " 张图片");

            String pdfName = sanitizeFilename(title) + "_" + albumId + ".pdf";
            File pdfFile = new File(downloadDir, pdfName);
            boolean ok = createPDF(allImages, pdfFile, callback);

            // 清理临时目录
            deleteDirectory(tempDir);

            return ok ? pdfFile.getAbsolutePath() : null;
        } catch (Exception e) {
            Log.e(TAG, "downloadAndCreatePDF 失败", e);
            return null;
        }
    }

    private byte[] downloadImageData(String url) throws IOException {
        URL imgUrl = new URL(url);
        HttpURLConnection connection;
        if (enableProxy && proxyAddress != null && proxyAddress.contains(":")) {
            try {
                String[] parts = proxyAddress.split(":" );
                Proxy proxy = new Proxy(Proxy.Type.HTTP, new InetSocketAddress(parts[0], Integer.parseInt(parts[1])));
                connection = (HttpURLConnection) imgUrl.openConnection(proxy);
            } catch (Exception e) {
                Log.w(TAG, "图片下载代理解析失败，回退直连: " + e.getMessage());
                connection = (HttpURLConnection) imgUrl.openConnection();
            }
        } else {
            connection = (HttpURLConnection) imgUrl.openConnection();
        }

        connection.setRequestMethod("GET");
        connection.setConnectTimeout(timeout);
        connection.setReadTimeout(timeout);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36");
        connection.setRequestProperty("Referer", "https://18comic.vip/");
        connection.setRequestProperty("Accept", "image/webp,image/apng,image/*,*/*;q=0.8");

        int code = connection.getResponseCode();
        if (code != 200) throw new IOException("HTTP错误: " + code + " for " + url);

        try (InputStream is = connection.getInputStream(); ByteArrayOutputStream baos = new ByteArrayOutputStream()) {
            byte[] buf = new byte[8192];
            int len;
            while ((len = is.read(buf)) != -1) baos.write(buf, 0, len);
            return baos.toByteArray();
        }
    }

    private int getScrambleIdFromChapter(String chapterId) {
        try {
            String html = getChapterInfo(chapterId, new DownloadCallback() {
                @Override public void onProgress(int p, String m) {}
                @Override public void onSuccess(String f) {}
                @Override public void onError(String e) {}
            });
            if (html != null) {
                java.util.regex.Pattern p = java.util.regex.Pattern.compile("var scramble_id = (\\d+);");
                java.util.regex.Matcher m = p.matcher(html);
                if (m.find()) return Integer.parseInt(m.group(1));
            }
        } catch (Exception e) {
            Log.w(TAG, "获取scramble_id失败: " + chapterId, e);
        }
        return 0;
    }

    private List<File> downloadImages(List<String> imgUrls, File targetDir, DownloadCallback callback, String chapterId) {
        List<File> files = Collections.synchronizedList(new ArrayList<>());
        int total = imgUrls.size();
        int maxWorkers = Math.max(2, Runtime.getRuntime().availableProcessors() * 2);
        maxWorkers = Math.min(maxWorkers, Math.min(64, Math.max(1, total)));

        java.util.concurrent.ExecutorService exec = java.util.concurrent.Executors.newFixedThreadPool(maxWorkers);
        List<java.util.concurrent.Future<File>> futures = new ArrayList<>();

        // 获取章节级别的 scrambleId（避免对每张图都发请求）
        final int chapterScrambleId = getScrambleIdFromChapter(chapterId);
        for (int i = 0; i < total; i++) {
            final int idx = i;
            final String url = imgUrls.get(i);
            futures.add(exec.submit(() -> {
                String lower = url.toLowerCase(Locale.ROOT);
                boolean isWebp = lower.endsWith(".webp");
                String outName = isWebp ? String.format(Locale.US, "img_%03d.png", idx + 1) : String.format(Locale.US, "img_%03d%s", idx + 1, getFileExtension(url));
                File outFile = new File(targetDir, outName);

                for (int attempt = 1; attempt <= maxRetries; attempt++) {
                    try {
                        byte[] imageData = downloadImageData(url);
                        if (imageData == null || imageData.length == 0) throw new IOException("下载的图片数据为空");

                        // 计算分割数（可能为0），基于chapterScrambleId与图片url
                        int num = getNumByUrl(chapterScrambleId, url);

                        if (lower.endsWith(".gif")) {
                            // gif 不解密，直接保存原始字节
                            try (FileOutputStream fos = new FileOutputStream(outFile)) { fos.write(imageData); }
                            return outFile;
                        }

                        if (isWebp) {
                            // webp 先解码为Bitmap，webp通常不需要分割重组，但也支持重组流程
                            Bitmap bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.length);
                            if (bitmap == null) throw new IOException("webp解码失败");

                            // 如果需要重组则调用decodeAndSave，否则直接保存为PNG
                            if (num > 0) {
                                decodeAndSave(num, bitmap, outFile, ".png");
                            } else {
                                try (FileOutputStream fos = new FileOutputStream(outFile)) {
                                    bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
                                }
                            }
                            bitmap.recycle();
                            return outFile;
                        }

                        // 其他格式（jpg/png等）
                        if (num > 0) {
                            // 需要重组：把字节解码为Bitmap，然后重组并保存
                            Bitmap bitmap = BitmapFactory.decodeByteArray(imageData, 0, imageData.length);
                            if (bitmap == null) throw new IOException("图片解码失败，无法重组");
                            // 根据源url后缀决定输出格式（使用原后缀）
                            String ext = getFileExtension(url);
                            decodeAndSave(num, bitmap, outFile, ext);
                            bitmap.recycle();
                            return outFile;
                        }

                        // 无需重组，直接保存原始字节（效率最高）
                        try (FileOutputStream fos = new FileOutputStream(outFile)) { fos.write(imageData); }
                        return outFile;

                    } catch (Exception e) {
                        Log.w(TAG, "图片处理失败(重试 " + attempt + ") : " + url + " -> " + e.getMessage());
                        if (attempt == maxRetries) throw e;
                        try { Thread.sleep(500); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
                    }
                }
                return null;
            }));
        }

        int done = 0;
        for (int i = 0; i < futures.size(); i++) {
            java.util.concurrent.Future<File> f = futures.get(i);
            try {
                File out = f.get();
                if (out != null) files.add(out);
                else Log.w(TAG, "图片任务返回空文件: " + imgUrls.get(i));
            } catch (Exception e) {
                Log.w(TAG, "图片下载任务异常: " + imgUrls.get(i), e);
            } finally {
                done++;
                callback.onProgress(70 + (int)(30.0 * done / Math.max(1, total)), "已处理图片: " + done + "/" + total);
            }
        }

        exec.shutdown();
        try { exec.awaitTermination(30, java.util.concurrent.TimeUnit.SECONDS); } catch (InterruptedException ignored) { Thread.currentThread().interrupt(); }
        return new ArrayList<>(files);
    }

    private boolean createPDF(List<File> imageFiles, File pdfFile, DownloadCallback callback) {
        PdfDocument pdf = new PdfDocument();
        Paint paint = new Paint();
        final int PAGE_WIDTH = 595; // points
        final int PAGE_HEIGHT = 842;

        try {
            int totalFiles = imageFiles.size();
            for (int i = 0; i < totalFiles; i++) {
                File imageFile = imageFiles.get(i);
                if (!imageFile.exists() || !imageFile.isFile()) continue;

                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inJustDecodeBounds = true;
                BitmapFactory.decodeFile(imageFile.getAbsolutePath(), opts);

                int imgW = opts.outWidth; int imgH = opts.outHeight;
                opts.inSampleSize = 1; opts.inJustDecodeBounds = false;
                if (imgW > PAGE_WIDTH * 2 || imgH > PAGE_HEIGHT * 2) {
                    int scaleW = Math.max(1, imgW / (PAGE_WIDTH * 2));
                    int scaleH = Math.max(1, imgH / (PAGE_HEIGHT * 2));
                    opts.inSampleSize = Math.max(scaleW, scaleH);
                }

                Bitmap bitmap = BitmapFactory.decodeFile(imageFile.getAbsolutePath(), opts);
                if (bitmap == null) { Log.w(TAG, "无法解码图片用于PDF: " + imageFile.getAbsolutePath()); continue; }

                float scale = Math.min((float) PAGE_WIDTH / bitmap.getWidth(), (float) PAGE_HEIGHT / bitmap.getHeight());
                int drawW = Math.round(bitmap.getWidth() * scale);
                int drawH = Math.round(bitmap.getHeight() * scale);

                PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, i + 1).create();
                PdfDocument.Page page = pdf.startPage(pageInfo);
                Canvas canvas = page.getCanvas();

                canvas.drawColor(0xFFFFFFFF);
                int offsetX = (PAGE_WIDTH - drawW) / 2;
                int offsetY = (PAGE_HEIGHT - drawH) / 2;

                Bitmap scaled = Bitmap.createScaledBitmap(bitmap, drawW, drawH, true);
                canvas.drawBitmap(scaled, offsetX, offsetY, paint);
                pdf.finishPage(page);

                scaled.recycle(); bitmap.recycle();

                callback.onProgress(75 + (int)(20.0 * (i + 1) / totalFiles), "生成PDF页: " + (i + 1) + "/" + totalFiles);
            }

            try (FileOutputStream fos = new FileOutputStream(pdfFile)) { pdf.writeTo(fos); }
            Log.i(TAG, "PDF创建成功: " + pdfFile.getAbsolutePath());
            return true;
        } catch (Exception e) {
            Log.e(TAG, "创建PDF失败", e);
            return false;
        } finally { pdf.close(); }
    }

    // 新增：图片解密/重组相关方法
    // （确保在文件中只有一份该实现）
    private int getNum(int scrambleId, int aid, String filename) {
        // 与 Python JmImageTool.get_num 行为一致
        try {
            if (aid < scrambleId) return 0;
            if (aid < 268850) return 10;
            int x = aid < 421926 ? 10 : 8;
            String s = md5Hex(String.valueOf(aid) + filename);
            if (s == null || s.length() == 0) return 0;
            char last = s.charAt(s.length() - 1);
            int v = (int) last;
            v = v % x;
            v = v * 2 + 2;
            return v;
        } catch (Exception e) {
            Log.w(TAG, "getNum 计算失败", e);
            return 0;
        }
    }

    private int getNumByUrl(int scrambleId, String url) {
        if (url == null) return 0;
        try {
            // 解析 aid：/media/photos/{aid}/
            java.util.regex.Pattern p = java.util.regex.Pattern.compile("/media/photos/(\\d+)/");
            java.util.regex.Matcher m = p.matcher(url);
            int aid = -1;
            if (m.find()) {
                aid = Integer.parseInt(m.group(1));
            } else {
                // 备用：提取第一个数字序列
                java.util.regex.Pattern p2 = java.util.regex.Pattern.compile("(\\d+)");
                java.util.regex.Matcher m2 = p2.matcher(url);
                if (m2.find()) aid = Integer.parseInt(m2.group(1));
            }

            if (aid == -1) return 0;
            // 解析文件名（不含后缀）
            String name = url;
            int q = name.indexOf('?'); if (q != -1) name = name.substring(0, q);
            int lastSlash = name.lastIndexOf('/'); String fname = lastSlash != -1 ? name.substring(lastSlash + 1) : name;
            int lastDot = fname.lastIndexOf('.'); if (lastDot != -1) fname = fname.substring(0, lastDot);

            return getNum(scrambleId, aid, fname);
        } catch (Exception e) {
            Log.w(TAG, "getNumByUrl 失败: " + url, e);
            return 0;
        }
    }

    private String md5Hex(String input) {
        try {
            java.security.MessageDigest md = java.security.MessageDigest.getInstance("MD5");
            byte[] digest = md.digest(input.getBytes("UTF-8"));
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b & 0xff));
            return sb.toString();
        } catch (Exception e) {
            Log.w(TAG, "md5Hex 失败", e);
            return null;
        }
    }

    private File decodeAndSave(int num, Bitmap src, File outFile, String outExt) throws IOException {
        if (num == 0) {
            // 直接保存
            try (FileOutputStream fos = new FileOutputStream(outFile)) {
                Bitmap.CompressFormat fmt = outExt != null && outExt.equalsIgnoreCase(".png") ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG;
                src.compress(fmt, 100, fos);
            }
            return outFile;
        }

        int w = src.getWidth();
        int h = src.getHeight();

        Bitmap decoded = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(decoded);

        int over = h % num;
        int baseMove = h / num;

        for (int i = 0; i < num; i++) {
            int move = baseMove;
            int y_src = h - (baseMove * (i + 1)) - over;
            int y_dst = baseMove * i;

            if (i == 0) {
                move += over;
            } else {
                y_dst += over;
            }

            if (y_src < 0) y_src = 0;
            if (y_src + move > h) move = h - y_src;

            Bitmap piece = Bitmap.createBitmap(src, 0, y_src, w, move);
            canvas.drawBitmap(piece, 0, y_dst, null);
            piece.recycle();
        }

        // 保存解密后的图片
        try (FileOutputStream fos = new FileOutputStream(outFile)) {
            Bitmap.CompressFormat fmt = outExt != null && outExt.equalsIgnoreCase(".png") ? Bitmap.CompressFormat.PNG : Bitmap.CompressFormat.JPEG;
            decoded.compress(fmt, 95, fos);
        }

        decoded.recycle();
        return outFile;
    }

    private String getFileExtension(String filenameOrUrl) {
        if (filenameOrUrl == null) return ".jpg";
        String s = filenameOrUrl;
        int q = s.indexOf('?'); if (q != -1) s = s.substring(0, q);
        int h = s.indexOf('#'); if (h != -1) s = s.substring(0, h);
        int lastSlash = s.lastIndexOf('/'); String name = lastSlash != -1 ? s.substring(lastSlash + 1) : s;
        int lastDot = name.lastIndexOf('.'); if (lastDot == -1) return ".jpg";
        String ext = name.substring(lastDot).toLowerCase(Locale.ROOT);
        if (ext.length() > 6 || ext.contains("/") || ext.contains("\\")) return ".jpg";
        return ext;
    }

    private void ensureStoragePermissions() {
        try {
            if (!downloadDir.exists()) {
                boolean created = downloadDir.mkdirs();
                Log.i(TAG, "创建下载目录: " + downloadDir.getAbsolutePath() + ", 结果: " + created);
            }
            File test = new File(downloadDir, ".test");
            try { test.createNewFile(); test.delete(); } catch (IOException e) { Log.w(TAG, "无法写入下载目录: " + downloadDir.getAbsolutePath(), e); }
        } catch (Exception e) { Log.e(TAG, "ensureStoragePermissions error", e); }
    }

    private void deleteDirectory(File dir) {
        if (dir == null || !dir.exists()) return;
        if (dir.isDirectory()) {
            File[] children = dir.listFiles();
            if (children != null) {
                for (File c : children) deleteDirectory(c);
            }
        }
        dir.delete();
    }

    private String sanitizeFilename(String filename) {
        if (filename == null) return "untitled";
        // 使用字符数组避免对字符串字面量转义导致的语法错误
        char[] badChars = new char[] {'<', '>', ':', '"', '/', '\\', '|', '?', '*'};
        StringBuilder sb = new StringBuilder(filename.length());
        outer: for (char c : filename.toCharArray()) {
            for (char b : badChars) {
                if (c == b) {
                    sb.append('_');
                    continue outer;
                }
            }
            sb.append(c);
        }
        String s = sb.toString().trim();
        if (s.isEmpty()) return "untitled";
        if (s.length() > 200) s = s.substring(0, 200);
        return s;
    }

    public void cleanup() { if (executor != null && !executor.isShutdown()) executor.shutdownNow(); }
}
