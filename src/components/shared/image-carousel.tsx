"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";

interface ImageCarouselProps {
  images: { url: string; alt?: string }[];
  title: string;
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const goTo = useCallback(
    (idx: number) => {
      setCurrent((idx + images.length) % images.length);
    },
    [images.length]
  );

  const prev = useCallback(() => goTo(current - 1), [current, goTo]);
  const next = useCallback(() => goTo(current + 1), [current, goTo]);

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [prev, next]);

  if (images.length === 0) {
    return (
      <div className="aspect-video relative bg-muted rounded-t-lg">
        <div className="flex items-center justify-center h-full">
          <ImageOff className="h-16 w-16 text-muted-foreground/40" />
        </div>
      </div>
    );
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = () => {
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) {
      if (diff > 0) next();
      else prev();
    }
  };

  return (
    <div className="space-y-2">
      {/* Main image with navigation */}
      <div
        className="aspect-video relative bg-muted group select-none cursor-pointer"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setZoomed(true)}
      >
        <Image
          src={images[current].url}
          alt={images[current].alt ?? `${title} ${current + 1}`}
          fill
          className="object-contain"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority={current === 0}
          loading={current === 0 ? "eager" : "lazy"}
          placeholder="blur"
          blurDataURL={BLUR_PLACEHOLDER}
        />

        {/* Counter badge */}
        {images.length > 1 && (
          <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
            {current + 1} / {images.length}
          </div>
        )}

        {/* Prev / Next arrows (visible on hover or always on touch) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prev}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity sm:p-2 touch:opacity-100"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={next}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity sm:p-2 touch:opacity-100"
              aria-label="Next image"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}

        {/* Dot indicators */}
        {images.length > 1 && images.length <= 10 && (
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goTo(idx)}
                className={cn(
                  "w-2 h-2 rounded-full transition-all",
                  idx === current
                    ? "bg-white scale-125"
                    : "bg-white/50 hover:bg-white/80"
                )}
                aria-label={`Go to image ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="flex gap-1 px-1 pb-1 overflow-x-auto scrollbar-hide">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                "relative shrink-0 w-14 h-14 sm:w-16 sm:h-16 rounded overflow-hidden border-2 transition-all",
                idx === current
                  ? "border-primary ring-1 ring-primary"
                  : "border-transparent opacity-70 hover:opacity-100"
              )}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} ${idx + 1}`}
                fill
                className="object-cover"
                sizes="64px"
                loading="lazy"
                placeholder="blur"
                blurDataURL={BLUR_PLACEHOLDER}
              />
            </button>
          ))}
        </div>
      )}

      {/* Fullscreen zoom overlay */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setZoomed(false)}
        >
          <button
            type="button"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 z-10"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-10"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
          <div className="relative w-full h-full max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={images[current].url}
              alt={images[current].alt ?? `${title} ${current + 1}`}
              fill
              className="object-contain"
              sizes="90vw"
              priority
            />
          </div>
          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full">
              {current + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
