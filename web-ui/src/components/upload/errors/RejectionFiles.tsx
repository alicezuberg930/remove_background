import { type FileRejection } from "react-dropzone";
// utils
import { fData } from "@/lib/format-number";
// components
import { fileData } from "@/components/file-thumbnail";
import { Card } from "@/components/ui/card";
import { Typography } from "@/components/ui/typography";

type Props = {
  fileRejections: readonly FileRejection[];
};

export default function RejectionFiles({ fileRejections }: Readonly<Props>) {
  if (!fileRejections.length) return null;

  return (
    <Card className="gap-0 py-2 mt-8 bg-red-50 border-red-300">
      {fileRejections.map(({ file, errors }) => {
        const { path, size } = fileData(file);

        return (
          <div key={path} className="my-2 flex flex-col">
            <Typography variant="caption" className="font-semibold w-fit">
              {path} - {size ? fData(size) : ""}
            </Typography>

            {errors.map((error) => (
              <Typography key={error.code} variant="p" className="m-0">
                - {error.message}
              </Typography>
            ))}
          </div>
        );
      })}
    </Card>
  );
}
