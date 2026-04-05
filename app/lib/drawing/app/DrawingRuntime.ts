import type { BrushSettings } from "drawers-shared";
import { throttleRaf } from "@/app/lib/utility";

import type {
    IStrokeDocument,
    StrokeRecord,
} from "../document/types";
import { StrokeDocument } from "../document/StrokeDocument";
import type { ICanvasWorldViewport } from "../viewport/CanvasWorldViewport";
import { CanvasWorldViewport } from "../viewport/CanvasWorldViewport";
import type {
    ILocalDrawingController,
    ILocalDrawingCollabBridge,
} from "../controllers/LocalDrawingController";
import { LocalDrawingController } from "../controllers/LocalDrawingController";
import type { IRemoteDrawingController } from "../controllers/RemoteDrawingController";
import { RemoteDrawingController } from "../controllers/RemoteDrawingController";
import type { IUndoRedoController } from "../controllers/UndoRedoController";
import { UndoRedoController } from "../controllers/UndoRedoController";
import type { ICollaborationBridge } from "../collab/CollaborationBridge";

type PublicState = {
    strokeCount: number;
    canUndo: boolean;
    canRedo: boolean;
    brushSettings: BrushSettings;
};

type InteractionState = {
    isDrawing: boolean;
    isPanning: boolean;
};

export interface IDrawingRuntime {
    mount(params: {
        imageCanvas: HTMLCanvasElement;
        overlayCanvas?: HTMLCanvasElement;
    }): void;

    unmount(): void;
    resize(): void;

    setBrushSettings(brush: BrushSettings): void;
    getBrushSettings(): BrushSettings;

    clear(): void;
    exportSvg(options?: {
        includeBackground?: boolean;
        backgroundColor?: string | null;
    }): string | null;

    getSnapshot(): StrokeRecord[];
    loadSnapshot(snapshot: StrokeRecord[]): void;

    subscribeState(listener: () => void): () => void;
    subscribeView(listener: () => void): () => void;
    subscribeInteraction(listener: () => void): () => void;

    getPublicState(): PublicState;
    getInteractionState(): InteractionState;

    undo(): void;
    redo(): void;

    requestSnapshot?(targetUserId: string): void;
    requestBrushStates?(targetUserId: string): void;
    sendBrushState?(targetUserId: string): void;

    getCamera(): { scale: number; offsetX: number; offsetY: number };

    markRemoteSyncReady(): void;
    markRemoteSyncWaiting(): void;
}

export class DrawingRuntime implements IDrawingRuntime {
    private document: IStrokeDocument;
    private viewport: ICanvasWorldViewport;
    private localController: ILocalDrawingController;
    private remoteController: IRemoteDrawingController | null = null;
    private undoRedoController: IUndoRedoController;
    private collabBridge?: ICollaborationBridge;

    private mounted = false;

    private unsubscribeDocument: (() => void) | null = null;
    private unsubscribeCamera: (() => void) | null = null;
    private collabUnsubscribers: Array<() => void> = [];

    private stateListeners = new Set<() => void>();
    private viewListeners = new Set<() => void>();
    private interactionListeners = new Set<() => void>();

    private lastPublicStateKey = "";
    private interactionState: InteractionState = {
        isDrawing: false,
        isPanning: false,
    };

    private requestRender = throttleRaf(() => {
        this.renderFromDocument();
        this.emitView();
    });

    constructor(params: {
        initialBrushSettings: BrushSettings;
        document?: IStrokeDocument;
        viewport?: ICanvasWorldViewport;
        collabBridge?: ICollaborationBridge;
        userId?: string;
    }) {
        this.document = params.document ?? new StrokeDocument();
        this.viewport = params.viewport ?? new CanvasWorldViewport();
        this.collabBridge = params.collabBridge;

        this.undoRedoController = new UndoRedoController({
            document: this.document,
        });

        this.localController = new LocalDrawingController({
            viewport: this.viewport,
            document: this.document,
            initialBrushSettings: params.initialBrushSettings,
            collabBridge: params.collabBridge as ILocalDrawingCollabBridge | undefined,
            userId: params.userId,
            undoRedoController: this.undoRedoController,
            onInteractionStateChange: (state) => {
                this.interactionState = state;
                this.emitInteraction();
            },
            onHistoryStateChange: () => {
                this.emitStateIfChanged(true);
            },
        });

        if (params.collabBridge) {
            this.remoteController = new RemoteDrawingController({
                document: this.document,
                bridge: params.collabBridge,
            });

            this.remoteController.setReady(false);
        }

        this.lastPublicStateKey = this.computePublicStateKey();
    }

    mount(params: {
        imageCanvas: HTMLCanvasElement;
        overlayCanvas?: HTMLCanvasElement;
    }): void {
        if (this.mounted) {
            this.unmount();
        }

        this.viewport.mount({
            imageCanvas: params.imageCanvas,
            overlayCanvas: params.overlayCanvas,
        });

        this.localController.attach();
        this.remoteController?.attach();
        this.collabBridge?.attach();

        this.unsubscribeDocument = this.document.subscribe(() => {
            this.requestRender();
            this.emitStateIfChanged();
        });

        this.unsubscribeCamera = this.viewport.subscribeCamera(() => {
            this.requestRender();
        });

        this.bindCollabSideEffects();

        this.renderFromDocument();
        this.mounted = true;
        this.emitState();
        this.emitView();
        this.emitInteraction();
    }

    unmount(): void {
        this.unsubscribeDocument?.();
        this.unsubscribeDocument = null;

        this.unsubscribeCamera?.();
        this.unsubscribeCamera = null;

        for (const unsubscribe of this.collabUnsubscribers) {
            unsubscribe();
        }
        this.collabUnsubscribers = [];

        this.localController.detach();
        this.remoteController?.detach();
        this.collabBridge?.detach();
        this.viewport.unmount();

        this.mounted = false;
        this.emitState();
        this.emitView();
        this.emitInteraction();
    }

    subscribeState(listener: () => void): () => void {
        this.stateListeners.add(listener);
        return () => {
            this.stateListeners.delete(listener);
        };
    }

    subscribeView(listener: () => void): () => void {
        this.viewListeners.add(listener);
        return () => {
            this.viewListeners.delete(listener);
        };
    }

    subscribeInteraction(listener: () => void): () => void {
        this.interactionListeners.add(listener);
        return () => {
            this.interactionListeners.delete(listener);
        };
    }

    getCamera() {
        return this.viewport.getCamera();
    }

    getInteractionState(): InteractionState {
        return { ...this.interactionState };
    }

    resize(): void {
        this.viewport.resize();
        this.renderFromDocument();
        this.emitView();
    }

    setBrushSettings(brush: BrushSettings): void {
        this.localController.setBrushSettings(brush);
        this.emitStateIfChanged(true);
    }

    getBrushSettings(): BrushSettings {
        return this.localController.getBrushSettings();
    }

    clear(): void {
        this.document.clear();
        this.undoRedoController.clearHistory();
        this.collabBridge?.sendClear();
        this.renderFromDocument();
        this.emitStateIfChanged(true);
        this.emitView();
    }

    exportSvg(options?: {
        includeBackground?: boolean;
        backgroundColor?: string | null;
    }): string | null {
        return this.document.exportSvg(options);
    }

    getSnapshot(): StrokeRecord[] {
        return this.document.getCommittedStrokes().map((stroke) => ({ ...stroke }));
    }

    loadSnapshot(snapshot: StrokeRecord[]): void {
        this.document.importSnapshot(snapshot);
        this.undoRedoController.clearHistory();
        this.renderFromDocument();
        this.emitStateIfChanged(true);
        this.emitView();
    }

    getPublicState(): PublicState {
        return {
            strokeCount: this.document.getVisibleCommittedStrokes().length,
            canUndo: this.undoRedoController.canUndo(),
            canRedo: this.undoRedoController.canRedo(),
            brushSettings: this.localController.getBrushSettings(),
        };
    }

    undo(): void {
        const op = this.undoRedoController.undo();
        if (!op) return;

        if (op.type === "hide") {
            this.collabBridge?.sendStrokeHide(op.strokeId);
        }

        this.emitStateIfChanged(true);
    }

    redo(): void {
        const op = this.undoRedoController.redo();
        if (!op) return;

        if (op.type === "show") {
            this.collabBridge?.sendStrokeShow(op.strokeId);
        }

        this.emitStateIfChanged(true);
    }

    requestSnapshot(targetUserId: string): void {
        this.collabBridge?.requestSnapshot(targetUserId);
    }

    requestBrushStates(targetUserId: string): void {
        this.collabBridge?.requestBrushStates(targetUserId);
    }

    sendBrushState(targetUserId: string): void {
        const brush = this.localController.getBrushSettings();
        this.collabBridge?.sendBrushState(targetUserId, brush);
    }

    markRemoteSyncReady(): void {
        this.remoteController?.setReady(true);
        this.remoteController?.flushQueuedEvents();
        this.requestRender();
        this.emitStateIfChanged(true);
    }

    markRemoteSyncWaiting(): void {
        this.remoteController?.setReady(false);
    }

    private renderFromDocument(): void {
        this.viewport.render(this.document.getSceneSnapshot());
    }

    private emitState(): void {
        for (const listener of this.stateListeners) {
            listener();
        }
    }

    private emitView(): void {
        for (const listener of this.viewListeners) {
            listener();
        }
    }

    private emitInteraction(): void {
        for (const listener of this.interactionListeners) {
            listener();
        }
    }

    private computePublicStateKey(): string {
        const state = this.getPublicState();
        const brush = state.brushSettings;

        return JSON.stringify({
            strokeCount: state.strokeCount,
            canUndo: state.canUndo,
            canRedo: state.canRedo,
            brushColor: brush.brushColor,
            size: brush.strokeOptions.size,
            thinning: brush.strokeOptions.thinning,
            smoothing: brush.strokeOptions.smoothing,
            streamline: brush.strokeOptions.streamline,
            simulatePressure: brush.strokeOptions.simulatePressure,
            startTaper: brush.strokeOptions.start?.taper,
            startCap: brush.strokeOptions.start?.cap,
            endTaper: brush.strokeOptions.end?.taper,
            endCap: brush.strokeOptions.end?.cap,
        });
    }

    private emitStateIfChanged(force = false): void {
        const nextKey = this.computePublicStateKey();
        if (!force && nextKey === this.lastPublicStateKey) return;

        this.lastPublicStateKey = nextKey;
        this.emitState();
    }

    private bindCollabSideEffects(): void {
        if (!this.collabBridge) return;

        this.collabUnsubscribers.push(
            this.collabBridge.subscribeSnapshotRequest((targetUserId) => {
                this.collabBridge?.sendSnapshot(this.getSnapshot(), targetUserId);
            })
        );

        this.collabUnsubscribers.push(
            this.collabBridge.subscribeSnapshot((snapshot) => {
                this.loadSnapshot(snapshot);
                this.markRemoteSyncReady();
            })
        );

        this.collabUnsubscribers.push(
            this.collabBridge.subscribeBrushStateRequest((targetUserId) => {
                this.sendBrushState(targetUserId);
            })
        );
    }
}