import type { IStrokeDocument } from "../document/types";
import type { ICollaborationBridge } from "../collab/CollaborationBridge";
import type { IUndoRedoController } from "./UndoRedoController";

export interface IRemoteDrawingController {
    attach(): void;
    detach(): void;

    setReady(isReady: boolean): void;
    flushQueuedEvents(): void;
    resetQueue(): void;
}

export class RemoteDrawingController implements IRemoteDrawingController {
    private document: IStrokeDocument;
    private bridge: ICollaborationBridge;
    private undoRedoController: IUndoRedoController

    private unsubscribers: Array<() => void> = [];
    private isReady = true;
    private queuedEvents: Array<() => void> = [];


    constructor(params: {
        document: IStrokeDocument;
        bridge: ICollaborationBridge;
        undoRedoController: IUndoRedoController;
    }) {
        this.document = params.document;
        this.bridge = params.bridge;
        this.undoRedoController = params.undoRedoController
    }

    attach(): void {
        if (this.unsubscribers.length > 0) return;

        this.unsubscribers.push(
            this.bridge.subscribeRemoteStrokeBegin((payload) => {
                this.queueOrRun(() => {
                    this.document.apply({
                        type: "stroke_begin",
                        roomId: payload.roomId,
                        userId: payload.userId,
                        point: payload.point,
                        brushSettings: payload.brushSettings,
                    });
                });
            })
        );

        this.unsubscribers.push(
            this.bridge.subscribeRemoteStrokeAppend((payload) => {
                this.queueOrRun(() => {
                    this.document.apply({
                        type: "stroke_append",
                        roomId: payload.roomId,
                        points: payload.points,
                    });
                });
            })
        );

        this.unsubscribers.push(
            this.bridge.subscribeRemoteStrokeCommit((payload) => {
                this.queueOrRun(() => {                    
                    this.document.apply({
                        type: "stroke_commit",
                        roomId: payload.roomId,
                        strokeId: payload.strokeId
                    });
                });
            })
        );

        this.unsubscribers.push(
            this.bridge.subscribeRemoteStrokeHide((payload) => {
                this.queueOrRun(() => {
                    this.document.apply({
                        type: "stroke_hide",
                        strokeId: payload.strokeId,
                    });
                });
            })
        );

        this.unsubscribers.push(
            this.bridge.subscribeRemoteStrokeShow((payload) => {
                this.queueOrRun(() => {
                    this.document.apply({
                        type: "stroke_show",
                        strokeId: payload.strokeId,
                    });
                });
            })
        );

        this.unsubscribers.push(
            this.bridge.subscribeRemoteClear(() => {
                this.queueOrRun(() => {
                    this.document.clear();
                    this.undoRedoController.clearHistory()
                });
            })
        );
    }

    detach(): void {
        for (const unsubscribe of this.unsubscribers) {
            unsubscribe();
        }
        this.unsubscribers = [];
        this.resetQueue();
    }

    setReady(isReady: boolean): void {
        this.isReady = isReady;
    }

    flushQueuedEvents(): void {
        if (this.queuedEvents.length === 0) return;

        const queue = [...this.queuedEvents];
        this.queuedEvents = [];

        for (const run of queue) {
            run();
        }
    }

    resetQueue(): void {
        this.queuedEvents = [];
    }

    private queueOrRun(fn: () => void): void {

        if (!this.isReady) {
            this.queuedEvents.push(fn);
            return;
        }

        fn();
    }
}