package com.jmfmobile;

import android.content.ContentResolver;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import androidx.annotation.Nullable;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
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
        if (!documentExists(treeUri, targetDocId)) {
            call.reject("entry not found");
            return;
        }
        JSObject result = new JSObject();
        result.put("uri", docUri.toString());
        call.resolve(result);
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
            return cursor != null && cursor.getCount() > 0;
        } catch (Exception ex) {
            return false;
        }
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
