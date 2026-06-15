import React, { useEffect, useRef, useState } from "react";

type CropPoint = {
  x: number;
  y: number;
};

type CroppedAreaPixels = {
  x: number;
  y: number;
  width: number;
  height: number;
};

interface SimpleImageCropperProps {
  image: string;
  crop: CropPoint;
  zoom: number;
  aspect?: number;
  cropShape?: "rect" | "round";
  showGrid?: boolean;
  style?: {
    containerStyle?: React.CSSProperties;
  };
  onCropChange: (crop: CropPoint) => void;
  onZoomChange?: (zoom: number) => void;
  onCropComplete?: (
    croppedArea: CroppedAreaPixels,
    croppedAreaPixels: CroppedAreaPixels
  ) => void;
}

type Size = {
  width: number;
  height: number;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export default function SimpleImageCropper({
  image,
  crop,
  zoom,
  aspect = 1,
  cropShape = "rect",
  showGrid = true,
  style,
  onCropChange,
  onCropComplete,
}: SimpleImageCropperProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ x: number; y: number } | null>(null);
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [containerSize, setContainerSize] = useState<Size>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = image;
  }, [image]);

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      setContainerSize({ width: rect.width, height: rect.height });
    };

    updateSize();
    const observer = new ResizeObserver(updateSize);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!imageSize || !containerSize.width || !containerSize.height) return;

    const baseScale = Math.max(
      containerSize.width / imageSize.width,
      containerSize.height / imageSize.height
    );
    const scaledWidth = imageSize.width * baseScale * zoom;
    const scaledHeight = imageSize.height * baseScale * zoom;

    const maxOffsetX = Math.max(0, (scaledWidth - containerSize.width) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - containerSize.height) / 2);

    const nextCrop = {
      x: clamp(crop.x, -maxOffsetX, maxOffsetX),
      y: clamp(crop.y, -maxOffsetY, maxOffsetY),
    };

    if (nextCrop.x !== crop.x || nextCrop.y !== crop.y) {
      onCropChange(nextCrop);
      return;
    }

    const left = (containerSize.width - scaledWidth) / 2 + crop.x;
    const top = (containerSize.height - scaledHeight) / 2 + crop.y;
    const scale = baseScale * zoom;

    const cropPixels = {
      x: clamp(-left / scale, 0, imageSize.width),
      y: clamp(-top / scale, 0, imageSize.height),
      width: clamp(containerSize.width / scale, 1, imageSize.width),
      height: clamp(containerSize.height / scale, 1, imageSize.height),
    };

    onCropComplete?.(cropPixels, cropPixels);
  }, [crop, zoom, imageSize, containerSize, onCropChange, onCropComplete]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      x: event.clientX - crop.x,
      y: event.clientY - crop.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStateRef.current) return;
    onCropChange({
      x: event.clientX - dragStateRef.current.x,
      y: event.clientY - dragStateRef.current.y,
    });
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    dragStateRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const cropFrameStyle: React.CSSProperties =
    aspect === 1
      ? { width: "min(22rem, calc(100% - 2rem))", aspectRatio: "1 / 1" }
      : { width: "calc(100% - 2rem)", aspectRatio: `${aspect}` };

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden touch-none"
      style={style?.containerStyle}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <img
        src={image}
        alt="Crop preview"
        draggable={false}
        className="absolute left-1/2 top-1/2 max-w-none select-none"
        style={{
          transform: `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${zoom})`,
          transformOrigin: "center center",
        }}
      />

      <div className="pointer-events-none absolute inset-0 bg-black/30" />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`relative border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] ${
            cropShape === "round" ? "rounded-full" : "rounded-xl"
          }`}
          style={cropFrameStyle}
        >
          {showGrid && (
            <>
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/40" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/40" />
              <div className="absolute top-1/3 left-0 h-px w-full bg-white/40" />
              <div className="absolute top-2/3 left-0 h-px w-full bg-white/40" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
