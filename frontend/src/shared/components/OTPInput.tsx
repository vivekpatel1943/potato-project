import { useRef, useCallback, type KeyboardEvent, type ClipboardEvent } from "react";

interface OTPInputProps {
  length?: number;
  onComplete: (code: string) => void;
  disabled?: boolean;
}

export default function OTPInput({
  length = 6,
  onComplete,
  disabled = false,
}: OTPInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const focusInput = useCallback(
    (index: number) => {
      if (index >= 0 && index < length) {
        inputRefs.current[index]?.focus();
      }
    },
    [length]
  );

  const getOTPValue = useCallback(() => {
    return inputRefs.current.map((input) => input?.value || "").join("");
  }, []);

  const handleInput = useCallback(
    (index: number, value: string) => {
      // Only allow single digit
      const digit = value.replace(/\D/g, "").slice(-1);
      const input = inputRefs.current[index];
      if (input) {
        input.value = digit;
      }

      if (digit && index < length - 1) {
        focusInput(index + 1);
      }

      const otp = getOTPValue();
      if (otp.length === length) {
        onComplete(otp);
      }
    },
    [length, focusInput, getOTPValue, onComplete]
  );

  const handleKeyDown = useCallback(
    (index: number, e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Backspace") {
        e.preventDefault();
        const input = inputRefs.current[index];
        if (input) {
          if (input.value) {
            input.value = "";
          } else if (index > 0) {
            focusInput(index - 1);
            const prevInput = inputRefs.current[index - 1];
            if (prevInput) prevInput.value = "";
          }
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        focusInput(index - 1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        focusInput(index + 1);
      }
    },
    [focusInput]
  );

  const handlePaste = useCallback(
    (e: ClipboardEvent<HTMLInputElement>) => {
      e.preventDefault();
      const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);

      pastedData.split("").forEach((digit, i) => {
        const input = inputRefs.current[i];
        if (input) input.value = digit;
      });

      // Focus the next empty input or the last one
      const nextEmpty = pastedData.length < length ? pastedData.length : length - 1;
      focusInput(nextEmpty);

      if (pastedData.length === length) {
        onComplete(pastedData);
      }
    },
    [length, focusInput, onComplete]
  );

  return (
    <div className="flex gap-2 sm:gap-3 justify-center">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          autoComplete="one-time-code"
          className="w-11 h-13 sm:w-14 sm:h-16 text-center text-xl sm:text-2xl font-bold font-mono
                     border-[1.5px] border-border rounded-lg bg-surface text-text
                     transition-all duration-150
                     focus:border-primary focus:ring-2 focus:ring-primary-light focus:outline-none
                     disabled:opacity-50 disabled:cursor-not-allowed"
          onInput={(e) =>
            handleInput(index, (e.target as HTMLInputElement).value)
          }
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  );
}
