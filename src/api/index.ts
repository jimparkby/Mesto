import { createDemoBackend } from './mock/demoBackend';
import { createSupabaseBackend } from './supabaseBackend';
import type { Backend } from './types';

export type { Backend, Participant, TelegramLoginRequest } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Есть ключи Supabase — работаем с реальной БД, нет — демо-режим на localStorage. */
export const api: Backend = url && key ? createSupabaseBackend(url, key) : createDemoBackend();
