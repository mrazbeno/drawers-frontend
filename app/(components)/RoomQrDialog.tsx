"use client";

import React from "react";
import QRCode from "react-qr-code";
import { QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import CopyButton from "./CopyButton";

type RoomQrDialogProps = {
    roomId: string;
};

export default function RoomQrDialog({
    roomId,
}: RoomQrDialogProps) {

    // TODO: also source roomid from context here

    const [joinUrl, setJoinUrl] = React.useState("");

    React.useEffect(() => {
        if (!roomId) {
            setJoinUrl("");
            return;
        }

        setJoinUrl(
            `${window.location.origin}/?roomId=${encodeURIComponent(roomId)}`
        );
    }, [roomId]);

    return (
        <Dialog>
            <DialogTrigger asChild>
                <Button
                    type="button"
                    variant={"outline"}
                    size={"default"}
                    disabled={!roomId}
                >
                    <QrCode />
                </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Join room via QR code</DialogTitle>
                    <DialogDescription>
                        Scan this QR code to open the app with room code{" "}
                        <span className="font-medium">{roomId}</span>. The user will
                        still be asked for a username before joining.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-col items-center gap-4 py-4">
                    {joinUrl && (
                        <>
                            <div className="rounded-xl bg-white p-4 shadow-sm">
                                <QRCode value={joinUrl} size={220} />
                            </div>

                            <div className="w-full flex gap-2 items-center">
                                <Input readOnly value={joinUrl} />
                                <CopyButton
                                    showText={true}
                                    copyString={joinUrl}
                                />
                            </div>
                        </>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}