import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Badge, Card, EmptyState } from "@/components/ui/primitives";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import {
  NOTE_CATEGORIES,
  useCreateNote,
  useDeleteNote,
  useNotes,
  useUpdateNote,
} from "@/features/notes/notes-api";
import type { Note, NoteCategory } from "@/features/notes/notes-api";
import { formatDate } from "@/lib/format/date";
import { useRefetchOnFocus } from "@/lib/query/use-refetch-on-focus";

/** Project journal: category chips + search, date-grouped cards, open/done toggle, create/edit/delete. */
export default function ProjectNotesSection() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const notes = useNotes(id);
  const create = useCreateNote(id);
  const update = useUpdateNote(id);
  const remove = useDeleteNote(id);
  useRefetchOnFocus(notes.refetch);

  const [category, setCategory] = useState<NoteCategory | "all">("all");
  const [search, setSearch] = useState("");
  const sheet = useRef<BottomSheetModal>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [draftCategory, setDraftCategory] = useState<NoteCategory>("general");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Note | null>(null);

  const sections = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const filtered = (notes.data ?? []).filter((note) => {
      if (category !== "all" && note.category !== category) return false;
      if (
        needle &&
        !`${note.title} ${note.description ?? ""}`
          .toLowerCase()
          .includes(needle)
      )
        return false;
      return true;
    });
    const map = new Map<string, Note[]>();
    for (const note of filtered)
      map.set(note.created_at.slice(0, 10), [
        ...(map.get(note.created_at.slice(0, 10)) ?? []),
        note,
      ]);
    return Array.from(map.entries()).sort(([a], [b]) => b.localeCompare(a));
  }, [notes.data, category, search]);

  function openForm(note: Note | null) {
    setEditing(note);
    setTitle(note?.title ?? "");
    setDescription(note?.description ?? "");
    setDraftCategory(note?.category ?? "general");
    setTitleError(null);
    sheet.current?.present();
  }

  function submit() {
    const trimmed = title.trim();
    if (!trimmed) return setTitleError(t("notes.titleRequired"));
    const body = {
      title: trimmed,
      description: description.trim() || null,
      category: draftCategory,
    };
    const done = { onSuccess: () => sheet.current?.dismiss() };
    if (editing) update.mutate({ noteId: editing.id, ...body }, done);
    else create.mutate(body, done);
  }

  const categoryOptions = NOTE_CATEGORIES.map((value) => ({
    value,
    label: t(`notes.categories.${value}`),
  }));

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="max-h-11 border-b border-border"
        contentContainerClassName="px-2 items-center"
      >
        {(["all", ...NOTE_CATEGORIES] as const).map((value) => (
          <Pressable
            key={value}
            testID={`notes-cat-${value}`}
            onPress={() => setCategory(value)}
            className={`mr-2 rounded-full border px-3 py-1 ${category === value ? "border-primary bg-primary" : "border-border"}`}
          >
            <Text
              className={
                category === value
                  ? "text-xs text-primary-foreground"
                  : "text-xs text-primary"
              }
            >
              {value === "all"
                ? t("invoices.all")
                : t(`notes.categories.${value}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      <ScrollView contentContainerClassName="p-4 pb-12">
        <View className="mb-3 flex-row items-center gap-2">
          <TextInput
            testID="notes-search"
            className="flex-1 rounded-lg border border-border px-4 py-2 text-base text-primary"
            placeholder={t("notes.searchPlaceholder")}
            placeholderTextColor="#a3a3a3"
            value={search}
            onChangeText={setSearch}
          />
          <Button
            testID="notes-create"
            label="＋"
            size="sm"
            onPress={() => openForm(null)}
          />
        </View>
        {notes.isPending ? <ActivityIndicator className="mt-8" /> : null}
        {!notes.isPending && sections.length === 0 ? (
          <EmptyState message={t("notes.none")} />
        ) : null}
        {sections.map(([day, items]) => (
          <View key={day} className="mb-3">
            <Text className="mb-1 text-xs font-medium uppercase text-muted-foreground">
              {formatDate(day)}
            </Text>
            {items.map((note) => (
              <Pressable
                key={note.id}
                testID={`note-${note.id}`}
                onPress={() => openForm(note)}
              >
                <Card
                  className={`mb-2 ${note.status === "done" ? "opacity-60" : ""}`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`flex-1 pr-2 text-base font-medium text-primary ${note.status === "done" ? "line-through" : ""}`}
                    >
                      {note.title}
                    </Text>
                    <Badge label={t(`notes.categories.${note.category}`)} />
                  </View>
                  {note.description ? (
                    <Text className="mt-1 text-sm text-primary">
                      {note.description}
                    </Text>
                  ) : null}
                  <View className="mt-2 flex-row gap-4">
                    <Pressable
                      testID={`note-toggle-${note.id}`}
                      onPress={() =>
                        update.mutate({
                          noteId: note.id,
                          status: note.status === "done" ? "open" : "done",
                        })
                      }
                    >
                      <Text className="text-sm text-primary">
                        {note.status === "done"
                          ? t("notes.reopen")
                          : t("notes.markDone")}
                      </Text>
                    </Pressable>
                    <Pressable
                      testID={`note-delete-${note.id}`}
                      onPress={() => setDeleting(note)}
                    >
                      <Text className="text-sm text-danger">
                        {t("common.delete")}
                      </Text>
                    </Pressable>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>

      <Sheet
        ref={sheet}
        title={editing ? t("notes.edit") : t("notes.create")}
        snapPoints={["75%"]}
      >
        <View className="p-4">
          <Input
            testID="note-title"
            label={t("notes.title")}
            value={title}
            onChangeText={setTitle}
            error={titleError}
            autoFocus
          />
          <Input
            testID="note-description"
            label={t("notes.description")}
            value={description}
            onChangeText={setDescription}
            multiline
          />
          <Select<NoteCategory>
            testID="note-category"
            label={t("notes.category")}
            value={draftCategory}
            options={categoryOptions}
            onChange={setDraftCategory}
          />
          <Button
            testID="note-submit"
            label={t("common.save")}
            loading={create.isPending || update.isPending}
            onPress={submit}
          />
        </View>
      </Sheet>
      <ConfirmDialog
        visible={deleting !== null}
        title={t("notes.deleteConfirm", { title: deleting?.title ?? "" })}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        destructive
        loading={remove.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          deleting &&
          remove.mutate(
            { noteId: deleting.id },
            { onSettled: () => setDeleting(null) },
          )
        }
      />
    </View>
  );
}
