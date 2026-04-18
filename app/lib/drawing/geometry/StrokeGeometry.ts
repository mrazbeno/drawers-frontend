import type { BrushSettings, StrokePoint, StrokeBounds } from "drawers-shared";
import { makeStroke } from "@/app/lib/utility";
import { LINEAR_FN } from "../document/types";

export class StrokeGeometry {
    static createStrokeId(): string {
        return `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    }

    static createSvgPath(points: StrokePoint[], brush: BrushSettings): string {

        // TODO: make this more sophisticated...
        // Perfect freehand StrokeOptions contain functions, which cannot serialized
        // map easing fn to primitive id ? 
        if (brush.strokeOptions.start) brush.strokeOptions.start.easing = LINEAR_FN
        if (brush.strokeOptions.end) brush.strokeOptions.end.easing = LINEAR_FN
        brush.strokeOptions.easing = LINEAR_FN

        return makeStroke(points, brush);
    }

    static computeStrokeBounds(points: StrokePoint[], brush: BrushSettings): StrokeBounds | null {
        if (points.length === 0) return null;

        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        for (const [x, y] of points) {
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }

        const size = brush.strokeOptions.size ?? 1;
        const pad = Math.max(2, size);

        return {
            minX: minX - pad,
            minY: minY - pad,
            maxX: maxX + pad,
            maxY: maxY + pad,
        };
    }

    static unionBounds(a: StrokeBounds | null, b: StrokeBounds | null): StrokeBounds | null {
        if (!a) return b;
        if (!b) return a;

        return {
            minX: Math.min(a.minX, b.minX),
            minY: Math.min(a.minY, b.minY),
            maxX: Math.max(a.maxX, b.maxX),
            maxY: Math.max(a.maxY, b.maxY),
        };
    }

    static escapeXml(value: string): string {
        return value
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&apos;");
    }
}