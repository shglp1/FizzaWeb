import { supabase } from '@/lib/supabase/client';
export const authService = {
  login: (email:string,password:string)=>supabase.auth.signInWithPassword({email,password}),
  register: (email:string,password:string,fullName:string,phone:string)=>supabase.auth.signUp({email,password,options:{data:{full_name:fullName,phone}}}),
  logout: ()=>supabase.auth.signOut(),
  resetPassword:(email:string)=>supabase.auth.resetPasswordForEmail(email,{redirectTo:process.env.NEXT_PUBLIC_APP_URL+'/reset-password'})
};
