import { api } from '@/lib/api'
export interface Email { id:string; recipient:string; recipientName:string; sender:string; subject:string; bodyPreview:string; scheduledAt:string|null; sentAt:string|null; status:'scheduled'|'sent'|'failed'; body?:string; attachments?:{name:string;size?:string}[]; previewUrl?:string }
export interface EmailPage { data:Email[]; pagination:{page:number;limit:number;total:number;totalPages:number} }
export async function getEmails(params:{status:string;search:string;page:number;limit:number}) { const q=new URLSearchParams(params as unknown as Record<string,string>); return (await api<EmailPage>(`/emails?${q}`)).data }
export function getEmail(id:string) { return api<Email>(`/emails/${encodeURIComponent(id)}`) }
export function scheduleEmail(data:{senderId:string;recipients:string[];subject:string;body:string;scheduledAt:string;delayBetweenEmails:number;hourlyLimit:number}) { return api('/emails/schedule',{method:'POST',body:JSON.stringify(data)}) }
export function rescheduleEmail(id:string,scheduledAt:string) { return api(`/emails/${encodeURIComponent(id)}/reschedule`,{method:'PATCH',body:JSON.stringify({scheduledAt})}) }
export function cancelEmail(id:string) { return api(`/emails/${encodeURIComponent(id)}`,{method:'DELETE'}) }
