import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Clipboard, Share, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { memberInviteMessage } from "@/features/companies/member-invite-message";

type Props = {
  /** Who was added, as the company will see them. */
  name: string;
  phone: string;
  company: string;
  onDone: () => void;
};

/**
 * The add-by-phone sheet's last step (D2): adding someone texts them nothing, so the admin gets
 * the message to send them — how to install the app, and to create an account with that number.
 */
export function MemberAddedStep({ name, phone, company, onDone }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const message = memberInviteMessage(t, company, phone);

  return (
    <View testID="add-member-added">
      <Text className="mb-3 font-sans-medium text-[14px] leading-[20px] text-ink">
        {t("companies.members.addByPhone.added.title", { name })}
      </Text>
      <View className="mb-4 rounded-[10px] border border-line-2 bg-paper-2 p-3.5">
        <Text
          testID="add-member-message"
          selectable
          className="font-sans text-[13.5px] leading-[20px] text-ink"
        >
          {message}
        </Text>
      </View>
      <View className="mb-3 flex-row gap-2">
        <Button
          testID="add-member-share"
          label={t("companies.members.addByPhone.added.share")}
          className="flex-1"
          onPress={() => void Share.share({ message }).catch(() => undefined)}
        />
        <Button
          testID="add-member-copy"
          label={
            copied
              ? t("companies.members.addByPhone.added.copied")
              : t("companies.members.addByPhone.added.copy")
          }
          variant="secondary"
          className="flex-1"
          onPress={() => {
            // React Native's own clipboard (react-native-web's on the web build): no new native
            // module for one button.
            Clipboard.setString(message);
            setCopied(true);
          }}
        />
      </View>
      <Button
        testID="add-member-done"
        label={t("companies.members.addByPhone.added.done")}
        variant="ghost"
        onPress={onDone}
      />
    </View>
  );
}
