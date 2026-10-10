import { useRouter } from "expo-router";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import {
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { useAuth } from "@/auth/auth-context";
import { isCompanyAdminAnywhere } from "@/auth/permissions";
import { useShell } from "@/components/shell/shell-context";
import { ShellSheet } from "@/components/shell/shell-sheet";
import { Icon } from "@/components/ui/icon";
import type { IconName } from "@/components/ui/icon";
import { Eyebrow, RowChevron } from "@/components/ui/typography";
import {
  useBillingAccess,
  useMyCompanies,
} from "@/features/companies/companies-api";
import { useHiddenSections } from "@/features/companies/hidden-sections";
import { useInventoryItems } from "@/features/inventory/inventory-api";
import { useWorkerMode } from "@/features/labor/use-worker-mode";
import { useProducts, useSuppliers } from "@/features/library/library-api";
import { useSelectedProject } from "@/features/projects/selected-project";
import { useProjectCan } from "@/features/projects/use-project-can";
import { summarizeInventory } from "@/lib/inventory/inventory-helpers";
import { useTokens } from "@/theme/tokens";

/**
 * Project sections that live behind the Menu (the four tabs cover overview / invoices / labor /
 * planning). `documents` is reserved to callers who may write the project: the whole documents
 * area — listing included — requires `project:update`.
 */
const MENU_PROJECT_SECTIONS: {
  key: string;
  icon: IconName;
  requiresUpdate?: boolean;
}[] = [
  { key: "documents", icon: "folder", requiresUpdate: true },
  { key: "photos", icon: "image" },
  { key: "notes", icon: "edit-3" },
  { key: "salaries", icon: "credit-card" },
  { key: "chiffrage", icon: "clipboard" },
  { key: "analyses", icon: "bar-chart-2" },
  { key: "members", icon: "user-plus" },
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
 * Menu tab sheet: cross-project areas (Báo giá & hóa đơn, Thư viện sản phẩm, Kho thiết bị) plus the project
 * sections that are not tabs, so nothing the old section bar offered is lost.
 */
export function MenuSheet() {
  const { t } = useTranslation();
  const router = useRouter();
  const { height } = useWindowDimensions();
  const { sheet, closeSheet } = useShell();
  const { projectId } = useSelectedProject();
  const canUpdateProject = useProjectCan(projectId, "project:update");
  const { workerMode } = useWorkerMode();
  const { user } = useAuth();
  const billing = useBillingAccess();
  const companyAdmin = isCompanyAdminAnywhere(user);
  const hidden = useHiddenSections();
  const companies = useMyCompanies();
  const companyId = companies.data?.[0]?.id ?? null;
  const products = useProducts(companyId, {
    supplier: null,
    category: null,
    q: "",
    page: 1,
  });
  const suppliers = useSuppliers(companyId);
  // Only fetched while the Menu is open: the count feeds a subtitle, not the shell.
  const inventory = useInventoryItems(companyId, { enabled: sheet === "menu" });

  const go = (path: string) => {
    closeSheet();
    router.push(path);
  };

  const projectSections = MENU_PROJECT_SECTIONS.filter(
    (section) =>
      (!section.requiresUpdate || canUpdateProject) && !hidden.has(section.key),
  );

  const librarySub =
    products.data && suppliers.data
      ? t("shell.librarySub", {
          products: products.data.total,
          suppliers: suppliers.data.length,
        })
      : undefined;
  const inventorySummary = inventory.data
    ? summarizeInventory(inventory.data.items)
    : null;
  const inventorySub = inventorySummary
    ? t("shell.inventorySub", {
        units: inventorySummary.quantity,
        damaged: inventorySummary.damaged,
      })
    : undefined;

  const areaRows: Omit<ComponentProps<typeof MenuRow>, "last">[] = [
    ...(billing.allowed && !hidden.has("billing")
      ? [
          {
            testID: "menu-billing",
            icon: "file-text" as const,
            title: t("shell.billingTitle"),
            subtitle: t("shell.billingSub"),
            onPress: () => go("/billing"),
          },
        ]
      : []),
    ...(hidden.has("library")
      ? []
      : [
          {
            testID: "menu-library",
            icon: "package" as const,
            title: t("library.title"),
            subtitle: librarySub,
            onPress: () => go("/library"),
          },
        ]),
    ...(hidden.has("inventory")
      ? []
      : [
          {
            testID: "menu-inventory",
            icon: "tool" as const,
            title: t("inventory.title"),
            subtitle: inventorySub,
            onPress: () => go("/inventory"),
          },
        ]),
    ...(companyAdmin
      ? [
          {
            testID: "menu-company-members",
            icon: "user-plus" as const,
            title: t("companies.members.title"),
            onPress: () => go("/company/members"),
          },
        ]
      : []),
  ];

  return (
    <ShellSheet open={sheet === "menu"} testID="menu-sheet">
      <ScrollView style={{ maxHeight: height * 0.62 }} bounces={false}>
        <Eyebrow className="mb-2">{t("shell.menu")}</Eyebrow>
        {areaRows.length > 0 ? (
          <View className="overflow-hidden rounded-xl border border-line bg-card">
            {areaRows.map((row, index) => (
              <MenuRow
                key={row.testID}
                {...row}
                last={index === areaRows.length - 1}
              />
            ))}
          </View>
        ) : null}
        {projectId && !workerMode ? (
          <>
            <Eyebrow className="mb-2 mt-4">
              {t("shell.projectSections")}
            </Eyebrow>
            <View className="mb-1 overflow-hidden rounded-xl border border-line bg-card">
              {projectSections.map((section, index) => (
                <MenuRow
                  key={section.key}
                  testID={`menu-section-${section.key}`}
                  icon={section.icon}
                  title={t(`project.sections.${section.key}`)}
                  onPress={() => go(`/projects/${projectId}/${section.key}`)}
                  last={index === projectSections.length - 1}
                />
              ))}
            </View>
          </>
        ) : null}
      </ScrollView>
    </ShellSheet>
  );
}
