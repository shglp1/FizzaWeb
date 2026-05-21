'use client';
import { AuthForm } from '@/components/forms/AuthForm';
import { registerSchema } from '@/lib/validations/auth';
import { authService } from '@/services/authService';
export default function Page(){return <main className='max-w-md mx-auto p-4'><div className='card'><h1 className='text-2xl font-semibold mb-3'>Register</h1><AuthForm schema={registerSchema} submitLabel='Create account' onSubmit={async(v)=>{await authService.register(v.email,v.password,v.fullName,v.phone);}}/></div></main>}
