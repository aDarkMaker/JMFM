package com.jmfmobile;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.annotation.Nullable;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "SafStorage")
public class SafStoragePlugin extends Plugin {

    @PluginMethod
    public void persistTreeUri(PluginCall call) {
        String uriStr = call.getString("uri");
        if (uriStr == null || uriStr.isEmpty()) {
            call.reject("uri required");
            return;
        }
        Uri uri = Uri.parse(uriStr);
        try {
            getContext()
                .getContentResolver()
                .takePersistableUriPermission(
                    uri,
                    Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION
                );
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "persistTreeUri failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void listDirectory(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        if (treeUriStr == null || treeUriStr.isEmpty()) {
            call.reject("treeUri required");
            return;
        }
        String relativePath = call.getString("relativePath", "");
        Uri treeUri = Uri.parse(treeUriStr);
        String targetDocId = docIdFor(treeUri, relativePath);
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, targetDocId);
        JSArray entries = new JSArray();
        try (Cursor cursor = getContext()
            .getContentResolver()
            .query(
                childrenUri,
                new String[] {
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                },
                null,
                null,
                null)) {
            if (cursor != null) {
                int nameIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                int mimeIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
                while (cursor.moveToNext()) {
                    String name = cursor.getString(nameIdx);
                    String mime = cursor.getString(mimeIdx);
                    JSObject entry = new JSObject();
                    entry.put("name", name);
                    entry.put("type", DocumentsContract.Document.MIME_TYPE_DIR.equals(mime) ? "directory" : "file");
                    entries.put(entry);
                }
            }
        }
        JSObject result = new JSObject();
        result.put("entries", entries);
        call.resolve(result);
    }

    @PluginMethod
    public void readTextFile(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docIdFor(treeUri, relativePath));
        try (InputStream in = getContext().getContentResolver().openInputStream(docUri);
            BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            char[] buffer = new char[4096];
            int read;
            while ((read = reader.read(buffer)) != -1) {
                sb.append(buffer, 0, read);
            }
            JSObject result = new JSObject();
            result.put("data", sb.toString());
            call.resolve(result);
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "readTextFile failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void readBinaryFile(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docIdFor(treeUri, relativePath));
        try (InputStream in = getContext().getContentResolver().openInputStream(docUri);
            ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            JSObject result = new JSObject();
            result.put("data", Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP));
            call.resolve(result);
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "readBinaryFile failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void getEntryUri(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        String targetDocId = docIdFor(treeUri, relativePath);
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, targetDocId);
        JSObject result = new JSObject();
        result.put("uri", docUri.toString());
        call.resolve(result);
    }

    @PluginMethod
    public void entryExists(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        String docId = docIdFor(treeUri, relativePath);
        JSObject result = new JSObject();
        result.put("exists", documentExists(treeUri, docId));
        call.resolve(result);
    }

    @PluginMethod
    public void ensureDirectory(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath", "");
        if (treeUriStr == null || treeUriStr.isEmpty()) {
            call.reject("treeUri required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        try {
            ensureDirectoryUri(treeUri, relativePath);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "ensureDirectory failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void writeFile(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        String data = call.getString("data");
        if (treeUriStr == null || relativePath == null || data == null) {
            call.reject("treeUri, relativePath and data required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        byte[] bytes = Base64.decode(data, Base64.DEFAULT);
        try {
            writeBytes(treeUri, relativePath, bytes);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "writeFile failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void deleteEntry(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        String docId = docIdFor(treeUri, relativePath);
        if (!documentExists(treeUri, docId)) {
            call.resolve();
            return;
        }
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), docUri);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "deleteEntry failed" : ex.getMessage());
        }
    }

    @PluginMethod
    public void deleteDirectory(PluginCall call) {
        String treeUriStr = call.getString("treeUri");
        String relativePath = call.getString("relativePath");
        if (treeUriStr == null || relativePath == null) {
            call.reject("treeUri and relativePath required");
            return;
        }
        Uri treeUri = Uri.parse(treeUriStr);
        try {
            deleteRecursive(treeUri, relativePath);
            call.resolve();
        } catch (Exception ex) {
            call.reject(ex.getMessage() == null ? "deleteDirectory failed" : ex.getMessage());
        }
    }

    private void deleteRecursive(Uri treeUri, String relativePath) throws Exception {
        String docId = docIdFor(treeUri, relativePath);
        if (!documentExists(treeUri, docId)) {
            return;
        }
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, docId);
        java.util.ArrayList<String> childNames = new java.util.ArrayList<>();
        try (Cursor cursor = getContext()
            .getContentResolver()
            .query(
                childrenUri,
                new String[] {DocumentsContract.Document.COLUMN_DISPLAY_NAME},
                null,
                null,
                null)) {
            if (cursor != null) {
                int nameIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
                while (cursor.moveToNext()) {
                    childNames.add(cursor.getString(nameIdx));
                }
            }
        }
        for (String name : childNames) {
            String childPath = relativePath.isEmpty() ? name : relativePath + "/" + name;
            deleteRecursive(treeUri, childPath);
        }
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
        if (!DocumentsContract.deleteDocument(getContext().getContentResolver(), docUri)) {
            throw new Exception("deleteDocument failed");
        }
    }

    private void writeBytes(Uri treeUri, String relativePath, byte[] bytes) throws Exception {
        int slash = relativePath.lastIndexOf('/');
        String parentPath = slash >= 0 ? relativePath.substring(0, slash) : "";
        String fileName = slash >= 0 ? relativePath.substring(slash + 1) : relativePath;
        Uri parentUri = ensureDirectoryUri(treeUri, parentPath);
        String parentDocId = docIdFor(treeUri, parentPath);
        Uri fileUri = findChildUri(treeUri, parentDocId, fileName, false);
        if (fileUri == null) {
            fileUri = DocumentsContract.createDocument(
                getContext().getContentResolver(),
                parentUri,
                mimeTypeForName(fileName),
                fileName
            );
        }
        if (fileUri == null) {
            throw new Exception("createDocument failed");
        }
        try (OutputStream out = getContext().getContentResolver().openOutputStream(fileUri, "wt")) {
            if (out == null) {
                throw new Exception("openOutputStream failed");
            }
            out.write(bytes);
        }
    }

    private Uri ensureDirectoryUri(Uri treeUri, String relativePath) throws Exception {
        String baseDocId = DocumentsContract.getTreeDocumentId(treeUri);
        if (relativePath == null || relativePath.isEmpty()) {
            return DocumentsContract.buildDocumentUriUsingTree(treeUri, baseDocId);
        }
        String currentDocId = baseDocId;
        Uri currentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, baseDocId);
        for (String segment : relativePath.split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            Uri childUri = findChildUri(treeUri, currentDocId, segment, true);
            if (childUri == null) {
                childUri = DocumentsContract.createDocument(
                    getContext().getContentResolver(),
                    currentUri,
                    DocumentsContract.Document.MIME_TYPE_DIR,
                    segment
                );
            }
            if (childUri == null) {
                throw new Exception("createDirectory failed: " + segment);
            }
            currentDocId = DocumentsContract.getDocumentId(childUri);
            currentUri = childUri;
        }
        return currentUri;
    }

    @Nullable
    private Uri findChildUri(Uri treeUri, String parentDocId, String name, boolean directory) {
        Uri childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, parentDocId);
        try (Cursor cursor = getContext()
            .getContentResolver()
            .query(
                childrenUri,
                new String[] {
                    DocumentsContract.Document.COLUMN_DOCUMENT_ID,
                    DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                    DocumentsContract.Document.COLUMN_MIME_TYPE,
                },
                null,
                null,
                null)) {
            if (cursor == null) {
                return null;
            }
            int docIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DOCUMENT_ID);
            int nameIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_DISPLAY_NAME);
            int mimeIdx = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_MIME_TYPE);
            while (cursor.moveToNext()) {
                if (!name.equals(cursor.getString(nameIdx))) {
                    continue;
                }
                String mime = cursor.getString(mimeIdx);
                boolean isDir = DocumentsContract.Document.MIME_TYPE_DIR.equals(mime);
                if (directory != isDir) {
                    continue;
                }
                String childDocId = cursor.getString(docIdx);
                return DocumentsContract.buildDocumentUriUsingTree(treeUri, childDocId);
            }
        }
        return null;
    }

    private boolean documentExists(Uri treeUri, String docId) {
        Uri docUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, docId);
        try (Cursor cursor = getContext()
            .getContentResolver()
            .query(
                docUri,
                new String[] {DocumentsContract.Document.COLUMN_DOCUMENT_ID},
                null,
                null,
                null)) {
            return cursor != null && cursor.moveToFirst();
        } catch (Exception ex) {
            return false;
        }
    }

    private String mimeTypeForName(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) {
            return "image/jpeg";
        }
        if (lower.endsWith(".png")) {
            return "image/png";
        }
        if (lower.endsWith(".webp")) {
            return "image/webp";
        }
        if (lower.endsWith(".gif")) {
            return "image/gif";
        }
        if (lower.endsWith(".json")) {
            return "application/json";
        }
        if (lower.endsWith(".pdf")) {
            return "application/pdf";
        }
        return "application/octet-stream";
    }

    private String docIdFor(Uri treeUri, String relativePath) {
        String base = DocumentsContract.getTreeDocumentId(treeUri);
        if (relativePath == null || relativePath.isEmpty()) {
            return base;
        }
        StringBuilder sb = new StringBuilder(base);
        for (String segment : relativePath.split("/")) {
            if (!segment.isEmpty()) {
                sb.append('/').append(segment);
            }
        }
        return sb.toString();
    }
}
