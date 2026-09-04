import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";

import { AuthedImage } from "@/components/ui/authed-image";
import { useProjectPhotos } from "@/features/photos/photos-api";

/** Horizontal strip of the latest site photos; tapping opens the photos section. */
export function CoverPhotosStrip({ projectId }: { projectId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const photos = useProjectPhotos(projectId);
  const items = photos.data?.items.slice(0, 8) ?? [];

  if (photos.isPending || items.length === 0) return null;

  return (
    <View className="mt-4">
      <Text className="mb-2 text-sm font-medium text-muted-foreground">
        {t("project.sections.photos")}
      </Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        testID="cover-photos-strip"
      >
        {items.map((photo) => (
          <Pressable
            key={photo.id}
            onPress={() => router.navigate(`/projects/${projectId}/photos`)}
            className="mr-2 h-24 w-24 overflow-hidden rounded-lg bg-paper-2"
          >
            <AuthedImage
              path={photo.thumbnail_url}
              style={{ width: 96, height: 96 }}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
