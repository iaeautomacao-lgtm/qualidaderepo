import { created, route } from "@/server/http";
import { requireSession } from "@/server/security/sessions";
import { receiveUpload } from "@/server/services/upload-service";

export async function POST(request) {
  return route(request, async () => {
    const session = await requireSession();
    const formData = await request.formData();
    const files = formData.getAll("files");
    return created(await receiveUpload({ files, userId: session.user.id }));
  });
}
