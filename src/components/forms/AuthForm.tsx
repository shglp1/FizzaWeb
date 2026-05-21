'use client';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

type Props = {
  schema: z.ZodTypeAny;
  onSubmit: (v: Record<string, string>) => Promise<void> | void;
  submitLabel: string;
};

export function AuthForm({ schema, onSubmit, submitLabel }: Props) {
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm<Record<string, string>>();

  return (
    <form
      onSubmit={handleSubmit(async (values) => {
        const parsed = schema.safeParse(values);
        if (!parsed.success) {
          parsed.error.issues.forEach((issue) => {
            const field = issue.path[0];
            if (typeof field === 'string') setError(field, { type: 'manual', message: issue.message });
          });
          return;
        }
        await onSubmit(parsed.data);
      })}
      className='space-y-3'
    >
      {Object.keys((schema as z.AnyZodObject).shape).map((k) => (
        <div key={k}>
          <input className='input' placeholder={k} type={k.toLowerCase().includes('password') ? 'password' : 'text'} {...register(k)} />
          <p className='text-red-500 text-xs'>{errors[k]?.message as string}</p>
        </div>
      ))}
      <button className='btn-primary w-full' disabled={isSubmitting}>{submitLabel}</button>
    </form>
  );
}
