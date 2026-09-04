import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { Eyebrow, RowChevron } from "@/components/ui/typography";
import {
  useBillingAccess,
  useMyCompanies,
} from "@/features/companies/companies-api";
import { useProducts, useSuppliers } from "@/features/library/library-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useTokens } from "@/theme/tokens";

/** Project sections that live behind the Menu (the four tabs cover overview / invoices / labor / planning). */
const MENU_PROJECT_SECTIONS: { key: string; icon: IconName }[] = [
  { key: "documents", icon: "folder" },
  { key: "photos", icon: "image" },
  { key: "notes", icon: "edit-3" },
  { key: "salaries", icon: "credit-card" },
  { key: "chiffrage", icon: "clipboard" },
  { key: "analyses", icon: "bar-chart-2" },
  { key: "members", icon: "user-plus" },
  { key: "tags", icon: "tag" },
  { key: "settings", icon: "settings" },
];

function MenuRow({
  icon,
  title,
  subtitle,
  onPress,
  testID,
  last = false,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID: string;
  last?: boolean;
}) {
  const tokens = useTokens();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      onPress={onPress}
      className={`flex-row items-center gap-3 px-3.5 py-[13px] active:opacity-70 ${last ? "" : "border-b border-line"}`}
    >
      <View className="h-[34px] w-[34px] items-center justify-center rounded-[10px] bg-paper-2">
        <Icon name={icon} size={16} color={tokens.ink} />
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="font-sans-medium text-[14px] text-ink"
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            className="font-sans text-[11.5px] text-muted"
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      <RowChevron />
    </Pressable>
  );
}

/**
 * Menu tab sheet: cross-project areas (Báo giá & hóa đơn, Thư viện sản phẩm) plus the project
 * sections that are not tabs, so nothing the old section bar offered is lost.
 */
export function MenuSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { sheet, closeSheet } = useShell();
  const { projectId } = useSelectedProject();
  const billing = useBillingAccess();
  const companies = useMyCompanies();
  const companyId = companies.data?.[0]?.id ?? null;
  const products = useProducts(companyId, {
    supplier: null,
    category: null,
    q: "",
    page: 1,
  });
  const suppliers = useSuppliers(companyId);

  const go = (path: string) => {
    closeSheet();
    router.push(path);
  };

  const librarySub =
    products.data && suppliers.data
      ? t("shell.librarySub", {
          products: products.data.total,
          suppliers: suppliers.data.length,
        })
      : undefined;

  return (
    <ShellSheet open={sheet === "menu"} testID="menu-sheet">
      <ScrollView style={{ maxHeight: height * 0.62 }} bounces={false}>
        <Eyebrow className="mb-2">{t("shell.menu")}</Eyebrow>
        <View className="overflow-hidden rounded-xl border border-line bg-card">
          {billing.allowed ? (
            <MenuRow
              testID="menu-billing"
              icon="file-text"
              title={t("billing.title")}
              subtitle={t("shell.billingSub")}
              onPress={() => go("/billing")}
            />
          ) : null}
          <MenuRow
            testID="menu-library"
            icon="package"
            title={t("library.title")}
            subtitle={librarySub}
            onPress={() => go("/library")}
            last
          />
        </View>
        {projectId ? (
          <>
            <Eyebrow className="mb-2 mt-4">
              {t("shell.projectSections")}
            </Eyebrow>
            <View className="mb-1 overflow-hidden rounded-xl border border-line bg-card">
              {MENU_PROJECT_SECTIONS.map((section, index) => (
                <MenuRow
                  key={section.key}
                  testID={`menu-section-${section.key}`}
                  icon={section.icon}
                  title={t(`project.sections.${section.key}`)}
                  onPress={() => go(`/projects/${projectId}/${section.key}`)}
                  last={index === MENU_PROJECT_SECTIONS.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </ShellSheet>
  );
}
