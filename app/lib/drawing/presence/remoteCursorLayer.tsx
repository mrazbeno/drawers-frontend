"use client";

import * as React from "react";
import { MousePointer2 } from "lucide-react";
import type { IDrawingRuntime } from "@/app/lib/drawing/app/DrawingRuntime";
import type { ForeignUserMap, ForeignUserState } from "@/app/lib/types";
import type { IRemoteCursorStore } from "@/app/lib/drawing/presence/remoteCursorStore";

export function RemoteCursorLayer(props: {
    runtime: IDrawingRuntime | null;
    foreignUserStates: ForeignUserMap;
    cursorStore: IRemoteCursorStore;
}) {
    const [, setVersion] = React.useState(0);

    React.useEffect(() => {
        if (!props.runtime) return;

        const unsubscribeView = props.runtime.subscribeView(() => {
            setVersion((v) => v + 1);
        });

        const unsubscribeCursors = props.cursorStore.subscribe(() => {
            setVersion((v) => v + 1);
        });

        return () => {
            unsubscribeView();
            unsubscribeCursors();
        };
    }, [props.runtime, props.cursorStore]);

    const camera = props.runtime?.getCamera() ?? {
        scale: 1,
        offsetX: 0,
        offsetY: 0,
    };

    const cursorSnapshot = props.cursorStore.getSnapshot();

    return (
        <div
            className="z-3 absolute w-full h-full pointer-events-none select-none bg-transparent"
            draggable={false}
        >
            {Array.from(props.foreignUserStates.values()).map((user) => {
                const pos = cursorSnapshot.get(user.id);
                if (!pos) return null;

                return (
                    <RemoteCursorOverlayItem
                        key={user.id}
                        user={user}
                        worldX={pos.x}
                        worldY={pos.y}
                        scale={camera.scale}
                        offsetX={camera.offsetX}
                        offsetY={camera.offsetY}
                    />
                );
            })}
        </div>
    );
}

function RemoteCursorOverlayItem(props: {
    user: ForeignUserState;
    worldX: number;
    worldY: number;
    scale: number;
    offsetX: number;
    offsetY: number;
}) {
    const left = props.worldX * props.scale + props.offsetX;
    const top = props.worldY * props.scale + props.offsetY;

    return (
        <div
            className="absolute"
            style={{
                left: `${left}px`,
                top: `${top}px`,
                transform: "translate(-50%, -50%)",
            }}
        >
            <MousePointer2 fill="white" stroke="black" className="absolute h-8 w-8" />
            <div
                className="absolute rounded-sm px-2 py-1 top-5 left-5"
                style={{ backgroundColor: props.user.color }}
            >
                {props.user.username}
            </div>
        </div>
    );
}