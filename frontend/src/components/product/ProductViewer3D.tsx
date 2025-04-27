import { useEffect, useRef } from 'react';
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ProductViewer3DProps {
  className?: string;
  productId: string;
}

// This is a placeholder component that shows how a 3D model viewer would be implemented
// In a real implementation, we would use a library like Three.js or React Three Fiber
export default function ProductViewer3D({ className, productId }: ProductViewer3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;
      }
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Simple animation to simulate 3D rotation
    const animate = () => {
      if (!ctx || !canvas) return;

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw a product placeholder that rotates
      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotationRef.current);

      // Draw product box (simulating a 3D object)
      const size = Math.min(canvas.width, canvas.height) * 0.4;
      ctx.fillStyle = 'rgba(99, 102, 241, 0.7)';
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 2;

      // Front face
      ctx.beginPath();
      ctx.rect(-size/2, -size/2, size, size);
      ctx.fill();
      ctx.stroke();

      // Perspective lines
      ctx.beginPath();
      ctx.moveTo(-size/2, -size/2);
      ctx.lineTo(-size/2 - 20, -size/2 - 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(size/2 + 20, -size/2 - 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(-size/2, size/2);
      ctx.lineTo(-size/2 - 20, size/2 + 20);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(size/2, size/2);
      ctx.lineTo(size/2 + 20, size/2 + 20);
      ctx.stroke();

      // Top face
      ctx.beginPath();
      ctx.moveTo(-size/2 - 20, -size/2 - 20);
      ctx.lineTo(size/2 + 20, -size/2 - 20);
      ctx.lineTo(size/2, -size/2);
      ctx.lineTo(-size/2, -size/2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(139, 92, 246, 0.7)';
      ctx.fill();
      ctx.stroke();

      // Side face
      ctx.beginPath();
      ctx.moveTo(size/2, -size/2);
      ctx.lineTo(size/2 + 20, -size/2 - 20);
      ctx.lineTo(size/2 + 20, size/2 + 20);
      ctx.lineTo(size/2, size/2);
      ctx.closePath();
      ctx.fillStyle = 'rgba(79, 70, 229, 0.7)';
      ctx.fill();
      ctx.stroke();

      // Add some product text
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Product #${productId}`, 0, 0);

      ctx.restore();

      // Update rotation
      rotationRef.current += 0.005;
      
      // Continue animation loop
      animationRef.current = requestAnimationFrame(animate);
    };

    // Start animation
    animate();

    // Cleanup
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [productId]);

  return (
    <div className={cn("relative h-[400px] w-full rounded-lg overflow-hidden bg-muted/50", className)}>
      <canvas ref={canvasRef} className="w-full h-full" />
      <div className="absolute bottom-4 right-4 flex gap-2">
        <Button size="sm" variant="secondary">
          Zoom
        </Button>
        <Button size="sm" variant="secondary">
          Rotate
        </Button>
        <Button size="sm" variant="secondary">
          Reset
        </Button>
      </div>
    </div>
  );
}
