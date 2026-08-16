import { useDropzone } from 'react-dropzone';
//
import { type UploadProps } from './types';
import RejectionFiles from './errors/RejectionFiles';
import AvatarPreview from './preview/AvatarPreview';
import { ImagePlus } from 'lucide-react';
import { Typography } from '@/components/ui/typography';
import { cn } from '@/lib/utils';

export default function UploadAvatar({
  error,
  file,
  disabled,
  helperText,
  ...other
}: Readonly<UploadProps>) {
  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    multiple: false,
    disabled,
    ...other,
  });

  const hasFile = !!file;

  const isError = isDragReject || !!error;

  return (
    <>
      <div
        {...getRootProps()}
        className={cn(
          "w-36 h-36 mx-auto flex cursor-pointer overflow-hidden rounded-full items-center relative justify-center border border-dashed border-gray-400 transition-opacity",
          isDragActive && "opacity-70",
          isError && "border-red-300",
          isError && hasFile && "bg-red-50",
          disabled && "opacity-50 pointer-events-none",
          hasFile && "hover:[&_.placeholder]:opacity-100"
        )}
      >
        <input {...getInputProps()} />

        {hasFile && <AvatarPreview file={file} />}

        <div
          className={cn(
            "w-[calc(100%-16px)] h-[calc(100%-16px)] placeholder z-7 flex rounded-full absolute items-center flex-col justify-center text-gray-600 bg-gray-50 transition-opacity hover:opacity-70",
            hasFile && "z-10 opacity-0 text-white bg-gray-900/60",
            isError && "text-red-600 bg-red-50"
          )}
        >
          <ImagePlus className='mb-2' />
          <Typography variant="caption">{file ? 'Update photo' : 'Upload photo'}</Typography>
        </div>
      </div>

      {helperText}

      <RejectionFiles fileRejections={fileRejections} />
    </>
  );
}