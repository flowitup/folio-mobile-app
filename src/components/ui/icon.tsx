import { Feather } from "@expo/vector-icons";
import type { ComponentProps } from "react";

export type IconName = ComponentProps<typeof Feather>["name"];

type Props = {
  name: IconName;
  size?: number;
  color: string;
  style?: ComponentProps<typeof Feather>["style"];
};

/**
 * 24px outline icon set. The hand-off draws Lucide paths inline; `lucide-react-native` needs
 * react-native-svg (a native module), so the app uses Feather — the set Lucide forked — through
 * expo-font. Names are Feather's (`home`, `users`, `calendar`, `grid`, `bell`, `plus`…).
 */
export function Icon({ name, size = 24, color, style }: Props) {
  return <Feather name={name} size={size} color={color} style={style} />;
}
