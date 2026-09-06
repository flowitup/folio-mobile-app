import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { showToast } from "@/components/ui/toast";
import { Eyebrow } from "@/components/ui/typography";
import {
  useDecideAttendanceChange,
  useRejectAttendance,
  useValidateAttendance,
} from "@/features/labor/labor-api";
import type { AttendancePending } from "@/features/notes/notes-api";
import { formatDate } from "@/lib/format/date";

type Shift = AttendancePending["shift_type"] | undefined;

/**
 * Bell section for managers: worker-submitted days waiting for validation
 * (`attendance_pending`) and proposed edits on already validated days
 * (`attendance_change`, shown as "current → requested"). Validate / Apply settles
 * immediately; Reject / Refuse asks for confirmation first.
 */
export function AttendanceRequestsSection({
  items,
}: {
  items: AttendancePending[];
}) {
  const { t } = useTranslation();
  const validate = useValidateAttendance();
  const reject = useRejectAttendance();
  const decide = useDecideAttendanceChange();
  const [rejecting, setRejecting] = useState<AttendancePending | null>(null);
  const busy = validate.isPending || decide.isPending;

  const shiftLabel = (shift: Shift, hours: number | null | undefined) => {
    const base = t(`labor.shift.${shift ?? "none"}`);
    return hours && hours > 0 ? `${base} · +${hours} h` : base;
  };
  const isChange = (item: AttendancePending) =>
    item.kind === "attendance_change";
  const ids = (item: AttendancePending) => ({
    projectId: item.project_id,
    entryId: item.entry_id,
  });
  const toast = (key: string) => () => showToast(t(key), "success");

  function approve(item: AttendancePending) {
    if (isChange(item))
      decide.mutate(
        { ...ids(item), approve: true },
        { onSuccess: toast("notifications.attendance.validatedChangeToast") },
      );
    else
      validate.mutate(ids(item), {
        onSuccess: toast("notifications.attendance.validatedToast"),
      });
  }

  function confirmReject() {
    if (!rejecting) return;
    const done = (key: string) => () => {
      setRejecting(null);
      showToast(t(key), "success");
    };
    if (isChange(rejecting))
      decide.mutate(
        { ...ids(rejecting), approve: false },
        { onSuccess: done("notifications.attendance.rejectedChangeToast") },
      );
    else
      reject.mutate(ids(rejecting), {
        onSuccess: done("notifications.attendance.rejectedToast"),
      });
  }

  if (items.length === 0) return null;

  return (
    <>
      <Eyebrow className="mb-2">
        {t("notifications.attendance.title", { count: items.length })}
      </Eyebrow>
      <View className="mb-4 overflow-hidden rounded-xl border border-line bg-card">
        <View>
          {items.map((item) => (
            <View
              key={item.entry_id}
              testID={`attendance-pending-${item.entry_id}`}
              className="gap-2 border-b border-line px-3.5 py-3"
            >
              <Text
                className="font-sans-medium text-[14px] text-ink"
                numberOfLines={1}
              >
                {item.worker_name} · {formatDate(item.date)}
              </Text>
              <Text
                className="font-sans text-[11.5px] text-muted"
                numberOfLines={2}
              >
                {item.project_name} ·{" "}
                {isChange(item)
                  ? `${t("notifications.attendance.changeTitle")}: ${t(
                      "notifications.attendance.changeLine",
                      {
                        from: shiftLabel(
                          item.shift_type,
                          item.supplement_hours,
                        ),
                        to: shiftLabel(
                          item.proposed_shift_type,
                          item.proposed_supplement_hours,
                        ),
                      },
                    )}`
                  : shiftLabel(item.shift_type, item.supplement_hours)}
              </Text>
              <View className="flex-row gap-2">
                <Pressable
                  testID={`attendance-validate-${item.entry_id}`}
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => approve(item)}
                  className="h-8 flex-1 items-center justify-center rounded-full bg-positive active:opacity-70"
                >
                  <Text className="font-sans-semibold text-[12.5px] text-on-ink">
                    {isChange(item)
                      ? t("notifications.attendance.validateChange")
                      : t("notifications.attendance.validate")}
                  </Text>
                </Pressable>
                <Pressable
                  testID={`attendance-reject-${item.entry_id}`}
                  accessibilityRole="button"
                  onPress={() => setRejecting(item)}
                  className="h-8 flex-1 items-center justify-center rounded-full border border-line-2 active:opacity-70"
                >
                  <Text className="font-sans-medium text-[12.5px] text-negative">
                    {isChange(item)
                      ? t("notifications.attendance.rejectChange")
                      : t("notifications.attendance.reject")}
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </View>
      <ConfirmDialog
        visible={rejecting !== null}
        title={t(
          rejecting && isChange(rejecting)
            ? "notifications.attendance.rejectChangeConfirm"
            : "notifications.attendance.rejectConfirm",
          {
            worker: rejecting?.worker_name ?? "",
            date: rejecting ? formatDate(rejecting.date) : "",
          },
        )}
        confirmLabel={
          rejecting && isChange(rejecting)
            ? t("notifications.attendance.rejectChange")
            : t("notifications.attendance.reject")
        }
        cancelLabel={t("common.cancel")}
        destructive
        loading={reject.isPending || decide.isPending}
        onCancel={() => setRejecting(null)}
        onConfirm={confirmReject}
      />
    </>
  );
}
