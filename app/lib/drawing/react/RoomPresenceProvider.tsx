"use client";

import * as React from "react";
import { toast } from "sonner";
import type { BrushSettings, CursorEvent, RoomUsers } from "drawers-shared";

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
import { useDrawingRoomSession } from "../react/DrawingRoomSessionProvider";

type RoomPresenceContextValue = {
  hostUserId: string;
  foreignUserStates: ForeignUserMap;
  cursorStore: IRemoteCursorStore;
  initRoomPresence: () => Promise<{ users: RoomUsers; hostId: string }>;
  refreshRoomInfo: () => Promise<void>;
};

const RoomPresenceContext = React.createContext<RoomPresenceContextValue | null>(null);

export function RoomPresenceProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [hostUserId, setHostUserId] = React.useState("");
  const hostUserIdRef = React.useRef("");

  const [foreignUserStates, setForeignUserStates] = React.useState<ForeignUserMap>(
    new Map()
  );
  const foreignUserStatesRef = React.useRef<ForeignUserMap>(new Map());

  const cursorStoreRef = React.useRef<IRemoteCursorStore>(new RemoteCursorStore());
  const hasFinishedInitialSyncRef = React.useRef(false);

  const { socket, thisUserId, fetchUsers } = useDrawingRoomSession();

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

      fresh.forEach((username, id) => {
        if (id === thisUserId) return;

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
    [thisUserId]
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

  const handleUserJoin = React.useCallback(
    (data: RoomUsers) => {
      updateUsers(data);
    },
    [updateUsers]
  );

  const handleUserLeave = React.useCallback(
    (data: RoomUsers) => {
      updateUsers(data);
    },
    [updateUsers]
  );

  const handleHostChanged = React.useCallback(
    (newHostUserId: string) => {
      const prevHostUserId = hostUserIdRef.current;
      hostUserIdRef.current = newHostUserId;
      setHostUserId(newHostUserId);

      if (
        hasFinishedInitialSyncRef.current &&
        newHostUserId === thisUserId &&
        prevHostUserId !== newHostUserId
      ) {
        toast.success("You are now the host of this room.");
      }
    },
    [thisUserId]
  );

  const handleBrushState = React.useCallback(
    (data: {
      targetUserId: string;
      userId: string;
      brushSettings: BrushSettings;
    }) => {
      updateForeignUserState(data.userId, (user) => ({
        ...user,
        brushSettings: data.brushSettings,
      }));
    },
    [updateForeignUserState]
  );

  const handleCursorMove = React.useCallback((data: CursorEvent) => {
    cursorStoreRef.current.setCursor(data.userId, data.x, data.y);
  }, []);

  const initRoomPresence = React.useCallback(async () => {
    const resp = await fetchUsers();

    updateUsers(resp.users, { silent: true });

    setHostUserId(resp.hostId);
    hostUserIdRef.current = resp.hostId;

    hasFinishedInitialSyncRef.current = true;
    return resp;
  }, [fetchUsers, updateUsers]);

  const refreshRoomInfo = React.useCallback(async () => {
    const resp = await fetchUsers();

    updateUsers(resp.users, { silent: true });
    setHostUserId(resp.hostId);
    hostUserIdRef.current = resp.hostId;
  }, [fetchUsers, updateUsers]);

  React.useEffect(() => {
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
    socket,
    handleUserJoin,
    handleUserLeave,
    handleHostChanged,
    handleBrushState,
    handleCursorMove,
  ]);

  React.useEffect(() => {
    if (socket) return;

    setHostUserId("");
    hostUserIdRef.current = "";
    setForeignUserStates(new Map());
    foreignUserStatesRef.current = new Map();
    hasFinishedInitialSyncRef.current = false;
    cursorStoreRef.current.clear?.();
  }, [socket]);

  const value = React.useMemo<RoomPresenceContextValue>(
    () => ({
      hostUserId,
      foreignUserStates,
      cursorStore: cursorStoreRef.current,
      initRoomPresence,
      refreshRoomInfo,
    }),
    [hostUserId, foreignUserStates, initRoomPresence, refreshRoomInfo]
  );

  return (
    <RoomPresenceContext.Provider value={value}>
      {children}
    </RoomPresenceContext.Provider>
  );
}

export function useRoomPresence() {
  const ctx = React.useContext(RoomPresenceContext);
  if (!ctx) {
    throw new Error("useRoomPresence must be used within RoomPresenceProvider");
  }
  return ctx;
}