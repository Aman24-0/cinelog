import { initTRPC } from '@trpc/server';

const t = initTRPC.create(); // transformer hata diya

export const router = t.router;
export const publicProcedure = t.procedure;
