import type { BrushSettings } from "drawers-shared";
import type { IDrawingRuntime } from "../app/DrawingRuntime";
import { DrawingRuntime } from "../app/DrawingRuntime";
import type { ICollaborationBridge } from "../collab/CollaborationBridge";

let runtimeInstance: IDrawingRuntime | null = null;

export function getDrawingRuntime(params?: {
    initialBrushSettings: BrushSettings;
    authorId?: string;
    collabBridge?: ICollaborationBridge;
}) {
    if (!runtimeInstance) {
        if (!params?.initialBrushSettings) {
            throw new Error(
                "getDrawingRuntime: initialBrushSettings is required when creating the runtime for the first time."
            );
        }

        runtimeInstance = new DrawingRuntime({
            initialBrushSettings: params.initialBrushSettings,
            userId: params.authorId,
            collabBridge: params.collabBridge,
        });
    }

    return runtimeInstance;
}

export function resetDrawingRuntime() {
    runtimeInstance?.unmount();
    runtimeInstance = null;
}