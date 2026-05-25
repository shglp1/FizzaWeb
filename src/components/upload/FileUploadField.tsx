'use client';

import { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { Button, Alert } from '@/components/ui';

export type UploadCategory =
  | 'profile-avatar'
  | 'rider-avatar'
  | 'safety-attachment'
  | 'driver-document'
  | 'driver-vehicle-photo';

const CATEGORY_META: Record<
  UploadCategory,
  { label: string; accept: string; hint: string; imagePreview?: boolean }
> = {
  'profile-avatar': {
    label: 'Profile photo',
    accept: 'image/jpeg,image/png,image/webp',
    hint: 'JPEG, PNG or WebP · max 5 MB · shown on your profile',
    imagePreview: true,
  },
  'rider-avatar': {
    label: 'Rider photo',
    accept: 'image/jpeg,image/png,image/webp',
    hint: 'JPEG, PNG or WebP · max 5 MB · shown on rider cards',
    imagePreview: true,
  },
  'safety-attachment': {
    label: 'Evidence photo',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
    hint: 'Photo or PDF · max 5 MB · attached to your safety report',
    imagePreview: true,
  },
  'driver-document': {
    label: 'Document',
    accept: 'image/jpeg,image/png,image/webp,application/pdf',
    hint: 'License, ID or insurance · JPEG, PNG, WebP or PDF · max 5 MB',
  },
  'driver-vehicle-photo': {
    label: 'Vehicle photo',
    accept: 'image/jpeg,image/png,image/webp',
    hint: 'Clear photo of your vehicle · JPEG, PNG or WebP · max 5 MB',
    imagePreview: true,
  },
};

export async function uploadUserFile(category: UploadCategory, file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append('category', category);
  const res = await fetch('/api/uploads', { method: 'POST', body: form });
  const json = await res.json();
  if (!res.ok || !json.data?.url) {
    throw new Error(json.error?.message ?? 'Upload failed');
  }
  return json.data.url as string;
}

export function FileUploadField({
  category,
  value,
  onChange,
  disabled,
  label,
}: {
  category: UploadCategory;
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
  /** Override default category label */
  label?: string;
}) {
  const meta = CATEGORY_META[category];
  const displayLabel = label ?? meta.label;
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const isImage = value && /\.(jpe?g|png|webp)(\?|$)/i.test(value);

  async function handleFile(file: File | undefined) {
    if (!file || disabled) return;
    setError('');
    setUploading(true);
    try {
      const url = await uploadUserFile(category, file);
      onChange(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-start gap-3">
        {value && meta.imagePreview && isImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className="h-16 w-16 rounded-xl object-cover border border-gray-200" />
        ) : value ? (
          <div className="h-16 w-16 rounded-xl border border-gray-200 bg-gray-50 flex items-center justify-center">
            {isImage ? <ImageIcon className="h-6 w-6 text-gray-400" /> : <FileText className="h-6 w-6 text-gray-400" />}
          </div>
        ) : null}

        <div className="flex-1 min-w-[200px] space-y-2">
          <p className="text-sm font-medium text-gray-800">{displayLabel}</p>
          <p className="text-xs text-gray-500">{meta.hint}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={uploading}
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-1 inline" />
              {value ? 'Replace file' : 'Choose file'}
            </Button>
            {value && (
              <Button type="button" variant="ghost" size="sm" disabled={disabled || uploading} onClick={() => onChange(null)}>
                <X className="h-4 w-4 mr-1 inline" />Remove
              </Button>
            )}
          </div>
          {value && (
            <p className="text-xs text-emerald-700 truncate" title={value}>Uploaded · ready to save</p>
          )}
        </div>
      </div>
      {error && <Alert variant="error">{error}</Alert>}
      <input
        ref={inputRef}
        type="file"
        accept={meta.accept}
        className="sr-only"
        disabled={disabled || uploading}
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
