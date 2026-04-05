"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ExportSvgFloater(props: {
    onExportSvg: () => void;
}) {
    return (
        <div className="absolute flex w-full bottom-36 z-30">
            
            <Button
                type="button"
                onClick={props.onExportSvg}
                size="icon"
                variant="secondary"
                className="shadow-md"
                title="Export SVG"
            >
                <Download />
                Download SVG
            </Button>
        </div>
    );
}

