import {
  Stack,
  useLocalSearchParams,
  useNavigation,
  usePathname,
} from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { ScreenHeader } from "@/components/ui/screen-header";
import type { ProjectSection } from "@/components/project/project-section-bar";

// Project sections outside the four tabs (documents, photos, notes, chiffrage…) push over the
// tab shell with the "global screen" top bar: back arrow + section title, tab bar kept.
export default function ProjectLayout() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The sections and the invoice screens share this stack, and a tab keeps its screens when
  // the user leaves it: an invoice opened later from Expenses was pushed over the Members
  // screen left from the Menu, so Back landed there. Drop the stack while the tab is away, so
  // the next visit starts from the screen it asks for.
  const navigation = useNavigation();
  const [focused, setFocused] = useState(() => navigation.isFocused());
  useEffect(() => {
    const offFocus = navigation.addListener("focus", () => setFocused(true));
    const offBlur = navigation.addListener("blur", () => setFocused(false));
    return () => {
      offFocus();
      offBlur();
    };
  }, [navigation]);
  const pathname = usePathname();
  const rest = pathname.slice(`/projects/${id}/`.length).split("/");
  const section = rest[0] as ProjectSection | "";
  // The invoice detail (design 1b) draws its own ink header; every other section keeps the bar.
  const ownHeader =
    section === "invoices" && rest.length === 2 && rest[1] !== "new";

  return (
    <>
      {ownHeader ? null : (
        <ScreenHeader
          title={
            section ? t(`project.sections.${section}`) : t("tabs.overview")
          }
          back
        />
      )}
      {focused ? (
        <Stack screenOptions={{ headerShown: false, animation: "none" }} />
      ) : null}
    </>
  );
}
