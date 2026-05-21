import { supabase } from '@/lib/supabase/client';
export const riderService = {
 list: async()=> supabase.from('riders').select('*').order('created_at',{ascending:false}),
 create: async(payload:Record<string,unknown>)=>supabase.from('riders').insert(payload).select().single(),
 update: async(id:string,payload:Record<string,unknown>)=>supabase.from('riders').update(payload).eq('id',id).select().single()
};
