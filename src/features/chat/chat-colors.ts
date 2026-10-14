import { useColorScheme } from "nativewind";

/**
 * Messenger-style chat colors. The blue is the same in both themes; the incoming bubble and the
 * input field are a cool grey that darkens with the app theme.
 */
export function useChatColors() {
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === "dark";
  return {
    blue: "#0084ff",
    blueTint: dark ? "#10304f" : "#e5f1ff",
    bubble: dark ? "#2c2a26" : "#e9eaee",
    bubbleText: dark ? "#f2efe9" : "#1a1a1a",
    input: dark ? "#2c2a26" : "#eef0f3",
  };
}

/** Corner radii of a bubble: 18 px, tight (4 px) on the sender's side inside a run. */
export function bubbleRadii(
  mine: boolean,
  tightTop: boolean,
  tightBottom: boolean,
) {
  const tight = 4;
  const round = 18;
  return mine
    ? {
        borderTopLeftRadius: round,
        borderBottomLeftRadius: round,
        borderTopRightRadius: tightTop ? tight : round,
        borderBottomRightRadius: tightBottom ? tight : round,
      }
    : {
        borderTopRightRadius: round,
        borderBottomRightRadius: round,
        borderTopLeftRadius: tightTop ? tight : round,
        borderBottomLeftRadius: tightBottom ? tight : round,
      };
}
