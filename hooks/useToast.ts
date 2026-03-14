import { useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface ToastState {
  msg: string;
  type: ToastType;
}

export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = (msg: string, type: ToastType = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  return { toast, showToast };
}
