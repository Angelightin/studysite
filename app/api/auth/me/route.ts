import { getUser } from "@/lib/auth";
export async function GET(request:Request){const user=await getUser(request);return user?Response.json({user}):Response.json({error:"Требуется вход"},{status:401});}
