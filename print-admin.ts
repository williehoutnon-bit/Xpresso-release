console.log(Object.keys(process.env).filter(k => k.includes('ROLE') || k.includes('SECRET') || k.includes('SERVICE') || k.includes('ADMIN') || k.includes('SUPABASE')));
