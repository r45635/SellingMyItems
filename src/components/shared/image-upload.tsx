"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, X, ImagePlus, Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import imageCompression from "browser-image-compression";

interface ImageUploadProps {
  images: string[];
  onChange: (images: string[]) => void;
  maxImages?: number;
}

export function ImageUpload({
  images,
  onChange,
  maxImages = 10,
}: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");
  const [error, setError] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [confirmDeleteIndex, setConfirmDeleteIndex] = useState<number | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const remaining = maxImages - images.length;
      if (remaining <= 0) {
        setError(`Maximum ${maxImages} images`);
        return;
      }

      const toUpload = files.slice(0, remaining);
      setIsUploading(true);
      setError("");

      try {
        // Compress images client-side before upload
        setUploadStatus(`Compression de ${toUpload.length} image${toUpload.length > 1 ? "s" : ""}...`);
        const compressed = await Promise.all(
          toUpload.map((f) =>
            imageCompression(f, {
              maxSizeMB: 2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
              fileType: "image/webp",
            })
          )
        );

        setUploadStatus("Envoi en cours...");
        const formData = new FormData();
        compressed.forEach((f) => formData.append("files", f));

        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || "Erreur d'upload");
          return;
        }

        onChange([...images, ...data.urls]);
      } catch {
        setError("Erreur réseau lors de l'upload");
      } finally {
        setIsUploading(false);
        setUploadStatus("");
      }
    },
    [images, maxImages, onChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files).filter((f) =>
        f.type.startsWith("image/")
      );
      uploadFiles(files);
    },
    [uploadFiles]
  );

  const handlePaste = useCallback(
    (e: React.ClipboardEvent) => {
      const files = Array.from(e.clipboardData.files).filter((f) =>
        f.type.startsWith("image/")
      );
      if (files.length > 0) {
        e.preventDefault();
        uploadFiles(files);
      }
    },
    [uploadFiles]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files ?? []);
      uploadFiles(files);
      // Reset so same file can be re-selected
      e.target.value = "";
    },
    [uploadFiles]
  );

  const removeImage = useCallback(
    (index: number) => {
      onChange(images.filter((_, i) => i !== index));
      setConfirmDeleteIndex(null);
    },
    [images, onChange]
  );

  const moveImage = useCallback(
    (from: number, to: number) => {
      if (to < 0 || to >= images.length) return;
      const updated = [...images];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      onChange(updated);
    },
    [images, onChange]
  );

  const handleDragStart = useCallback((idx: number) => {
    setDraggedIndex(idx);
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    setDragOverIndex(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      moveImage(draggedIndex, dragOverIndex);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, [draggedIndex, dragOverIndex, moveImage]);

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      {/* Image grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          {images.map((url, idx) => (
            <div
              key={`${url}-${idx}`}
              className={`relative group aspect-square rounded-lg overflow-hidden border bg-muted transition-all ${
                draggedIndex === idx ? "opacity-40 scale-95" : ""
              } ${dragOverIndex === idx && draggedIndex !== idx ? "ring-2 ring-primary" : ""}`}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragEnter={() => handleDragEnter(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDragEnd={handleDragEnd}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={`Image ${idx + 1}`}
                className="w-full h-full object-cover pointer-events-none"
              />
              {idx === 0 && (
                <span className="absolute top-1 left-1 bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded">
                  Cover
                </span>
              )}
              {/* Mobile reorder arrows */}
              <div className="absolute bottom-1 left-1 flex gap-0.5 sm:hidden">
                {idx > 0 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6 shadow-md"
                    onClick={() => moveImage(idx, idx - 1)}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                )}
                {idx < images.length - 1 && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon"
                    className="h-6 w-6 shadow-md"
                    onClick={() => moveImage(idx, idx + 1)}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                )}
              </div>
              {/* Delete button with confirmation */}
              {confirmDeleteIndex === idx ? (
                <div className="absolute inset-0 bg-destructive/80 flex flex-col items-center justify-center gap-1.5 animate-in fade-in duration-150">
                  <p className="text-white text-xs font-medium">Supprimer ?</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setConfirmDeleteIndex(null)}
                    >
                      Non
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="h-7 px-2 text-xs bg-white text-destructive hover:bg-white/90"
                      onClick={() => removeImage(idx)}
                    >
                      Oui
                    </Button>
                  </div>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  size="icon"
                  className="absolute top-1 right-1 h-7 w-7 sm:h-6 sm:w-6 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shadow-md"
                  onClick={() => setConfirmDeleteIndex(idx)}
                >
                  <X className="h-4 w-4 sm:h-3 sm:w-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      {images.length < maxImages && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors
            ${isDragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50 hover:bg-muted/50"}
            ${isUploading ? "pointer-events-none opacity-60" : ""}
          `}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">{uploadStatus || "Traitement..."}</p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Upload className="h-6 w-6 text-muted-foreground" />
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">
                  Glisser-déposer, coller ou cliquer
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  JPEG, PNG, WebP, GIF, AVIF • Compression auto •{" "}
                  {images.length}/{maxImages}
                </p>
              </div>
            </>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
