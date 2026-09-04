import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, Checkbox, EmptyState } from "@/components/ui/primitives";
import { Sheet } from "@/components/ui/sheet";
import type { PaymentMethod } from "@/features/invoices/invoices-api";

import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
} from "./payment-methods-api";

type Props = { companyId: string; readOnly?: boolean };

/** Payment methods of one company: add, rename, toggle company / personal flags, delete (built-ins protected). */
export function PaymentMethodsSection({ companyId, readOnly = false }: Props) {
  const { t } = useTranslation();
  const methods = usePaymentMethods(companyId);
  const create = useCreatePaymentMethod(companyId);
  const update = useUpdatePaymentMethod(companyId);
  const remove = useDeletePaymentMethod(companyId);
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  const editSheet = useRef<BottomSheetModal>(null);

  return (
    <View>
      <Text className="mb-3 text-xs text-muted-foreground">
        {readOnly
          ? t("paymentMethods.readOnlyNote")
          : t("paymentMethods.description")}
      </Text>
      {!readOnly ? (
        <View className="mb-3 flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              testID="pm-label"
              placeholder={t("paymentMethods.addPlaceholder")}
              value={label}
              onChangeText={setLabel}
            />
          </View>
          <Button
            testID="pm-add"
            label={t("paymentMethods.addButton")}
            className="mb-4"
            loading={create.isPending}
            disabled={!label.trim()}
            onPress={() =>
              create.mutate(
                { label: label.trim() },
                { onSuccess: () => setLabel("") },
              )
            }
          />
        </View>
      ) : null}
      {methods.isPending ? <ActivityIndicator /> : null}
      {methods.data && methods.data.length === 0 ? (
        <EmptyState
          message={
            readOnly
              ? t("paymentMethods.noMethodsReadOnly")
              : t("paymentMethods.noMethods")
          }
        />
      ) : null}
      {(methods.data ?? []).map((method) => (
        <Card key={method.id} className="mb-2">
          <View className="flex-row items-center justify-between">
            <Pressable
              testID={`pm-edit-${method.id}`}
              disabled={readOnly}
              onPress={() => {
                setEditing(method);
                setEditLabel(method.label);
                editSheet.current?.present();
              }}
              className="flex-1"
            >
              <Text className="text-base font-medium text-primary">
                {method.label}
              </Text>
            </Pressable>
            {!method.is_active ? <Badge label="inactive" /> : null}
            {!readOnly ? (
              <Pressable
                testID={`pm-delete-${method.id}`}
                onPress={() => setDeleting(method)}
                hitSlop={8}
                className="ml-2"
              >
                <Text className="text-sm text-danger">
                  {t("common.delete")}
                </Text>
              </Pressable>
            ) : null}
          </View>
          {!readOnly ? (
            <View className="mt-2">
              <Checkbox
                testID={`pm-company-${method.id}`}
                label={t("paymentMethods.paidByCompany")}
                value={Boolean(method.is_company_payment)}
                onChange={(next) =>
                  update.mutate({ id: method.id, is_company_payment: next })
                }
              />
              <Checkbox
                testID={`pm-personal-${method.id}`}
                label={t("paymentMethods.personalPayment")}
                value={Boolean(method.is_personal_payment)}
                onChange={(next) =>
                  update.mutate({ id: method.id, is_personal_payment: next })
                }
              />
            </View>
          ) : null}
        </Card>
      ))}

      <Sheet
        ref={editSheet}
        title={t("paymentMethods.title")}
        snapPoints={["40%"]}
      >
        <View className="p-4">
          <Input
            testID="pm-edit-label"
            value={editLabel}
            onChangeText={setEditLabel}
          />
          <Button
            testID="pm-edit-submit"
            label={t("common.save")}
            loading={update.isPending}
            disabled={!editLabel.trim()}
            onPress={() =>
              editing &&
              update.mutate(
                { id: editing.id, label: editLabel.trim() },
                { onSuccess: () => editSheet.current?.dismiss() },
              )
            }
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("paymentMethods.deleteConfirmTitle")}
        message={t("paymentMethods.deleteConfirmBody")}
        confirmLabel={t("paymentMethods.deleteConfirmCta")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { id: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
