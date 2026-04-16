import type { BrushSettings, StrokePoint, StrokeHistoryRecord } from "drawers-shared";
import type { IStrokeDocument} from "../document/types";
import type {
    ICanvasWorldViewport,
    NormalizedPointerEvent,
    NormalizedWheelEvent,
} from "../viewport/CanvasWorldViewport";
import type { IUndoRedoController } from "./UndoRedoController";
import { throttleRaf } from "@/app/lib/utility";
import { ICollaborationBridge } from "../collab/CollaborationBridge";

type PointerState = {
    pointerId: number;
    pointerType: string;
    screenX: number;
    screenY: number;
    startScreenX: number;
    startScreenY: number;
};

type LocalInteractionListener = (state: {
    isDrawing: boolean;
    isPanning: boolean;
}) => void;

type HistoryStateListener = () => void;

export interface ILocalDrawingCollabBridge {
    sendStrokeBegin(params: {
        roomId: string;
        point: StrokePoint;
        brushSettings?: BrushSettings;
    }): void;

    sendStrokeAppend(params: {
        roomId: string;
        points: StrokePoint[];
    }): void;

    sendStrokeCommit(params: {
        roomId: string;
        strokeId: string;
    }): void;

    sendCursorMove(x: number, y: number): void;
}

export interface ILocalDrawingController {
    attach(): void;
    detach(): void;

    setBrushSettings(brush: BrushSettings): void;
    getBrushSettings(): BrushSettings;

    getActiveStreamId(): string | null;
}

export class LocalDrawingController implements ILocalDrawingController {
    private viewport: ICanvasWorldViewport;
    private document: IStrokeDocument;
    private collabBridge?: ICollaborationBridge;
    private userId?: string;
    private undoRedoController?: IUndoRedoController;
    private onInteractionStateChange?: LocalInteractionListener;
    private onHistoryStateChange?: HistoryStateListener;

    private brushSettings: BrushSettings;
    private pointers = new Map<number, PointerState>();

    private activeStreamId: string | null = null;
    private isDrawing = false;
    private isPanning = false;
    private drawPointerId: number | null = null;

    private pendingOutboundPoints: StrokePoint[] = [];
    private latestCursorPos: { x: number; y: number } | null = null;
    private latestScreenCursorPos: { x: number; y: number } | null = null;

    private unsubscribePointer: (() => void) | null = null;
    private unsubscribeWheel: (() => void) | null = null;

    private hasBrushChanged: boolean = false

    private flushPendingAppendPointsThrottled = throttleRaf(() => {
        this.flushPendingAppendPointsNow();
    });

    private sendCursorMoveThrottled = throttleRaf(() => {
        if (!this.latestCursorPos) return;
        this.collabBridge?.sendCursorMove(this.latestCursorPos.x, this.latestCursorPos.y);
    });

    private drawBrushCursorThrottled = throttleRaf(() => {
        this.updateBrushCursor();
    });

    constructor(params: {
        viewport: ICanvasWorldViewport;
        document: IStrokeDocument;
        initialBrushSettings: BrushSettings;
        collabBridge?: ICollaborationBridge;
        userId?: string;
        undoRedoController?: IUndoRedoController;
        onInteractionStateChange?: LocalInteractionListener;
        onHistoryStateChange?: HistoryStateListener;
    }) {
        this.viewport = params.viewport;
        this.document = params.document;
        this.brushSettings = params.initialBrushSettings;
        this.collabBridge = params.collabBridge;
        this.userId = params.userId;
        this.undoRedoController = params.undoRedoController;
        this.onInteractionStateChange = params.onInteractionStateChange;
        this.onHistoryStateChange = params.onHistoryStateChange;
    }

    attach(): void {
        if (this.unsubscribePointer || this.unsubscribeWheel) return;

        this.unsubscribePointer = this.viewport.subscribePointer((event) => {
            this.handlePointerEvent(event);
        });

        this.unsubscribeWheel = this.viewport.subscribeWheel((event) => {
            this.handleWheelEvent(event);
        });
    }

    detach(): void {
        this.unsubscribePointer?.();
        this.unsubscribeWheel?.();

        this.unsubscribePointer = null;
        this.unsubscribeWheel = null;

        this.pointers.clear();
        this.activeStreamId = null;
        this.isDrawing = false;
        this.isPanning = false;
        this.drawPointerId = null;
        this.pendingOutboundPoints = [];
        this.latestCursorPos = null;
        this.latestScreenCursorPos = null;

        this.emitInteractionState();
        this.viewport.clearBrushCursor();
    }

    

    setBrushSettings(brush: BrushSettings): void {
        this.brushSettings = brush;
        this.drawBrushCursorThrottled();
        this.hasBrushChanged = true;
    }

    getBrushSettings(): BrushSettings {
        return this.brushSettings;
    }

    getActiveStreamId(): string | null {
        return this.activeStreamId;
    }

    private handlePointerEvent(event: NormalizedPointerEvent): void {
        switch (event.kind) {
            case "down":
                this.onPointerDown(event);
                return;
            case "move":
                this.onPointerMove(event);
                return;
            case "up":
            case "cancel":
                this.onPointerUpOrCancel(event);
                return;
            default: {
                const exhaustive: never = event.kind;
                return exhaustive;
            }
        }
    }

    private onPointerDown(event: NormalizedPointerEvent): void {
        event.originalEvent.preventDefault();

        this.latestScreenCursorPos = {
            x: event.screenX,
            y: event.screenY,
        };
        this.drawBrushCursorThrottled();

        this.pointers.set(event.pointerId, {
            pointerId: event.pointerId,
            pointerType: event.pointerType,
            screenX: event.screenX,
            screenY: event.screenY,
            startScreenX: event.screenX,
            startScreenY: event.screenY,
        });

        const target = event.originalEvent.target;
        if (target instanceof Element && "setPointerCapture" in target) {
            try {
                (target as Element & { setPointerCapture(pointerId: number): void }).setPointerCapture(
                    event.pointerId
                );
            } catch {
                // ignore
            }
        }

        if (event.pointerType === "mouse" && event.buttons === 2) {
            this.isPanning = true;
            this.emitInteractionState();
            this.drawBrushCursorThrottled();
            return;
        }

        if (event.pointerType === "touch" && this.getTouchPointers().length === 2) {
            if (this.isDrawing && this.activeStreamId) {
                this.document.apply({
                    type: "stroke_cancel",
                    roomId: this.activeStreamId,
                });
            }

            this.activeStreamId = null;
            this.drawPointerId = null;
            this.isDrawing = false;
            this.isPanning = true;
            this.pendingOutboundPoints = [];
            this.emitInteractionState();
            this.drawBrushCursorThrottled();
            return;
        }

        if (this.pointers.size > 1) {
            return;
        }

        if (this.isDrawPointerEvent(event)) {
            const point: StrokePoint = [
                event.worldX,
                event.worldY,
                event.pressure || 0.5,
            ];

            const roomId = this.createLocalStreamId();

            this.activeStreamId = roomId;
            this.isDrawing = true;
            this.drawPointerId = event.pointerId;

            this.document.apply({
                type: "stroke_begin",
                roomId,
                userId: this.userId,
                point,
                brushSettings: this.brushSettings,
            });

            this.pendingOutboundPoints = [];

            const newBrushSettings = this.hasBrushChanged ? this.brushSettings : undefined

            this.collabBridge?.sendStrokeBegin({
                points: [point, point],
                newBrushSettings
            });

            this.hasBrushChanged = false;

            this.emitInteractionState();
        }
    }

    private onPointerMove(event: NormalizedPointerEvent): void {
        const pointer = this.pointers.get(event.pointerId);
        if (pointer) {
            pointer.screenX = event.screenX;
            pointer.screenY = event.screenY;
        }

        this.latestCursorPos = {
            x: event.worldX,
            y: event.worldY,
        };
        this.latestScreenCursorPos = {
            x: event.screenX,
            y: event.screenY,
        };

        this.sendCursorMoveThrottled();
        this.drawBrushCursorThrottled();

        const touchPointers = this.getTouchPointers();
        if (touchPointers.length === 2) {
            this.isPanning = true;
            this.emitInteractionState();
            this.handlePinchGesture();
            return;
        }

        if (
            this.pointers.size === 1 &&
            event.pointerType === "mouse" &&
            event.buttons === 2
        ) {
            const p = this.pointers.get(event.pointerId);
            if (!p) return;

            const dx = event.screenX - p.startScreenX;
            const dy = event.screenY - p.startScreenY;

            const camera = this.viewport.getCamera();
            this.viewport.setCamera({
                ...camera,
                offsetX: camera.offsetX + dx,
                offsetY: camera.offsetY + dy,
            });

            p.startScreenX = event.screenX;
            p.startScreenY = event.screenY;

            this.isPanning = true;
            this.emitInteractionState();
            this.drawBrushCursorThrottled();
            return;
        }

        if (!this.isDrawing || this.drawPointerId !== event.pointerId || !this.activeStreamId) {
            return;
        }

        if (!this.isDrawPointerEvent(event)) {
            return;
        }

        const point: StrokePoint = [
            event.worldX,
            event.worldY,
            event.pressure || 0.5,
        ];

        this.document.apply({
            type: "stroke_append",
            roomId: this.activeStreamId,
            points: [point],
        });

        this.pendingOutboundPoints.push(point);
        this.flushPendingAppendPointsThrottled();
    }

    private onPointerUpOrCancel(event: NormalizedPointerEvent): void {
        const wasTracked = this.pointers.has(event.pointerId);
        this.pointers.delete(event.pointerId);

        if (!wasTracked) return;

        this.latestScreenCursorPos = {
            x: event.screenX,
            y: event.screenY,
        };

        if (this.isDrawing && this.drawPointerId === event.pointerId && this.activeStreamId) {
            const committed = this.document.apply({
                type: "stroke_commit",
                roomId: this.activeStreamId,
                strokeId: null
            });

            if (committed?.id == null) throw new Error("Stroke corrupted")

            this.flushPendingAppendPointsNow();

            this.collabBridge?.sendStrokeCommit({
                strokeId: committed?.id,
            });            

            this.onStrokeCommitted(committed);

            this.activeStreamId = null;
            this.drawPointerId = null;
            this.isDrawing = false;
        }

        if (this.pointers.size === 0) {
            this.isPanning = false;
        }

        this.pendingOutboundPoints = [];
        this.emitInteractionState();
        this.drawBrushCursorThrottled();
    }

    private handleWheelEvent(event: NormalizedWheelEvent): void {
        const camera = this.viewport.getCamera();
        const zoomFactor = Math.exp(-event.deltaY / 400);

        const worldX = (event.screenX - camera.offsetX) / camera.scale;
        const worldY = (event.screenY - camera.offsetY) / camera.scale;

        const nextScale = camera.scale * zoomFactor;
        const nextOffsetX = event.screenX - worldX * nextScale;
        const nextOffsetY = event.screenY - worldY * nextScale;

        this.latestScreenCursorPos = {
            x: event.screenX,
            y: event.screenY,
        };

        this.viewport.setCamera({
            scale: nextScale,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
        });

        this.drawBrushCursorThrottled();
    }

    private handlePinchGesture(): void {
        const touchPointers = this.getTouchPointers();
        if (touchPointers.length !== 2) return;

        const p1 = touchPointers[0];
        const p2 = touchPointers[1];
        if (!p1 || !p2) return;

        const prevMidX = (p1.startScreenX + p2.startScreenX) / 2;
        const prevMidY = (p1.startScreenY + p2.startScreenY) / 2;
        const currMidX = (p1.screenX + p2.screenX) / 2;
        const currMidY = (p1.screenY + p2.screenY) / 2;

        const prevDist = Math.hypot(
            p1.startScreenX - p2.startScreenX,
            p1.startScreenY - p2.startScreenY
        );
        const currDist = Math.hypot(
            p1.screenX - p2.screenX,
            p1.screenY - p2.screenY
        );

        if (prevDist <= 0 || currDist <= 0) return;

        const camera = this.viewport.getCamera();
        const zoomFactor = currDist / prevDist;

        const worldMidX = (prevMidX - camera.offsetX) / camera.scale;
        const worldMidY = (prevMidY - camera.offsetY) / camera.scale;

        const nextScale = camera.scale * zoomFactor;
        const nextOffsetX = currMidX - worldMidX * nextScale;
        const nextOffsetY = currMidY - worldMidY * nextScale;

        this.viewport.setCamera({
            scale: nextScale,
            offsetX: nextOffsetX,
            offsetY: nextOffsetY,
        });

        p1.startScreenX = p1.screenX;
        p1.startScreenY = p1.screenY;
        p2.startScreenX = p2.screenX;
        p2.startScreenY = p2.screenY;

        this.drawBrushCursorThrottled();
    }

    private getTouchPointers(): PointerState[] {
        return Array.from(this.pointers.values()).filter(
            (pointer) => pointer.pointerType === "touch"
        );
    }

    private isDrawPointerEvent(event: NormalizedPointerEvent): boolean {
        if (event.pointerType === "pen") return true;
        if (event.pointerType === "touch") return true;
        if (event.pointerType === "mouse" && event.buttons === 1) return true;
        return false;
    }

    private flushPendingAppendPointsNow(): void {
        if (!this.collabBridge || !this.activeStreamId) return;
        if (this.pendingOutboundPoints.length === 0) return;

        const points = [...this.pendingOutboundPoints];
        this.pendingOutboundPoints = [];

        this.collabBridge.sendStrokeAppend({
            points,
        });
    }

    private onStrokeCommitted(stroke: StrokeHistoryRecord | null): void {
        if (!stroke) return;
        this.undoRedoController?.recordCommittedStroke(stroke.id);
        this.onHistoryStateChange?.();
    }

    private createLocalStreamId(): string {
        return `local_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    private emitInteractionState(): void {
        this.onInteractionStateChange?.({
            isDrawing: this.isDrawing,
            isPanning: this.isPanning,
        });
    }

    private updateBrushCursor(): void {
        if (this.isPanning || !this.latestScreenCursorPos) {
            this.viewport.clearBrushCursor();
            return;
        }

        const radius =
            ((this.brushSettings.strokeOptions.size ?? 1) * this.viewport.getCamera().scale) * 0.5;

        this.viewport.drawBrushCursor(
            this.latestScreenCursorPos.x,
            this.latestScreenCursorPos.y,
            radius
        );
    }
}