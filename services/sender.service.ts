import { api } from '@/lib/api'
export interface Sender { id:string; email:string; name?:string }
export function getSenders() { return api<{data:Sender[]}>('/senders') }
