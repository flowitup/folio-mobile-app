import { Link, usePathname } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text } from "react-native";

// Mirrors the web project sidebar. Order matters: it is the order users scan on the phone.
export const PROJECT_SECTIONS = [
  "overview",
  "invoices",
  "labor",
  "salaries",
  "documents",
  "photos",
  "notes",
  "planning",
  "chiffrage",
  "analyses",
  "members",
  "tags",
  "settings",
] as const;

export type ProjectSection = (typeof PROJECT_SECTIONS)[number];

type Props = { projectId: string };

export function ProjectSectionBar({ projectId }: Props) {
  const { t } = useTranslation();
  const pathname = usePathname();
  const base = `/projects/${projectId}`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="max-h-12 border-b border-border bg-white"
      contentContainerClassName="px-2"
      testID="project-section-bar"
    >
      {PROJECT_SECTIONS.map((section) => {
        const href = section === "overview" ? base : `${base}/${section}`;
        const active =
          section === "overview"
            ? pathname === base
            : pathname.startsWith(href);
        return (
          <Link key={section} href={href} replace asChild>
            <Pressable
              testID={`section-${section}`}
              className={`justify-center border-b-2 px-3 ${active ? "border-primary" : "border-transparent"}`}
            >
              <Text
                className={
                  active
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }
              >
                {t(`project.sections.${section}`)}
              </Text>
            </Pressable>
          </Link>
        );
      })}
    </ScrollView>
  );
}
