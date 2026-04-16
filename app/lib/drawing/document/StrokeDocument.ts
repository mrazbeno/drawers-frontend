import type {
    ActiveStrokeStream,
    DrawingCommand,
    IStrokeDocument,
    SceneSnapshot,
} from "./types";
import { StrokeGeometry} from "../geometry/StrokeGeometry";
import { StrokeHistoryRecord, StrokeBounds, StrokePoint} from "drawers-shared";


export class StrokeDocument implements IStrokeDocument {
    private background: string | null = "#ffffff";

    private entries: StrokeHistoryRecord[] = [];
    private activeStreams = new Map<string, ActiveStrokeStream>();

    private visibleDocumentBounds: StrokeBounds | null = null;
    private areBoundsDirty = false;

    private listeners = new Set<() => void>();

    apply(command: DrawingCommand): StrokeHistoryRecord | null {
        switch (command.type) {
            case "stroke_begin": {
                this.beginStroke(
                    command.roomId,
                    command.point,
                    command.brushSettings,
                    command.userId
                );
                this.emit();
                return null;
            }

            case "stroke_append": {
                this.appendToStroke(command.roomId, command.points);
                this.emit();
                return null;
            }

            case "stroke_commit": {
                const committed = this.commitStroke(command.roomId, command.strokeId);
                this.emit();
                return committed;
            }

            case "stroke_cancel": {
                this.cancelStroke(command.roomId);
                this.emit();
                return null;
            }

            case "stroke_hide": {
                this.setStrokeVisibility(command.strokeId, false);
                this.emit();
                return null;
            }

            case "stroke_show": {
                this.setStrokeVisibility(command.strokeId, true);
                this.emit();
                return null;
            }

            case "document_clear": {
                this.clear();
                return null;
            }

            default: {
                const exhaustive: never = command;
                return exhaustive;
            }
        }
    }

    getStrokeById(id: string): StrokeHistoryRecord | undefined {
        return this.entries.find((entry) => entry.id === id);
    }

    getCommittedStrokes(): StrokeHistoryRecord[] {
        return this.entries.map((entry) => entry);
    }

    getVisibleCommittedStrokes(): StrokeHistoryRecord[] {
        return this.entries
            .filter((entry) => entry.isVisible)
            .map((entry) => entry);
    }

    getActiveStreams(): ActiveStrokeStream[] {
        return Array.from(this.activeStreams.values()).map((stream) => ({
            roomId: stream.roomId,
            userId: stream.userId,
            brushSettings: stream.brushSettings,
            points: [...stream.points],
        }));
    }

    getDocumentBounds(): StrokeBounds | null {
        this.recomputeBoundsIfNeeded();
        return this.visibleDocumentBounds;
    }

    getSceneSnapshot(): SceneSnapshot {
        return {
            committedStrokes: this.getVisibleCommittedStrokes().map((stroke) => ({
                id: stroke.id,
                svgPath: stroke.svgPath,
                brushColor: stroke.brushSettings.brushColor,
            })),
            activeOverlays: Array.from(this.activeStreams.values()).flatMap((stream) => {
                if (stream.points.length === 0) return [];

                const svgPath = StrokeGeometry.createSvgPath(
                    stream.points,
                    stream.brushSettings
                );

                return [
                    {
                        id: stream.roomId,
                        svgPath,
                        brushColor: stream.brushSettings.brushColor,
                    },
                ];
            }),
            documentBounds: this.getDocumentBounds(),
            background: this.background,
        };
    }

    exportSvg(options?: {
        includeBackground?: boolean;
        backgroundColor?: string | null;
    }): string | null {
        const strokes = this.getVisibleCommittedStrokes();
        if (strokes.length === 0) return null;

        const bounds = this.getDocumentBounds();
        if (!bounds) return null;

        const width = Math.max(1, bounds.maxX - bounds.minX);
        const height = Math.max(1, bounds.maxY - bounds.minY);

        const includeBackground = options?.includeBackground ?? true;
        const backgroundColor = options?.backgroundColor ?? this.background;

        const bg =
            includeBackground && backgroundColor
                ? `<rect x="${bounds.minX}" y="${bounds.minY}" width="${width}" height="${height}" fill="${StrokeGeometry.escapeXml(backgroundColor)}" />`
                : "";

        const paths = strokes
            .map((stroke) => {
                const d = StrokeGeometry.escapeXml(stroke.svgPath);
                const fill = StrokeGeometry.escapeXml(stroke.brushSettings.brushColor);
                const id = StrokeGeometry.escapeXml(stroke.id);
                const userId = stroke.userId
                    ? ` data-user-id="${StrokeGeometry.escapeXml(stroke.userId)}"`
                    : "";

                return `<path data-stroke-id="${id}"${userId} d="${d}" fill="${fill}" />`;
            })
            .join("\n");

        return `<?xml version="1.0" encoding="UTF-8"?>
<svg
    xmlns="http://www.w3.org/2000/svg"
    version="1.1"
    width="${width}"
    height="${height}"
    viewBox="${bounds.minX} ${bounds.minY} ${width} ${height}"
>
${bg}
${paths}
</svg>`;
    }

    clear(): void {
        this.entries = [];
        this.activeStreams.clear();
        this.visibleDocumentBounds = null;
        this.areBoundsDirty = false;
        this.emit();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    importCommittedStroke(stroke: StrokeHistoryRecord): void {
        const normalized = this.normalizeIncomingStroke(stroke);

        this.entries.push(normalized);

        this.visibleDocumentBounds = StrokeGeometry.unionBounds(
            this.visibleDocumentBounds,
            normalized.bounds
        );

        this.emit();
    }

    importSnapshot(strokes: StrokeHistoryRecord[]): void {
        this.entries = strokes.map((stroke) => this.normalizeIncomingStroke(stroke));

        this.activeStreams.clear();
        this.visibleDocumentBounds = null;
        this.areBoundsDirty = true;

        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private beginStroke(
        roomId: string,
        point: StrokePoint,
        brushSettings: StrokeHistoryRecord["brushSettings"],
        userId?: string
    ): void {
        const stabilizedPoints: StrokePoint[] = [point, point];

        this.activeStreams.set(roomId, {
            roomId,
            userId,
            brushSettings,
            points: stabilizedPoints,
        });
    }

    private appendToStroke(roomId: string, points: StrokePoint[]): void {
        if (points.length === 0) return;

        const stream = this.activeStreams.get(roomId);
        if (!stream) return;

        stream.points.push(...points);
    }

    private commitStroke(roomId: string, strokeId: string | null): StrokeHistoryRecord | null {
        const stream = this.activeStreams.get(roomId);
        if (!stream || stream.points.length === 0) {
            this.activeStreams.delete(roomId);
            return null;
        }

        const svgPath = StrokeGeometry.createSvgPath(
            stream.points,
            stream.brushSettings
        );

        const bounds = StrokeGeometry.computeStrokeBounds(
            stream.points,
            stream.brushSettings
        );

        this.activeStreams.delete(roomId);

        if (!bounds) return null;

        if (strokeId === null) 
            strokeId = StrokeGeometry.createStrokeId() 
  
        const stroke: StrokeHistoryRecord = {
            id: strokeId,
            userId: stream.userId,
            svgPath,
            brushSettings: stream.brushSettings,
            bounds,
            createdAt: Date.now(),
            isVisible: true
        };

        this.entries.push(stroke);
        this.visibleDocumentBounds = StrokeGeometry.unionBounds(
            this.visibleDocumentBounds,
            bounds
        );

        return stroke;
    }

    private cancelStroke(roomId: string): void {
        this.activeStreams.delete(roomId);
    }

    private setStrokeVisibility(strokeId: string, isVisible: boolean): void {
        const index = this.entries.findIndex((entry) => entry.id === strokeId);
        if (index === -1) return;

        const entry = this.entries[index];
        if (entry.isVisible === isVisible) return;

        entry.isVisible = isVisible;
        this.areBoundsDirty = true;
    }

    private recomputeBoundsIfNeeded(): void {
        if (!this.areBoundsDirty) return;

        let nextBounds: StrokeBounds | null = null;

        for (const entry of this.entries) {
            if (!entry.isVisible) continue;
            nextBounds = StrokeGeometry.unionBounds(nextBounds, entry.bounds);
        }

        this.visibleDocumentBounds = nextBounds;
        this.areBoundsDirty = false;
    }

    private normalizeIncomingStroke(stroke: StrokeHistoryRecord): StrokeHistoryRecord {
        return {
            id: stroke.id || StrokeGeometry.createStrokeId(),
            userId: stroke.userId,
            svgPath: stroke.svgPath,
            brushSettings: stroke.brushSettings,
            bounds: stroke.bounds,
            createdAt: stroke.createdAt ?? Date.now(),
            isVisible: stroke.isVisible
        };
    }
}