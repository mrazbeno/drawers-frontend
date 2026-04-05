import type { SceneSnapshot } from "../document/types";

export type CameraState = {
    scale: number;
    offsetX: number;
    offsetY: number;
};

export type NormalizedPointerEvent = {
    kind: "down" | "move" | "up" | "cancel";
    pointerId: number;
    pointerType: string;
    screenX: number;
    screenY: number;
    worldX: number;
    worldY: number;
    pressure: number;
    buttons: number;
    originalEvent: PointerEvent;
};

export type NormalizedWheelEvent = {
    screenX: number;
    screenY: number;
    deltaY: number;
    originalEvent: WheelEvent;
};

export interface ICanvasWorldViewport {
    mount(params: {
        imageCanvas: HTMLCanvasElement;
        overlayCanvas?: HTMLCanvasElement;
    }): void;

    unmount(): void;
    resize(): void;

    getCamera(): CameraState;
    setCamera(camera: CameraState): void;
    subscribeCamera(listener: () => void): () => void;

    screenToWorld(x: number, y: number): { x: number; y: number };
    worldToScreen(x: number, y: number): { x: number; y: number };

    render(scene: SceneSnapshot): void;

    subscribePointer(listener: (event: NormalizedPointerEvent) => void): () => void;
    subscribeWheel(listener: (event: NormalizedWheelEvent) => void): () => void;

    drawBrushCursor(screenX: number, screenY: number, radius: number): void;
    clearBrushCursor(): void;
}

export class CanvasWorldViewport implements ICanvasWorldViewport {
    private imageCanvas: HTMLCanvasElement | null = null;
    private overlayCanvas: HTMLCanvasElement | null = null;

    private imageCtx: CanvasRenderingContext2D | null = null;
    private overlayCtx: CanvasRenderingContext2D | null = null;

    private dpr = 1;

    private camera: CameraState = {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    };

    private pointerListeners = new Set<(event: NormalizedPointerEvent) => void>();
    private wheelListeners = new Set<(event: NormalizedWheelEvent) => void>();
    private cameraListeners = new Set<() => void>();

    private boundPointerDown = (event: PointerEvent) => this.handlePointerEvent("down", event);
    private boundPointerMove = (event: PointerEvent) => this.handlePointerEvent("move", event);
    private boundPointerUp = (event: PointerEvent) => this.handlePointerEvent("up", event);
    private boundPointerCancel = (event: PointerEvent) => this.handlePointerEvent("cancel", event);
    private boundWheel = (event: WheelEvent) => this.handleWheelEvent(event);

    mount(params: {
        imageCanvas: HTMLCanvasElement;
        overlayCanvas?: HTMLCanvasElement;
    }): void {
        this.unmount();

        this.imageCanvas = params.imageCanvas;
        this.overlayCanvas = params.overlayCanvas ?? null;

        this.imageCtx = this.imageCanvas.getContext("2d");
        this.overlayCtx = this.overlayCanvas?.getContext("2d") ?? null;

        if (!this.imageCtx) {
            throw new Error("Failed to acquire 2D context for image canvas.");
        }

        this.imageCanvas.addEventListener("pointerdown", this.boundPointerDown);
        this.imageCanvas.addEventListener("pointermove", this.boundPointerMove);
        this.imageCanvas.addEventListener("pointerup", this.boundPointerUp);
        this.imageCanvas.addEventListener("pointercancel", this.boundPointerCancel);
        this.imageCanvas.addEventListener("wheel", this.boundWheel, { passive: false });
        this.imageCanvas.addEventListener("contextmenu", (e) => e.preventDefault());

        this.imageCtx.imageSmoothingEnabled = true;
        this.imageCtx.imageSmoothingQuality = "high";

        this.resize();
    }

    unmount(): void {
        if (this.imageCanvas) {
            this.imageCanvas.removeEventListener("pointerdown", this.boundPointerDown);
            this.imageCanvas.removeEventListener("pointermove", this.boundPointerMove);
            this.imageCanvas.removeEventListener("pointerup", this.boundPointerUp);
            this.imageCanvas.removeEventListener("pointercancel", this.boundPointerCancel);
            this.imageCanvas.removeEventListener("wheel", this.boundWheel);
        }

        this.imageCanvas = null;
        this.overlayCanvas = null;
        this.imageCtx = null;
        this.overlayCtx = null;
    }

    resize(): void {
        if (!this.imageCanvas || !this.imageCtx) return;

        const rect = this.imageCanvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        this.dpr = Math.max(1, window.devicePixelRatio || 1);

        this.imageCanvas.width = Math.floor(width * this.dpr);
        this.imageCanvas.height = Math.floor(height * this.dpr);
        this.imageCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

        if (this.overlayCanvas && this.overlayCtx) {
            this.overlayCanvas.width = Math.floor(width * this.dpr);
            this.overlayCanvas.height = Math.floor(height * this.dpr);
            this.overlayCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        }
    }

    getCamera(): CameraState {
        return { ...this.camera };
    }

    setCamera(camera: CameraState): void {
        this.camera = { ...camera };
        for (const listener of this.cameraListeners) {
            listener();
        }
    }

    subscribeCamera(listener: () => void): () => void {
        this.cameraListeners.add(listener);
        return () => {
            this.cameraListeners.delete(listener);
        };
    }

    screenToWorld(x: number, y: number): { x: number; y: number } {
        return {
            x: (x - this.camera.offsetX) / this.camera.scale,
            y: (y - this.camera.offsetY) / this.camera.scale,
        };
    }

    worldToScreen(x: number, y: number): { x: number; y: number } {
        return {
            x: x * this.camera.scale + this.camera.offsetX,
            y: y * this.camera.scale + this.camera.offsetY,
        };
    }

    render(scene: SceneSnapshot): void {
        if (!this.imageCanvas || !this.imageCtx) return;

        this.clearRawCanvas(this.imageCtx, this.imageCanvas, scene.background ?? "#ffffff");

        for (const stroke of scene.committedStrokes) {
            this.drawSvgPath(this.imageCtx, stroke.svgPath, stroke.brushColor);
        }

        for (const overlay of scene.activeOverlays) {
            this.drawSvgPath(this.imageCtx, overlay.svgPath, overlay.brushColor);
        }

    }

    subscribePointer(listener: (event: NormalizedPointerEvent) => void): () => void {
        this.pointerListeners.add(listener);
        return () => {
            this.pointerListeners.delete(listener);
        };
    }

    subscribeWheel(listener: (event: NormalizedWheelEvent) => void): () => void {
        this.wheelListeners.add(listener);
        return () => {
            this.wheelListeners.delete(listener);
        };
    }

    private handlePointerEvent(
        kind: "down" | "move" | "up" | "cancel",
        event: PointerEvent
    ): void {
        if (!this.imageCanvas) return;

        const rect = this.imageCanvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;
        const world = this.screenToWorld(screenX, screenY);

        const normalized: NormalizedPointerEvent = {
            kind,
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            screenX,
            screenY,
            worldX: world.x,
            worldY: world.y,
            pressure: event.pressure ?? 0.5,
            buttons: event.buttons,
            originalEvent: event,
        };

        for (const listener of this.pointerListeners) {
            listener(normalized);
        }
    }

    private handleWheelEvent(event: WheelEvent): void {
        if (!this.imageCanvas) return;

        event.preventDefault();

        const rect = this.imageCanvas.getBoundingClientRect();
        const screenX = event.clientX - rect.left;
        const screenY = event.clientY - rect.top;

        const normalized: NormalizedWheelEvent = {
            screenX,
            screenY,
            deltaY: event.deltaY,
            originalEvent: event,
        };

        for (const listener of this.wheelListeners) {
            listener(normalized);
        }
    }

    private drawSvgPath(
        ctx: CanvasRenderingContext2D,
        pathData: string,
        fillColor: string
    ): void {
        const path = new Path2D(pathData);

        ctx.save();
        ctx.setTransform(
            this.dpr * this.camera.scale,
            0,
            0,
            this.dpr * this.camera.scale,
            this.dpr * this.camera.offsetX,
            this.dpr * this.camera.offsetY
        );
        ctx.fillStyle = fillColor;
        ctx.fill(path);
        ctx.restore();
    }

    private clearRawCanvas(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        background: string
    ): void {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    private clearOverlay(): void {
        if (!this.overlayCanvas || !this.overlayCtx) return;

        this.overlayCtx.save();
        this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.restore();
    }

    drawBrushCursor(screenX: number, screenY: number, radius: number): void {
        if (!this.overlayCanvas || !this.overlayCtx) return;

        this.overlayCtx.save();
        this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.restore();

        this.overlayCtx.save();
        this.overlayCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.overlayCtx.strokeStyle = "black";
        this.overlayCtx.beginPath();
        this.overlayCtx.arc(screenX, screenY, radius, 0, Math.PI * 2);
        this.overlayCtx.stroke();
        this.overlayCtx.restore();
    }

    clearBrushCursor(): void {
        if (!this.overlayCanvas || !this.overlayCtx) return;

        this.overlayCtx.save();
        this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.restore();
    }
}