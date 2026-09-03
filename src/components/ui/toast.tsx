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
import { useSafeAreaInsets } from "react-native-safe-area-context";

export type ToastKind = "info" | "success" | "error";

type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastContextValue = {
  show: (message: string, kind?: ToastKind) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

// Module-level hook so non-React code (query helpers) can raise a toast.
let externalShow: ToastContextValue["show"] | null = null;
export function showToast(message: string, kind: ToastKind = "info"): void {
  externalShow?.(message, kind);
}

const KIND_CLASS: Record<ToastKind, string> = {
  info: "bg-primary",
  success: "bg-success",
  error: "bg-danger",
};

export function ToastProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);
  const insets = useSafeAreaInsets();

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const show = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter.current;
      setItems((current) => [...current, { id, kind, message }]);
      setTimeout(() => dismiss(id), kind === "error" ? 6000 : 3000);
    },
    [dismiss],
  );
  useEffect(() => {
    externalShow = show;
    return () => {
      externalShow = null;
    };
  }, [show]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <View
        pointerEvents="box-none"
        className="absolute left-0 right-0 items-center px-4"
        style={{ top: insets.top + 8 }}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            testID={`toast-${item.kind}`}
            onPress={() => dismiss(item.id)}
            className={`mb-2 w-full rounded-lg px-4 py-3 ${KIND_CLASS[item.kind]}`}
          >
            <Text className="text-sm text-primary-foreground">
              {item.message}
            </Text>
          </Pressable>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}
