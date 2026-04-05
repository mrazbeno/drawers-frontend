import React from "react";
import { useDrawingRuntime } from "./useDrawingRuntime";

function useDrawingMount() {
    const runtime = useDrawingRuntime();
    const imageCanvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const overlayCanvasRef = React.useRef<HTMLCanvasElement | null>(null);

    React.useEffect(() => {
        const imageCanvas = imageCanvasRef.current;
        if (!imageCanvas) return;

        runtime.mount({
            imageCanvas,
            overlayCanvas: overlayCanvasRef.current ?? undefined,
        });

        const handleResize = () => runtime.resize();
        window.addEventListener("resize", handleResize);
        window.addEventListener("orientationchange", handleResize);

        return () => {
            window.removeEventListener("resize", handleResize);
            window.removeEventListener("orientationchange", handleResize);
            runtime.unmount();
        };
    }, [runtime]);

    return { imageCanvasRef, overlayCanvasRef };
}