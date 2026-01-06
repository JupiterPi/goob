import { useEffect, useState } from "react";

export function useTimer() {
    const [time, setTime] = useState(new Date().getTime());
    useEffect(() => {
        const interval = setInterval(() => {
            setTime(new Date().getTime());
        }, 500);
        return () => clearInterval(interval);
    }, []);
    return time;
}

// A hook that has a default value and resets to it after some time after it changes
export function useEphemeral<T>(defaultValue: T, timeoutMs: number) {
    const [value, setValue] = useState<T>(defaultValue);
    useEffect(() => {
        if (value === defaultValue) {
            return;
        }
        const timeout = setTimeout(() => {
            setValue(defaultValue);
        }, timeoutMs);
        return () => clearTimeout(timeout);
    }, [value, defaultValue]);
    return [value, setValue] as const;
}

// todo: use this elsewhere
export function CopyButton({ label, onCopy }: { label?: string; onCopy?: () => string }) {
    const [wasJustCopied, setWasJustCopied] = useEphemeral(false, 2000);
    const handleCopy = () => {
        let textToCopy = "";
        if (onCopy) {
            textToCopy = onCopy();
        }
        navigator.clipboard.writeText(textToCopy).then(() => {
            setWasJustCopied(true);
        });
    };
    return (
        <button className="_button" onClick={handleCopy}>
            {wasJustCopied ? "Copied!" : label}
        </button>
    );
}