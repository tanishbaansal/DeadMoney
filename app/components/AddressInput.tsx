import { useState, useRef } from "react";
import { useNavigate } from "react-router";
import { Loader2, Search, CheckCircle2, AlertCircle } from "lucide-react";
import { resolveAddress, isEnsName } from "~/lib/ens";
import { cn } from "~/lib/utils";

type InputState = "idle" | "resolving" | "resolved" | "error";

export function AddressInput() {
  const [value, setValue] = useState("");
  const [state, setState] = useState<InputState>("idle");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [shaking, setShaking] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;

    if (isEnsName(trimmed)) {
      setState("resolving");
      try {
        const addr = await resolveAddress(trimmed);
        setResolvedAddress(addr);
        setState("resolved");
        navigate(`/scan/${addr}`);
      } catch {
        setErrorMsg(`Could not resolve "${trimmed}"`);
        setState("error");
        triggerShake();
      }
    } else {
      try {
        const addr = await resolveAddress(trimmed);
        navigate(`/scan/${addr}`);
      } catch {
        setErrorMsg("Invalid address format");
        setState("error");
        triggerShake();
      }
    }
  }

  function triggerShake() {
    setShaking(true);
    setTimeout(() => setShaking(false), 500);
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value);
    if (state === "error") setState("idle");
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto">
      <div className={cn("relative flex items-center", shaking && "shake")}>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          placeholder="0x... or vitalik.eth"
          autoComplete="off"
          spellCheck={false}
          className={cn(
            "w-full h-14 pl-5 pr-36 font-mono text-sm rounded-xl",
            "bg-[#22222e] text-[#f0f0f5] placeholder:text-[#5a5a6a]",
            "border transition-all duration-200 outline-none",
            state === "error"
              ? "border-red-500 ring-2 ring-red-500/20"
              : "border-[#2a2a3a] focus:border-[#7c3aed] focus:ring-2 focus:ring-[#7c3aed]/20"
          )}
        />

        {/* Status icon inside input */}
        <div className="absolute right-32 top-1/2 -translate-y-1/2 pr-2">
          {state === "resolving" && (
            <Loader2 className="w-4 h-4 text-[#7c3aed] animate-spin" />
          )}
          {state === "resolved" && (
            <CheckCircle2 className="w-4 h-4 text-[#00d4aa]" />
          )}
          {state === "error" && (
            <AlertCircle className="w-4 h-4 text-red-400" />
          )}
        </div>

        <button
          type="submit"
          disabled={state === "resolving" || !value.trim()}
          className={cn(
            "absolute right-2 h-10 px-5 rounded-lg font-semibold text-sm text-white",
            "bg-gradient-to-r from-purple-600 to-purple-700",
            "hover:from-purple-500 hover:to-purple-600",
            "transition-all duration-200 active:scale-95",
            "shadow-[0_0_32px_rgba(124,58,237,0.25)]",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "flex items-center gap-2"
          )}
        >
          {state === "resolving" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Search className="w-3.5 h-3.5" />
          )}
          Scan
        </button>
      </div>

      {/* Status messages */}
      {state === "resolving" && (
        <p className="mt-2 text-xs text-[#9898a8] text-center">
          Resolving {value}...
        </p>
      )}
      {state === "resolved" && resolvedAddress && (
        <p className="mt-2 text-xs text-[#00d4aa] text-center font-mono">
          ✓ Resolved to {resolvedAddress.slice(0, 10)}...{resolvedAddress.slice(-6)}
        </p>
      )}
      {state === "error" && (
        <p className="mt-2 text-xs text-red-400 text-center">{errorMsg}</p>
      )}
    </form>
  );
}
