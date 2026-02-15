import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface LazyImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  fallback?: string;
  wrapperClassName?: string;
}

/**
 * LazyImage — loads images with loading="lazy", a blurred placeholder,
 * and a smooth fade-in transition once the full image has loaded.
 */
export default function LazyImage({
  src,
  alt,
  fallback = "https://placehold.co/400x400/png?text=No+Image",
  className,
  wrapperClassName,
  ...props
}: LazyImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // If the image is already cached by the browser, mark as loaded immediately
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current?.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  const handleLoad = () => setLoaded(true);
  const handleError = () => {
    setError(true);
    setLoaded(true);
  };

  return (
    <div className={cn("relative overflow-hidden", wrapperClassName)}>
      {/* Low-res blurred placeholder background */}
      <div
        className={cn(
          "absolute inset-0 bg-muted animate-pulse transition-opacity duration-500",
          loaded ? "opacity-0" : "opacity-100"
        )}
        aria-hidden="true"
      />

      {/* Actual image */}
      <img
        ref={imgRef}
        src={error ? fallback : src}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        className={cn(
          "transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
          className
        )}
        {...props}
      />
    </div>
  );
}
