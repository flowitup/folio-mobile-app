import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PropsWithChildren } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaInsetsContext } from "react-native-safe-area-context";

export type ToastKind = "info" | "success" | "error";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void;
  dismiss: (id: number) => void;
  items: ToastItem[];
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Module-level hook so non-React code (query helpers) can raise a toast.
let externalShow: ToastContextValue["show"] | null = null;
export function showToast(message: string, kind: ToastKind = "info"): void {
  externalShow?.(message, kind);
}

const KIND_CLASS: Record<ToastKind, string> = {
  info: "bg-ink",
  success: "bg-positive",
  error: "bg-negative",
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter.current;
      setItems((current) => [...current, { id, kind, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3000),
      );
    },
    [dismiss],
  );

  useEffect(() => {
    externalShow = show;
    const pending = timers.current;
    return () => {
      externalShow = null;
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, [show]);

  const value = useMemo(
    () => ({ show, dismiss, items }),
    [show, dismiss, items],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport />
    </ToastContext.Provider>
  );
}

/**
 * Renders the active toasts. The provider mounts one at the root; native `Modal`s
 * (ConfirmDialog, iOS date picker) render their own copy because a Modal window sits
 * above the root view and would otherwise hide toasts raised while it is open.
 */
export function ToastViewport() {
  const context = useContext(ToastContext);
  // Read insets without throwing when rendered outside a SafeAreaProvider (unit tests).
  const insets = useContext(SafeAreaInsetsContext);
  if (!context || context.items.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      className="absolute left-0 right-0 items-center px-4"
      style={{ top: (insets?.top ?? 0) + 8 }}
    >
      {context.items.map((item) => (
        <Pressable
          key={item.id}
          testID={`toast-${item.kind}`}
          onPress={() => context.dismiss(item.id)}
          className={`mb-2 w-full rounded-xl px-4 py-3 ${KIND_CLASS[item.kind]}`}
        >
          <Text className="font-sans text-sm text-on-ink">
            {item.message}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function useToast(): Pick<ToastContextValue, "show"> {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return { show: context.show };
}
