import { fileData, fileFormat, fileThumb } from "./utils";
import DownloadButton from "./DownloadButton";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FileIconProps = {
  file: File | string;
  tooltip?: boolean;
  imageView?: boolean;
  onDownload?: VoidFunction;
  imageProps?: React.ImgHTMLAttributes<HTMLImageElement>;
  fileProps?: React.ImgHTMLAttributes<HTMLImageElement>;
};

export default function FileThumbnail({
  file,
  tooltip,
  imageView,
  onDownload,
  imageProps,
  fileProps,
}: Readonly<FileIconProps>) {
  const { name = "", path = "", preview = "" } = fileData(file);

  const format = fileFormat(path || preview);

  const renderContent =
    format === "image" && imageView ? (
      <img
        src={preview}
        {...imageProps}
        className={cn(
          "shrink-0 w-full h-full object-cover",
          imageProps?.className,
        )}
      />
    ) : (
      <img
        src={fileThumb(format)}
        {...fileProps}
        className={cn("w-8 h-8 shrink-0", fileProps?.className)}
      />
    );

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <div className="shrink-0 items-center flex flex-col justify-center w-fit" />
          }
        >
          {renderContent}
          {onDownload && <DownloadButton onDownload={onDownload} />}
        </TooltipTrigger>
        <TooltipContent>{name}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <>
      {renderContent}
      {onDownload && <DownloadButton onDownload={onDownload} />}
    </>
  );
}
