'use client';
import { AuthForm } from '@/components/forms/AuthForm';
import { loginSchema } from '@/lib/validations/auth';
import { authService } from '@/services/authService';
export default function Page(){return <main className='max-w-md mx-auto p-4'><div className='card'><h1 className='text-2xl font-semibold mb-3'>Login</h1><AuthForm schema={loginSchema} submitLabel='Login' onSubmit={async(v)=>{await authService.login(v.email,v.password);}}/></div></main>}
