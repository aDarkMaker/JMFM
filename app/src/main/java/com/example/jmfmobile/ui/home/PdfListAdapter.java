package com.example.jmfmobile.ui.home;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;
import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;
import java.io.File;
import java.util.List;

public class PdfListAdapter extends RecyclerView.Adapter<PdfListAdapter.ViewHolder> {
    public interface OnPdfClickListener {
        void onPdfClick(File file);
    }

    private final List<File> pdfFiles;
    private final OnPdfClickListener listener;

    public PdfListAdapter(List<File> pdfFiles, OnPdfClickListener listener) {
        this.pdfFiles = pdfFiles;
        this.listener = listener;
    }

    @NonNull
    @Override
    public ViewHolder onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        View view = LayoutInflater.from(parent.getContext())
                .inflate(android.R.layout.simple_list_item_1, parent, false);
        return new ViewHolder(view);
    }

    @Override
    public void onBindViewHolder(@NonNull ViewHolder holder, int position) {
        File file = pdfFiles.get(position);
        holder.textView.setText(file.getName());
        holder.itemView.setOnClickListener(v -> {
            if (listener != null) {
                listener.onPdfClick(file);
            }
        });
    }

    @Override
    public int getItemCount() {
        return pdfFiles.size();
    }

    static class ViewHolder extends RecyclerView.ViewHolder {
        TextView textView;
        ViewHolder(View itemView) {
            super(itemView);
            textView = itemView.findViewById(android.R.id.text1);
        }
    }
}
