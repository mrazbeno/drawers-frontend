import type {
    BrushSettings,
    StrokeBounds,
    StrokeHistoryRecord,
    StrokePoint,
} from "drawers-shared";
import { StrokeOptions } from "perfect-freehand";

// TODO: type deduplication

export type ActiveStrokeStream = {
    roomId: string;
    userId?: string;
    brushSettings: BrushSettings;
    points: StrokePoint[];
};

export type SceneStroke = {
    id: string;
    svgPath: string;
    brushColor: string;
};

export type SceneSnapshot = {
    committedStrokes: SceneStroke[];
    activeOverlays: SceneStroke[];
    documentBounds: StrokeBounds | null;
    background: string | null;
};

export type DrawingCommand =
    | {
        type: "stroke_begin";
        roomId: string;
        userId?: string;
        point: StrokePoint;
        brushSettings: BrushSettings;
    }
    | {
        type: "stroke_append";
        roomId: string;
        points: StrokePoint[];
    }
    | {
        type: "stroke_commit";
        roomId: string;
        strokeId: string | null;
    }
    | {
        type: "stroke_cancel";
        roomId: string;
    }
    | {
        type: "stroke_hide";
        strokeId: string;
    }
    | {
        type: "stroke_show";
        strokeId: string;
    }
    | {
        type: "document_clear";
    };

export interface IStrokeDocument {
    apply(command: DrawingCommand): StrokeHistoryRecord | null;

    getStrokeById(id: string): StrokeHistoryRecord | undefined;
    getCommittedStrokes(): StrokeHistoryRecord[];
    getVisibleCommittedStrokes(): StrokeHistoryRecord[];
    getActiveStreams(): ActiveStrokeStream[];

    getDocumentBounds(): StrokeBounds | null;
    getSceneSnapshot(): SceneSnapshot;

    exportSvg(options?: {
        includeBackground?: boolean;
        backgroundColor?: string | null;
    }): string | null;

    importCommittedStroke(stroke: StrokeHistoryRecord): void;
    importSnapshot(strokes: StrokeHistoryRecord[]): void;

    clear(): void;
    subscribe(listener: () => void): () => void;
}

export const LINEAR_FN = (x: number) => x

export const SOFT_BRUSH_PRESET_STROKE: StrokeOptions = {
    size: 16,
    thinning: 0.5,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: true,

    easing: LINEAR_FN,
    start: {
        taper: 100,
        easing: LINEAR_FN,
        cap: true
    },
    end: {
        taper: 100,
        easing: LINEAR_FN,
        cap: true
    }
};

export const HARD_PENCIL_PRESET_STROKE: StrokeOptions = {
    size: 16,
    thinning: 0,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: false,

    easing: LINEAR_FN,
    start: {
        taper: 0,
        easing: LINEAR_FN,
        cap: true
    },
    end: {
        taper: 0,
        easing: LINEAR_FN,
        cap: true
    }
};

export const DEFAULT_BRUSH_SETTINGS: BrushSettings = {
  strokeOptions: SOFT_BRUSH_PRESET_STROKE,
  brushColor: "#000000",
};