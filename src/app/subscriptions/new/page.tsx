'use client';
import { AppShell } from '@/components/layout/AppShell';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const schema = z.object({
  subscriptionType: z.enum(['school', 'university']),
  pickup: z.string().min(3, { message: 'String must contain at least 3 character(s)' }),
  dropoff: z.string().min(3, { message: 'String must contain at least 3 character(s)' }),
  pickupTime: z.string().min(1, { message: 'Required' }),
  returnTime: z.string().min(1, { message: 'Required' })
});

type FormValues = z.infer<typeof schema>;

const resolver = (values: any) => {
  const result = schema.safeParse(values);
  if (result.success) {
    return {
      values: result.data,
      errors: {},
    };
  }

  const errors: Record<string, { type: string; message: string }> = {};
  result.error.issues.forEach((issue) => {
    const path = issue.path.join('.');
    errors[path] = {
      type: issue.code,
      message: issue.message,
    };
  });

  return {
    values: {},
    errors,
  };
};

export default function Page(){
  const {register,handleSubmit,formState:{errors}}=useForm<FormValues>({resolver});
  return <AppShell>
    <h1 className='text-2xl font-semibold'>Create Subscription</h1>
    <form className='card mt-4 grid md:grid-cols-2 gap-3' onSubmit={handleSubmit(()=>{})}>
      <select className='input' {...register('subscriptionType')}>
        <option value='school'>School</option>
        <option value='university'>University</option>
      </select>
      <input className='input' placeholder='Pickup' {...register('pickup')}/>
      <input className='input' placeholder='Drop-off' {...register('dropoff')}/>
      <input className='input' type='time' {...register('pickupTime')}/>
      <input className='input' type='time' {...register('returnTime')}/>
      <button className='btn-primary md:col-span-2'>Submit subscription</button>
      <p className='text-red-500 text-xs md:col-span-2'>{Object.values(errors)[0]?.message as string}</p>
    </form>
  </AppShell>
}
