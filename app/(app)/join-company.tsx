import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/auth/auth-context";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/typography";
import {
  useJoinCompanyByCode,
  useMyCompanies,
} from "@/features/companies/companies-api";
import { normalizeJoinCode } from "@/lib/companies/join-code";
import { useTokens } from "@/theme/tokens";

/**
 * "Tham gia vào công ty": type the company's shared code to join it as a member.
 * Shown right after sign-up (no company yet) and from Settings › Join another company (?another=1).
 */
export default function JoinCompanyScreen() {
  const { t } = useTranslation();
  const tokens = useTokens();
  const router = useRouter();
  const { another } = useLocalSearchParams<{ another?: string }>();
  const { user, signOut } = useAuth();
  const companies = useMyCompanies();
  const join = useJoinCompanyByCode();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const code = normalizeJoinCode(raw);
  const canJoin = code.length >= 4 && !join.isPending;
  const hasCompany = (companies.data?.length ?? 0) > 0;
  const canGoBack = another === "1" || hasCompany;

  function submit() {
    if (!canJoin) return;
    setError(null);
    join.mutate(
      { code },
      {
        onSuccess: () => {
          setRaw("");
          if (router.canGoBack() && canGoBack) router.back();
          else router.replace("/");
        },
        onError: (caught) => setError((caught as Error).message),
      },
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-center px-7 pb-10"
      >
        <View className="mb-7 h-11 w-11 items-center justify-center rounded-xl bg-ink">
          <Text className="font-serif text-2xl text-on-ink">F</Text>
        </View>
        <Text className="mb-1.5 font-serif text-[32px] tracking-[-0.32px] text-ink">
          {t("companies.join.title")}
        </Text>
        <Text className="mb-8 font-sans text-[14px] text-muted">
          {hasCompany
            ? t("companies.join.subtitleAnother")
            : t("companies.join.subtitle", {
                name: user?.email?.startsWith("phone-")
                  ? ""
                  : (user?.email ?? ""),
              })}
        </Text>

        <Eyebrow className="mb-1.5">{t("companies.join.codeLabel")}</Eyebrow>
        <View className="mb-1.5 h-12 flex-row items-center rounded-[10px] border border-line-2 bg-card px-3.5">
          <TextInput
            testID="join-code"
            className="flex-1 font-mono text-[20px] tracking-[3px] text-ink"
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            maxLength={9}
            placeholder="K7Q2-M9XR"
            placeholderTextColor={tokens.muted2}
            // Not reformatted while typing: a controlled value that differs from the keystrokes
            // drops characters on Android. Dashes/spaces are stripped on submit.
            value={raw}
            onChangeText={(text) => setRaw(text.toUpperCase())}
            onSubmitEditing={submit}
            autoFocus
          />
        </View>
        <Text className="mb-6 font-sans text-[12px] text-muted">
          {t("companies.join.hint")}
        </Text>
        {error ? (
          <Text
            testID="join-error"
            className="mb-4 font-sans text-sm text-negative"
          >
            {error}
          </Text>
        ) : null}
        <Button
          testID="join-submit"
          label={t("companies.join.submit")}
          loading={join.isPending}
          disabled={!canJoin}
          onPress={submit}
        />
        <View className="mt-[18px] flex-row items-center justify-between">
          {canGoBack ? (
            <Pressable
              testID="join-back"
              accessibilityRole="button"
              onPress={() =>
                router.canGoBack() ? router.back() : router.replace("/")
              }
              hitSlop={8}
            >
              <Text className="font-sans text-[13px] text-ink">
                {t("common.back")}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Pressable
            testID="join-sign-out"
            accessibilityRole="button"
            onPress={() => void signOut()}
            hitSlop={8}
          >
            <Text className="font-sans text-[13px] text-negative">
              {t("home.signOut")}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
