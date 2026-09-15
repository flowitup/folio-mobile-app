import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, Text, View } from "react-native";

import { AccountDeletionBlockedError, useAuth } from "@/auth/auth-context";
import { useTokens } from "@/theme/tokens";

type Props = {
  testID?: string;
  /** Styles the pressable; lets the sheet row and the onboarding link differ. */
  className?: string;
  /** Styles the label. */
  textClassName?: string;
  /** Run after a successful deletion, before the session is dropped (e.g. close a sheet). */
  onDeleted?: () => void;
};

/**
 * "Supprimer mon compte" — the App Store 5.1.1(v) entry point.
 *
 * Lives in its own component because it has to appear everywhere a signed-in user
 * can get stuck: the account sheet, and both onboarding dead-ends, where a brand-new
 * account that has not joined a company yet has no account sheet to open. A reviewer
 * who signs up and stops there must still be able to delete the account.
 */
export function DeleteAccountAction({
  testID = "account-delete",
  className = "",
  textClassName = "",
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const tokens = useTokens();
  const { deleteAccount } = useAuth();
  const [deleting, setDeleting] = useState(false);

  // Two steps on purpose: erasure is immediate and irreversible, so the native
  // destructive dialog spells out what is deleted and what the company keeps
  // before anything is sent.
  const confirmDelete = () => {
    Alert.alert(
      t("account.delete.confirmTitle"),
      t("account.delete.confirmBody"),
      [
        { text: t("account.delete.cancel"), style: "cancel" },
        {
          text: t("account.delete.confirm"),
          style: "destructive",
          onPress: () => void runDelete(),
        },
      ],
      { cancelable: true },
    );
  };

  const runDelete = async () => {
    setDeleting(true);
    try {
      await deleteAccount();
      onDeleted?.();
      // No navigation here: clearing the session re-routes to the login screen.
    } catch (error) {
      if (error instanceof AccountDeletionBlockedError) {
        Alert.alert(
          t("account.delete.blockedTitle"),
          t("account.delete.blockedBody", { company: error.companyName }),
          [{ text: t("account.delete.ok") }],
        );
      } else {
        Alert.alert(t("account.delete.failed"), undefined, [
          { text: t("account.delete.ok") },
        ]);
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: deleting }}
      disabled={deleting}
      onPress={confirmDelete}
      hitSlop={8}
      className={className}
    >
      <View className="flex-row items-center gap-2">
        {deleting ? (
          <ActivityIndicator size="small" color={tokens.muted} />
        ) : null}
        <Text className={textClassName}>
          {deleting ? t("account.delete.deleting") : t("account.delete.title")}
        </Text>
      </View>
    </Pressable>
  );
}
