import { requireAccountUser } from "@/lib/auth";
import { StudyWorkspace } from "./study-workspace";

export const dynamic = "force-dynamic";

export default async function StudyPage({
  params,
}: {
  params: Promise<{ courseId: string; chapter: string }>;
}) {
  const route = await params;
  await requireAccountUser();
  return (
    <StudyWorkspace
      initialCourseId={route.courseId}
      initialChapterNumber={Number(route.chapter)}
    />
  );
}
