package com.jmfmobile;

import android.content.Intent;
import android.net.Uri;
import androidx.annotation.Nullable;
import androidx.documentfile.provider.DocumentFile;
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
        DocumentFile dir = resolveDocumentFile(treeUriStr, relativePath);
        if (dir == null || !dir.isDirectory()) {
            JSObject result = new JSObject();
            result.put("entries", new JSArray());
            call.resolve(result);
            return;
        }
        DocumentFile[] children = dir.listFiles();
        JSArray entries = new JSArray();
        if (children != null) {
            for (DocumentFile child : children) {
                JSObject entry = new JSObject();
                entry.put("name", child.getName());
                entry.put("type", child.isDirectory() ? "directory" : "file");
                entries.put(entry);
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
        DocumentFile file = resolveDocumentFile(treeUriStr, relativePath);
        if (file == null || !file.isFile()) {
            call.reject("file not found");
            return;
        }
        try (InputStream in = getContext().getContentResolver().openInputStream(file.getUri());
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
        DocumentFile file = resolveDocumentFile(treeUriStr, relativePath);
        if (file == null) {
            call.reject("entry not found");
            return;
        }
        JSObject result = new JSObject();
        result.put("uri", file.getUri().toString());
        call.resolve(result);
    }

    @Nullable
    private DocumentFile resolveDocumentFile(String treeUriStr, String relativePath) {
        Uri treeUri = Uri.parse(treeUriStr);
        DocumentFile current = DocumentFile.fromTreeUri(getContext(), treeUri);
        if (current == null) {
            return null;
        }
        if (relativePath == null || relativePath.isEmpty()) {
            return current;
        }
        for (String segment : relativePath.split("/")) {
            if (segment.isEmpty()) {
                continue;
            }
            DocumentFile next = current.findFile(segment);
            if (next == null) {
                return null;
            }
            current = next;
        }
        return current;
    }
}
