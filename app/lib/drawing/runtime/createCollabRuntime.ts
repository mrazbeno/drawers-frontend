import { BrushSettings } from "drawers-shared";
import { DrawingRuntime } from "../app/DrawingRuntime";
import { CollaborationBridge } from "../collab/CollaborationBridge";
import { TypedSocket } from "../../TypedSocket";

export function createCollabDrawingRuntime(params: {
    socket: TypedSocket;
    roomId: string;
    userId: string;
    initialBrushSettings: BrushSettings;
}) {
    const bridge = new CollaborationBridge({
        socket: params.socket,
        roomId: params.roomId,
        userId: params.userId,
    });

    return new DrawingRuntime({
        initialBrushSettings: params.initialBrushSettings,
        userId: params.userId,
        collabBridge: bridge,
    });
}