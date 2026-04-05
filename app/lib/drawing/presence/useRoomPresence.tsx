"use client";

import * as React from "react";
import { toast } from "sonner";
import type { BrushSettings, CursorEvent, RoomUsers } from "drawers-shared";

import type { SocketContextType } from "@/providers/SocketProvider";
import {
    DEFAULT_STATE,
    ForeignUserMap,
    ForeignUserState,
} from "@/app/lib/types";
import { generateDarkColor } from "@/app/lib/utility";
import {
    IRemoteCursorStore,
    RemoteCursorStore,
} from "@/app/lib/drawing/presence/remoteCursorStore";

export function useRoomPresence(socketStore: SocketContextType) {
    const [hostUserId, setHostUserId] = React.useState("");
    const hostUserIdRef = React.useRef("");

    const [foreignUserStates, setForeignUserStates] = React.useState<ForeignUserMap>(
        new Map()
    );
    const foreignUserStatesRef = React.useRef<ForeignUserMap>(new Map());

    const cursorStoreRef = React.useRef<IRemoteCursorStore>(new RemoteCursorStore());

    const hasFinishedInitialSyncRef = React.useRef(false);

    const updateForeignUserState = React.useCallback(
        (userId: string, updater: (state: ForeignUserState) => ForeignUserState) => {
            const current = foreignUserStatesRef.current;
            const existing = current.get(userId);
            if (!existing) return;

            const updated = new Map(current);
            updated.set(userId, updater(existing));

            foreignUserStatesRef.current = updated;
            setForeignUserStates(updated);
        },
        []
    );

    const diffAndSyncUserMap = React.useCallback(
        (
            current: Map<string, ForeignUserState>,
            fresh: Map<string, string>
        ): {
            newMap: Map<string, ForeignUserState>;
            joined: ForeignUserState[];
            left: ForeignUserState[];
        } => {
            const newMap = new Map<string, ForeignUserState>();
            const joined: ForeignUserState[] = [];
            const left: ForeignUserState[] = [];

            const myId = socketStore.getThisUserId();

            fresh.forEach((username, id) => {
                if (id === myId) return;

                const existing = current.get(id);
                const updated: ForeignUserState = {
                    ...DEFAULT_STATE,
                    ...existing,
                    id,
                    username,
                    color: existing?.color ?? generateDarkColor(),
                };

                newMap.set(id, updated);

                if (!existing) {
                    joined.push(updated);
                }
            });

            current.forEach((state, id) => {
                if (!fresh.has(id)) {
                    left.push(state);
                }
            });

            return { newMap, joined, left };
        },
        [socketStore]
    );

    const updateUsers = React.useCallback(
        (data: RoomUsers, opts?: { silent?: boolean }) => {
            setForeignUserStates((prev) => {
                const { newMap, joined, left } = diffAndSyncUserMap(prev, new Map(data));

                for (const user of left) {
                    cursorStoreRef.current.removeCursor(user.id);
                }

                if (!opts?.silent && hasFinishedInitialSyncRef.current) {
                    if (joined.length > 0) {
                        const joinedStr = joined.map((v) => v.username).join(", ");
                        toast.info(
                            `New user${joined.length > 1 ? "s" : ""} joined: ${joinedStr}`
                        );
                    }

                    if (left.length > 0) {
                        const leftStr = left.map((v) => v.username).join(", ");
                        toast.info(
                            `User${left.length > 1 ? "s" : ""} left: ${leftStr}`
                        );
                    }
                }

                foreignUserStatesRef.current = newMap;
                return newMap;
            });
        },
        [diffAndSyncUserMap]
    );

    const handleUserJoin = React.useCallback((data: RoomUsers) => {
        updateUsers(data);
    }, [updateUsers]);

    const handleUserLeave = React.useCallback((data: RoomUsers) => {
        updateUsers(data);
    }, [updateUsers]);

    const handleHostChanged = React.useCallback((newHostUserId: string) => {
        const prevHostUserId = hostUserIdRef.current;
        hostUserIdRef.current = newHostUserId;
        setHostUserId(newHostUserId);

        if (
            hasFinishedInitialSyncRef.current &&
            newHostUserId === socketStore.getThisUserId() &&
            prevHostUserId !== newHostUserId
        ) {
            toast.success("You are now the host of this room.");
        }
    }, [socketStore]);

    const handleBrushState = React.useCallback((data: {
        targetUserId: string;
        userId: string;
        brushSettings: BrushSettings;
    }) => {
        updateForeignUserState(data.userId, (user) => ({
            ...user,
            brushSettings: data.brushSettings,
        }));
    }, [updateForeignUserState]);

    const handleCursorMove = React.useCallback((data: CursorEvent) => {
        cursorStoreRef.current.setCursor(data.userId, data.x, data.y);
    }, []);

    const initRoomPresence = React.useCallback(async () => {
        const resp = await socketStore.fetchUsers();

        updateUsers(resp.users, { silent: true });

        setHostUserId(resp.hostId);
        hostUserIdRef.current = resp.hostId;

        hasFinishedInitialSyncRef.current = true;
        return resp;
    }, [socketStore, updateUsers]);

    const refreshRoomInfo = React.useCallback(async () => {
        const resp = await socketStore.fetchUsers();
        updateUsers(resp.users, { silent: true });
        setHostUserId(resp.hostId);
        hostUserIdRef.current = resp.hostId;
    }, [socketStore, updateUsers]);

    React.useEffect(() => {
        const socket = socketStore.socket;
        if (!socket) return;

        socket.on("user_joined", handleUserJoin);
        socket.on("user_left", handleUserLeave);
        socket.on("host_changed", handleHostChanged);
        socket.on("brush_state", handleBrushState);
        socket.on("cursor_move", handleCursorMove);

        return () => {
            socket.off("user_joined", handleUserJoin);
            socket.off("user_left", handleUserLeave);
            socket.off("host_changed", handleHostChanged);
            socket.off("brush_state", handleBrushState);
            socket.off("cursor_move", handleCursorMove);
        };
    }, [
        socketStore.socket,
        handleUserJoin,
        handleUserLeave,
        handleHostChanged,
        handleBrushState,
        handleCursorMove,
    ]);

    return {
        hostUserId,
        foreignUserStates,
        cursorStore: cursorStoreRef.current,
        initRoomPresence,
        refreshRoomInfo,
    };
}