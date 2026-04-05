import type {
    ActiveStrokeStream,
    Bounds,
    DrawingCommand,
    IStrokeDocument,
    SceneSnapshot,
    StrokeId,
    StrokeRecord,
    StrokePoint,
} from "./types";
import { StrokeGeometry } from "../geometry/StrokeGeometry";

type InternalEntry = {
    stroke: StrokeRecord;
    isVisible: boolean;
};

type SvgCache = {
    dirtyFromIndex: number | null;
};

export class StrokeDocument implements IStrokeDocument {
    private background: string | null = "#ffffff";

    private entries: InternalEntry[] = [];
    private activeStreams = new Map<string, ActiveStrokeStream>();

    private visibleDocumentBounds: Bounds | null = null;
    private areBoundsDirty = false;

    private svgCache: SvgCache = {
        dirtyFromIndex: 0,
    };

    private listeners = new Set<() => void>();

    apply(command: DrawingCommand): StrokeRecord | null {
        switch (command.type) {
            case "stroke_begin": {
                this.beginStroke(
                    command.streamId,
                    command.point,
                    command.brushSettings,
                    command.userId
                );
                this.emit();
                return null;
            }

            case "stroke_append": {
                this.appendToStroke(command.streamId, command.points);
                this.emit();
                return null;
            }

            case "stroke_commit": {
                const committed = this.commitStroke(command.streamId, command.strokeId);
                this.emit();
                return committed;
            }

            case "stroke_cancel": {
                this.cancelStroke(command.streamId);
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

    getStrokeById(id: StrokeId): StrokeRecord | undefined {
        return this.entries.find((entry) => entry.stroke.id === id)?.stroke;
    }

    getCommittedStrokes(): StrokeRecord[] {
        return this.entries.map((entry) => entry.stroke);
    }

    getVisibleCommittedStrokes(): StrokeRecord[] {
        return this.entries
            .filter((entry) => entry.isVisible)
            .map((entry) => entry.stroke);
    }

    getActiveStreams(): ActiveStrokeStream[] {
        return Array.from(this.activeStreams.values()).map((stream) => ({
            streamId: stream.streamId,
            userId: stream.userId,
            brushSettings: stream.brushSettings,
            points: [...stream.points],
        }));
    }

    getDocumentBounds(): Bounds | null {
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
                        id: stream.streamId,
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
        this.svgCache.dirtyFromIndex = 0;
        this.emit();
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => {
            this.listeners.delete(listener);
        };
    }

    importCommittedStroke(stroke: StrokeRecord): void {
        const normalized = this.normalizeIncomingStroke(stroke);
        const insertIndex = this.entries.length;

        this.entries.push({
            stroke: normalized,
            isVisible: true,
        });

        this.markSvgDirtyFrom(insertIndex);
        this.visibleDocumentBounds = StrokeGeometry.unionBounds(
            this.visibleDocumentBounds,
            normalized.bounds
        );

        this.emit();
    }

    importSnapshot(strokes: StrokeRecord[]): void {
        this.entries = strokes.map((stroke) => ({
            stroke: this.normalizeIncomingStroke(stroke),
            isVisible: true,
        }));

        this.activeStreams.clear();
        this.visibleDocumentBounds = null;
        this.areBoundsDirty = true;
        this.svgCache.dirtyFromIndex = 0;

        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener();
        }
    }

    private beginStroke(
        streamId: string,
        point: StrokePoint,
        brushSettings: StrokeRecord["brushSettings"],
        userId?: string
    ): void {
        const stabilizedPoints: StrokePoint[] = [point, point];

        this.activeStreams.set(streamId, {
            streamId,
            userId,
            brushSettings,
            points: stabilizedPoints,
        });
    }

    private appendToStroke(streamId: string, points: StrokePoint[]): void {
        if (points.length === 0) return;

        const stream = this.activeStreams.get(streamId);
        if (!stream) return;

        stream.points.push(...points);
    }

    private commitStroke(streamId: string, strokeId: string | null): StrokeRecord | null {
        const stream = this.activeStreams.get(streamId);
        if (!stream || stream.points.length === 0) {
            this.activeStreams.delete(streamId);
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

        this.activeStreams.delete(streamId);

        if (!bounds) return null;

        if (strokeId === null) 
            strokeId = StrokeGeometry.createStrokeId() 
  
        const stroke: StrokeRecord = {
            id: strokeId,
            userId: stream.userId,
            svgPath,
            brushSettings: stream.brushSettings,
            bounds,
            createdAt: Date.now(),
        };

        const insertIndex = this.entries.length;
        this.entries.push({
            stroke,
            isVisible: true,
        });

        this.markSvgDirtyFrom(insertIndex);
        this.visibleDocumentBounds = StrokeGeometry.unionBounds(
            this.visibleDocumentBounds,
            bounds
        );

        return stroke;
    }

    private cancelStroke(streamId: string): void {
        this.activeStreams.delete(streamId);
    }

    private setStrokeVisibility(strokeId: StrokeId, isVisible: boolean): void {
        const index = this.entries.findIndex((entry) => entry.stroke.id === strokeId);
        if (index === -1) return;

        const entry = this.entries[index];
        if (entry.isVisible === isVisible) return;

        entry.isVisible = isVisible;
        this.markSvgDirtyFrom(index);
        this.areBoundsDirty = true;
    }

    private markSvgDirtyFrom(index: number): void {
        if (this.svgCache.dirtyFromIndex === null) {
            this.svgCache.dirtyFromIndex = index;
            return;
        }

        this.svgCache.dirtyFromIndex = Math.min(this.svgCache.dirtyFromIndex, index);
    }

    private recomputeBoundsIfNeeded(): void {
        if (!this.areBoundsDirty) return;

        let nextBounds: Bounds | null = null;

        for (const entry of this.entries) {
            if (!entry.isVisible) continue;
            nextBounds = StrokeGeometry.unionBounds(nextBounds, entry.stroke.bounds);
        }

        this.visibleDocumentBounds = nextBounds;
        this.areBoundsDirty = false;
    }

    private normalizeIncomingStroke(stroke: StrokeRecord): StrokeRecord {
        return {
            id: stroke.id || StrokeGeometry.createStrokeId(),
            userId: stroke.userId,
            svgPath: stroke.svgPath,
            brushSettings: stroke.brushSettings,
            bounds: stroke.bounds,
            createdAt: stroke.createdAt ?? Date.now(),
        };
    }
}