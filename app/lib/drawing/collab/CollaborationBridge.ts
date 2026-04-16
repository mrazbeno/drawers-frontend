import type {
    BrushSettings,
    DrawEndEvent,
    DrawStartEvent,
    DrawUpdateEvent,
    StrokePoint,
    StrokeHistoryRecord
} from "drawers-shared";
import { TypedSocket } from "../../TypedSocket";

type EnsuredDrawStartEvent = {
    userId: string;
    roomId: string;
    point: StrokePoint;
    brushSettings: BrushSettings;
};

export interface ICollaborationBridge {
    attach(): void;
    detach(): void;

    sendStrokeBegin(params: {points: StrokePoint[], newBrushSettings?: BrushSettings }): void;

    sendStrokeAppend(params: {points: StrokePoint[]}): void;

    sendStrokeCommit(params: {strokeId: string}): void;

    sendClear(): void;
    sendSnapshot(snapshot: StrokeHistoryRecord[], targetUserId: string): void;
    requestSnapshot(targetUserId: string): void;
    requestBrushStates(targetUserId: string): void;
    sendBrushState(targetUserId: string, brushSettings: BrushSettings): void;

    subscribeRemoteStrokeBegin(
        listener: (payload: EnsuredDrawStartEvent) => void
    ): () => void;

    subscribeRemoteStrokeAppend(
        listener: (payload: DrawUpdateEvent) => void
    ): () => void;

    subscribeRemoteStrokeCommit(
        listener: (payload: DrawEndEvent) => void
    ): () => void;

    subscribeRemoteClear(listener: () => void): () => void;
    subscribeSnapshotRequest(listener: (targetUserId: string) => void): () => void;
    subscribeSnapshot(listener: (snapshot: StrokeHistoryRecord[]) => void): () => void;
    subscribeBrushStateRequest(listener: (targetUserId: string) => void): () => void;
    subscribeBrushState(listener: (payload: {
        userId: string;
        targetUserId: string;
        brushSettings: BrushSettings;
    }) => void): () => void;

    sendStrokeHide(strokeId: string): void;
    sendStrokeShow(strokeId: string): void;

    subscribeRemoteStrokeHide(
        listener: (payload: { userId: string; strokeId: string }) => void
    ): () => void;

    subscribeRemoteStrokeShow(
        listener: (payload: { userId: string; strokeId: string }) => void
    ): () => void;


    sendCursorMove(x: number, y: number): void;

    subscribeRemoteCursorMove(
        listener: (payload: { userId: string; x: number; y: number }) => void
    ): () => void;

}



export class CollaborationBridge implements ICollaborationBridge {
    private socket: TypedSocket;
    private roomId: string;
    private userId: string;

    private beginListeners = new Set<(payload: EnsuredDrawStartEvent) => void>();
    private appendListeners = new Set<(payload: DrawUpdateEvent) => void>();
    private commitListeners = new Set<(payload: DrawEndEvent) => void>();
    private clearListeners = new Set<() => void>();
    private strokeHideListeners = new Set<(payload: { userId: string; strokeId: string }) => void>();
    private strokeShowListeners = new Set<(payload: { userId: string; strokeId: string }) => void>();
    private cursorMoveListeners = new Set<(payload: { userId: string; x: number; y: number }) => void>();
    private snapshotRequestListeners = new Set<(targetUserId: string) => void>();
    private snapshotListeners = new Set<(snapshot: StrokeHistoryRecord[]) => void>();
    private brushStateRequestListeners = new Set<(targetUserId: string) => void>();
    private brushStateListeners = new Set<(payload: {
        userId: string;
        targetUserId: string;
        brushSettings: BrushSettings;
    }) => void>();

    private remoteroomIds = new Map<string, string>();

    private remoteBrushSettings = new Map<string, BrushSettings>();

    private boundDrawStart = (data: DrawStartEvent) => {
        if (data.userId === this.userId) return;
        if (data.points.length === 0) return;

        const firstPoint = data.points[0] as StrokePoint;
        const roomId = this.getOrCreateRemoteroomId(data.userId);

        const brushSettings =
            data.newBrushSettings ?? this.remoteBrushSettings.get(data.userId);

        if (!brushSettings) {
            throw new Error("Draw start event: referenced remote brush config not found.");
        }

        for (const listener of this.beginListeners) {
            listener({
                userId: data.userId,
                roomId,
                point: firstPoint,
                brushSettings,
            });
        }

        this.remoteBrushSettings.set(data.userId, brushSettings);
    };

    private boundDrawUpdate = (data: DrawUpdateEvent) => {
        if (data.userId === this.userId) return;
        if (data.points.length === 0) return;

        const roomId = this.getOrCreateRemoteroomId(data.userId);

        for (const listener of this.appendListeners) {
            listener({
                userId: data.userId,
                roomId,
                points: data.points as StrokePoint[],
            });
        }
    };

    private boundDrawEnd = (data: DrawEndEvent) => {
        if (data.userId === this.userId) return;

        const roomId = this.getOrCreateRemoteroomId(data.userId);

        if (data.points.length > 0) {
            for (const listener of this.appendListeners) {
                listener({
                    userId: data.userId,
                    roomId,
                    points: data.points as StrokePoint[],
                });
            }
        }

        for (const listener of this.commitListeners) {
            listener({
                strokeId: data.strokeId,
                userId: data.userId,
                roomId,
                points: data.points
            });
        }

        this.remoteroomIds.delete(data.userId);
    };


    private boundStrokeHide = (data: { roomId: string; userId: string; strokeId: string }) => {
        if (data.userId === this.userId) return;

        for (const listener of this.strokeHideListeners) {
            listener({
                userId: data.userId,
                strokeId: data.strokeId,
            });
        }
    };

    private boundStrokeShow = (data: { roomId: string; userId: string; strokeId: string }) => {
        if (data.userId === this.userId) return;

        for (const listener of this.strokeShowListeners) {
            listener({
                userId: data.userId,
                strokeId: data.strokeId,
            });
        }
    };

    private boundCursorMove = (data: { roomId: string; userId: string; x: number; y: number }) => {
        if (data.userId === this.userId) return;

        for (const listener of this.cursorMoveListeners) {
            listener({
                userId: data.userId,
                x: data.x,
                y: data.y,
            });
        }
    };

    private boundClearCanvas = () => {
        for (const listener of this.clearListeners) {
            listener();
        }
    };


    private boundRequestSnapshot = (targetUserId: string) => {

        for (const listener of this.snapshotRequestListeners) {
            listener(targetUserId);
        }
    };

    private boundCanvasSnapshot = (data: {
        targetUserId: string;
        snapshot: any[];
    }) => {
        if (data.targetUserId !== this.userId) return;

        for (const listener of this.snapshotListeners) {
            listener(data.snapshot as StrokeHistoryRecord[]);
        }
    };


    private boundRequestBrushStates = (data: { targetUserId: string }) => {
        if (data.targetUserId === this.userId) return;

        for (const listener of this.brushStateRequestListeners) {
            listener(data.targetUserId);
        }
    };

    private boundBrushState = (data: {
        targetUserId: string;
        userId: string;
        brushSettings: BrushSettings;
    }) => {
        if (data.targetUserId !== this.userId) return;
        if (data.userId === this.userId) return;

        this.remoteBrushSettings.set(data.userId, data.brushSettings)

        for (const listener of this.brushStateListeners) {
            listener(data);
        }
    };

    constructor(params: {
        socket: TypedSocket;
        roomId: string;
        userId: string;
    }) {
        this.socket = params.socket;
        this.roomId = params.roomId;
        this.userId = params.userId;
    }

    attach(): void {
        this.socket.on("stroke_hide", this.boundStrokeHide);
        this.socket.on("stroke_show", this.boundStrokeShow);
        this.socket.on("cursor_move", this.boundCursorMove);

        this.socket.on("draw_start", this.boundDrawStart);
        this.socket.on("draw_update", this.boundDrawUpdate);
        this.socket.on("draw_end", this.boundDrawEnd);
        this.socket.on("clear_canvas", this.boundClearCanvas);
        this.socket.on("request_canvas_snapshot", this.boundRequestSnapshot);
        this.socket.on("canvas_snapshot", this.boundCanvasSnapshot);
        this.socket.on("request_brush_states", this.boundRequestBrushStates);
        this.socket.on("brush_state", this.boundBrushState);
    }

    detach(): void {
        this.socket.off("stroke_hide", this.boundStrokeHide);
        this.socket.off("stroke_show", this.boundStrokeShow);
        this.socket.off("cursor_move", this.boundCursorMove);

        this.socket.off("draw_start", this.boundDrawStart);
        this.socket.off("draw_update", this.boundDrawUpdate);
        this.socket.off("draw_end", this.boundDrawEnd);
        this.socket.off("clear_canvas", this.boundClearCanvas);
        this.socket.off("request_canvas_snapshot", this.boundRequestSnapshot);
        this.socket.off("canvas_snapshot", this.boundCanvasSnapshot);
        this.socket.off("request_brush_states", this.boundRequestBrushStates);
        this.socket.off("brush_state", this.boundBrushState);
    }

    sendStrokeBegin(params: {points: StrokePoint[], newBrushSettings?: BrushSettings }): void {
        const payload: DrawStartEvent = {
            roomId: this.roomId,
            userId: this.userId,
            points: params.points,
            newBrushSettings: params.newBrushSettings,
        };

        this.socket.emit("draw_start", payload);
    }

    sendStrokeAppend(params: {points: StrokePoint[]}): void {
        if (params.points.length === 0) return;

        const payload: DrawUpdateEvent = {
            roomId: this.roomId,
            userId: this.userId,
            points: params.points,
        };

        this.socket.emit("draw_update", payload);
    }

    sendStrokeCommit(params: {strokeId: string}): void {
        const payload: DrawEndEvent = {
            strokeId: params.strokeId,
            roomId: this.roomId,
            userId: this.userId,
            points: [],
        };

        this.socket.emit("draw_end", payload);
    }

    sendClear(): void {
        this.socket.emit("clear_canvas", {
            roomId: this.roomId,
            username: "",
        });
    }

    sendStrokeHide(strokeId: string): void {
        this.socket.emit("stroke_hide", {
            roomId: this.roomId,
            userId: this.userId,
            strokeId,
        });
    }

    sendStrokeShow(strokeId: string): void {
        this.socket.emit("stroke_show", {
            roomId: this.roomId,
            userId: this.userId,
            strokeId,
        });
    }

    subscribeRemoteStrokeHide(
        listener: (payload: { userId: string; strokeId: string }) => void
    ): () => void {
        this.strokeHideListeners.add(listener);
        return () => this.strokeHideListeners.delete(listener);
    }

    subscribeRemoteStrokeShow(
        listener: (payload: { userId: string; strokeId: string }) => void
    ): () => void {
        this.strokeShowListeners.add(listener);
        return () => this.strokeShowListeners.delete(listener);
    }

    sendCursorMove(x: number, y: number): void {
        this.socket.emit("cursor_move", {
            roomId: this.roomId,
            userId: this.userId,
            x,
            y,
        });
    }

    subscribeRemoteCursorMove(
        listener: (payload: { userId: string; x: number; y: number }) => void
    ): () => void {
        this.cursorMoveListeners.add(listener);
        return () => this.cursorMoveListeners.delete(listener);
    }

    sendSnapshot(snapshot: StrokeHistoryRecord[], targetUserId: string): void {
        this.socket.emit("canvas_snapshot", {
            targetUserId,
            snapshot: snapshot as any,
        });
    }

    requestSnapshot(targetUserId: string): void {
        this.socket.emit("request_canvas_snapshot", {
            roomId: this.roomId,
            targetUserId,
        });
    }

    requestBrushStates(targetUserId: string): void {
        this.socket.emit("request_brush_states", {
            roomId: this.roomId,
            targetUserId,
        });
    }

    sendBrushState(targetUserId: string, brushSettings: BrushSettings): void {
        this.socket.emit("brush_state", {
            targetUserId,
            userId: this.userId,
            brushSettings,
        });
    }

    subscribeRemoteStrokeBegin(
        listener: (payload: EnsuredDrawStartEvent) => void
    ): () => void {
        this.beginListeners.add(listener);
        return () => this.beginListeners.delete(listener);
    }

    subscribeRemoteStrokeAppend(
        listener: (payload: DrawUpdateEvent) => void
    ): () => void {
        this.appendListeners.add(listener);
        return () => this.appendListeners.delete(listener);
    }

    subscribeRemoteStrokeCommit(
        listener: (payload: DrawEndEvent) => void
    ): () => void {
        this.commitListeners.add(listener);
        return () => this.commitListeners.delete(listener);
    }

    subscribeRemoteClear(listener: () => void): () => void {
        this.clearListeners.add(listener);
        return () => this.clearListeners.delete(listener);
    }

    subscribeSnapshotRequest(listener: (targetUserId: string) => void): () => void {
        this.snapshotRequestListeners.add(listener);
        return () => this.snapshotRequestListeners.delete(listener);
    }

    subscribeSnapshot(listener: (snapshot: StrokeHistoryRecord[]) => void): () => void {
        this.snapshotListeners.add(listener);
        return () => this.snapshotListeners.delete(listener);
    }

    subscribeBrushStateRequest(listener: (targetUserId: string) => void): () => void {
        this.brushStateRequestListeners.add(listener);
        return () => this.brushStateRequestListeners.delete(listener);
    }

    subscribeBrushState(listener: (payload: {
        userId: string;
        targetUserId: string;
        brushSettings: BrushSettings;
    }) => void): () => void {
        this.brushStateListeners.add(listener);
        return () => this.brushStateListeners.delete(listener);
    }



    private getOrCreateRemoteroomId(userId: string): string {
        const existing = this.remoteroomIds.get(userId);
        if (existing) return existing;

        const next = `remote_${userId}_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 8)}`;

        this.remoteroomIds.set(userId, next);
        return next;
    }
}