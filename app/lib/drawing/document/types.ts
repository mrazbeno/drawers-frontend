import type {
    BrushSettings,
    StrokeBounds,
    StrokeHistoryRecord,
    StrokePoint,
} from "drawers-shared";

// TODO: type deduplication

export type { StrokePoint };

export type Bounds = StrokeBounds;

export type StrokeId = string;
export type StreamId = string;

export type StrokeRecord = StrokeHistoryRecord;

export type ActiveStrokeStream = {
    streamId: StreamId;
    userId?: string;
    brushSettings: BrushSettings;
    points: StrokePoint[];
};

export type SceneStroke = {
    id: StrokeId;
    svgPath: string;
    brushColor: string;
};

export type SceneSnapshot = {
    committedStrokes: SceneStroke[];
    activeOverlays: SceneStroke[];
    documentBounds: Bounds | null;
    background: string | null;
};

export type DrawingCommand =
    | {
        type: "stroke_begin";
        streamId: StreamId;
        userId?: string;
        point: StrokePoint;
        brushSettings: BrushSettings;
    }
    | {
        type: "stroke_append";
        streamId: StreamId;
        points: StrokePoint[];
    }
    | {
        type: "stroke_commit";
        streamId: StreamId;
        strokeId: StrokeId | null;
    }
    | {
        type: "stroke_cancel";
        streamId: StreamId;
    }
    | {
        type: "stroke_hide";
        strokeId: StrokeId;
    }
    | {
        type: "stroke_show";
        strokeId: StrokeId;
    }
    | {
        type: "document_clear";
    };

export interface IStrokeDocument {
    apply(command: DrawingCommand): StrokeRecord | null;

    getStrokeById(id: StrokeId): StrokeRecord | undefined;
    getCommittedStrokes(): StrokeRecord[];
    getVisibleCommittedStrokes(): StrokeRecord[];
    getActiveStreams(): ActiveStrokeStream[];

    getDocumentBounds(): Bounds | null;
    getSceneSnapshot(): SceneSnapshot;

    exportSvg(options?: {
        includeBackground?: boolean;
        backgroundColor?: string | null;
    }): string | null;

    importCommittedStroke(stroke: StrokeRecord): void;
    importSnapshot(strokes: StrokeRecord[]): void;

    clear(): void;
    subscribe(listener: () => void): () => void;
}