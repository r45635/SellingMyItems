"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { BLUR_PLACEHOLDER } from "@/lib/image/placeholders";

interface ImageCarouselProps {
  images: { url: string; hdUrl?: string; alt?: string }[];
  title: string;
}

export function ImageCarousel({ images, title }: ImageCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [hdLoaded, setHdLoaded] = useState(false);
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

  // Reset HD loaded state when current image changes
  useEffect(() => {
    setHdLoaded(false);
  }, [current]);

  // Keyboard navigation — only active while overlay is open
  useEffect(() => {
    if (!zoomed) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [zoomed, prev, next]);

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
    <div>
      {/* Main image with navigation */}
      <div
        className="aspect-video relative bg-muted group select-none cursor-zoom-in"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => setZoomed(true)}
      >
        {/* All images stacked — pre-loaded eagerly so navigation is instant (opacity switch, no network request) */}
        {images.map((img, idx) => (
          <Image
            key={idx}
            src={img.url}
            alt={idx === current ? (img.alt ?? `${title} ${idx + 1}`) : ""}
            fill
            className={cn(
              "object-contain transition-opacity duration-150",
              idx === current ? "opacity-100" : "opacity-0"
            )}
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={idx === 0}
            loading="eager"
            placeholder="blur"
            blurDataURL={BLUR_PLACEHOLDER}
            aria-hidden={idx !== current}
          />
        ))}

        {/* Counter badge — overlay on image, bottom-right */}
        {images.length > 1 && (
          <span className="absolute bottom-3 right-3 bg-black/50 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {current + 1} / {images.length}
          </span>
        )}

        {/* Prev / Next arrows (visible on hover or always on touch) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); prev(); }}
              className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity sm:p-2"
              aria-label="Previous image"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); next(); }}
              className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/40 hover:bg-black/60 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity sm:p-2"
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
                onClick={(e) => { e.stopPropagation(); goTo(idx); }}
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

      {/* Thumbnail strip — flush 4-col grid, no padding/gap */}
      {images.length > 1 && (
        <div className="grid grid-cols-4 gap-px bg-border">
          {images.map((img, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => goTo(idx)}
              className={cn(
                "relative aspect-square overflow-hidden",
                idx === current && "ring-2 ring-orange-500 ring-inset"
              )}
              aria-label={`Show image ${idx + 1}`}
            >
              <Image
                src={img.url}
                alt={img.alt ?? `${title} ${idx + 1}`}
                fill
                className="object-cover w-full h-full"
                sizes="(max-width: 768px) 25vw, 15vw"
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
          {/* Close button — stopPropagation so it doesn't re-trigger the overlay onClick */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setZoomed(false); }}
            className="absolute top-4 right-4 text-white bg-black/50 rounded-full p-2 hover:bg-black/70 z-20"
            aria-label="Close"
          >
            <X className="h-6 w-6" />
          </button>

          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prev(); }}
                className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-20"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); next(); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 z-20"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Spinner while HD image loads */}
          {!hdLoaded && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <Loader2 className="h-10 w-10 text-white/70 animate-spin" />
            </div>
          )}

          {/* Image container — stopPropagation prevents clicking image from closing overlay */}
          <div
            className="relative w-full h-full max-w-[90vw] max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={images[current].hdUrl ?? images[current].url}
              alt={images[current].alt ?? `${title} ${current + 1}`}
              fill
              className={cn("object-contain transition-opacity duration-300", hdLoaded ? "opacity-100" : "opacity-0")}
              sizes="90vw"
              priority
              onLoad={() => setHdLoaded(true)}
            />
          </div>

          {images.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-3 py-1 rounded-full pointer-events-none z-10">
              {current + 1} / {images.length}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
