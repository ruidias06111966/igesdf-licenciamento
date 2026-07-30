import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

let restored: Promise<Session | null> | undefined;

/**
 * Espera que o cliente Supabase restaure a sessão do localStorage.
 * Em SSR/hidratação, getSession() pode devolver null antes da restauração
 * terminar — o que causava um redirecionamento indevido para /auth e
 * obrigava a atualizar a página duas vezes.
 */
export function getRestoredSession(): Promise<Session | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (!restored) {
    restored = new Promise<Session | null>((resolve) => {
      let done = false;
      const finish = (s: Session | null) => {
        if (done) return;
        done = true;
        sub.data.subscription.unsubscribe();
        resolve(s);
      };
      const sub = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "INITIAL_SESSION" || session) finish(session ?? null);
      });
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) finish(data.session);
      });
      setTimeout(() => finish(null), 4000);
    }).then((s) => {
      restored = undefined; // permite reavaliar em navegações futuras
      return s;
    });
  }
  return restored;
}

/** Sessão atual, aguardando a restauração inicial se necessário. */
export async function getCurrentSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  return getRestoredSession();
}
