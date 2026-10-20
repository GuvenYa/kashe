'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/app/lib/supabase-server';
import { getCachedUser } from '@/app/lib/auth';
import { GOREV_DURUMLARI, gorevHataMetni } from '@/app/lib/gorevler';

/**
 * FAZ 8a — gorev yazma eylemleri.
 *
 * ILKE (FAZ 7'nin AKSINE): yazma DOGRUDAN TABLOYA. Kurallar
 * `20261021120000_faz8a_01_gorevler.sql` tetikleyicilerinde; RLS `events.manage`
 * istiyor. Burada ticari risk yok (fiyat/marj/jeton uretilmiyor), bu yuzden RPC
 * katmani eklenmedi.
 *
 * Bu dosyanin isi: girdiyi temizlemek, tabloya yazmak ve DB'nin ASCII hata
 * metnini kullaniciya gosterilecek Turkce cumleye cevirmek. KURAL KOPYALAMAZ —
 * ornegin "atanan kisi aktif uye mi" kontrolu burada TEKRAR edilmez; tetikleyici
 * onu zaten reddeder ve mesaji eslenir. Iki yerde yazilan bir kural kayar.
 *
 * `service_role` KULLANILMAZ: islem kullanicinin oturumuyla, RLS altinda gider.
 */
export type GorevSonucu = { ok: true; id?: string } | { ok: false; hata: string };

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidMi(v: unknown): v is string {
  return typeof v === 'string' && UUID.test(v);
}

/** Etkilenen yuzeyleri tazeler. */
function tazele(eventId?: string | null) {
  revalidatePath('/kurulus/gorevler');
  revalidatePath('/ajans');
  revalidatePath('/kurumsal');
  revalidatePath('/profil');
  if (eventId) revalidatePath(`/etkinliklerim/${eventId}`);
}

export type GorevGirdisi = {
  organizationId: string;
  title: string;
  eventId?: string | null;
  description?: string | null;
  status?: string;
  /** `user:<uuid>` ya da `talent:<uuid>`; bos dizge = atanmamis. */
  atanan?: string | null;
  dueAt?: string | null;
  isMilestone?: boolean;
  dependsOnTaskId?: string | null;
};

/** `atanan` alanini iki sutuna cozer. Iki sutun AYNI ANDA dolmaz. */
function atananCoz(atanan: string | null | undefined): {
  assignee_user_id: string | null;
  assignee_talent_record_id: string | null;
} | null {
  if (!atanan) {
    return { assignee_user_id: null, assignee_talent_record_id: null };
  }
  const [tur, kimlik] = atanan.split(':');
  if (!uuidMi(kimlik)) return null;
  if (tur === 'user') {
    return { assignee_user_id: kimlik, assignee_talent_record_id: null };
  }
  if (tur === 'talent') {
    return { assignee_user_id: null, assignee_talent_record_id: kimlik };
  }
  return null;
}

/**
 * `datetime-local` degerini ISO'ya cevirir; bos deger NULL.
 * Dilimsiz deger ("2027-05-14T18:30") ISTANBUL saati sayilir: sunucu UTC'de kosar,
 * `new Date(s)` onu UTC okur ve her kayitta 3 saat kayardi. Istanbul sabit UTC+3
 * (2016'dan beri yaz saati yok) — form `yereleCevir` ile Istanbul'a cevirip gosterir,
 * burada ayni dilimle geri okunur. Dilimli deger (Z / +03:00) oldugu gibi gecer.
 */
function zamanCoz(deger: string | null | undefined): string | null | undefined {
  if (deger === undefined) return undefined;
  const s = (deger ?? '').trim();
  if (!s) return null;
  const dilimsiz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s);
  const d = new Date(dilimsiz ? `${s}${s.length === 16 ? ':00' : ''}+03:00` : s);
  return isNaN(d.getTime()) ? undefined : d.toISOString();
}

export async function gorevOlustur(girdi: GorevGirdisi): Promise<GorevSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };

  if (!uuidMi(girdi.organizationId)) {
    return { ok: false, hata: 'Kuruluş seçimi geçersiz.' };
  }
  const baslik = (girdi.title ?? '').trim();
  if (baslik.length < 2 || baslik.length > 200) {
    return { ok: false, hata: 'Başlık 2–200 karakter olmalı.' };
  }
  if (girdi.eventId && !uuidMi(girdi.eventId)) {
    return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
  }
  if (girdi.dependsOnTaskId && !uuidMi(girdi.dependsOnTaskId)) {
    return { ok: false, hata: 'Bağlanacak görev seçimi geçersiz.' };
  }
  if (girdi.status && !GOREV_DURUMLARI.includes(girdi.status as never)) {
    return { ok: false, hata: 'Durum geçersiz.' };
  }
  const atama = atananCoz(girdi.atanan);
  if (!atama) return { ok: false, hata: 'Atanan kişi seçimi geçersiz.' };
  const sonTarih = zamanCoz(girdi.dueAt);
  if (sonTarih === undefined && girdi.dueAt) {
    return { ok: false, hata: 'Son tarih okunamadı.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      organization_id: girdi.organizationId,
      event_id: girdi.eventId ?? null,
      title: baslik,
      description: girdi.description?.trim() || null,
      status: girdi.status ?? 'todo',
      ...atama,
      due_at: sonTarih ?? null,
      is_milestone: girdi.isMilestone ?? false,
      depends_on_task_id: girdi.dependsOnTaskId ?? null,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[gorev] olustur', error.code, error.message);
    return { ok: false, hata: gorevHataMetni(error) };
  }

  tazele(girdi.eventId);
  return { ok: true, id: (data as { id: string }).id };
}

export type GorevGuncelleme = {
  id: string;
  title?: string;
  description?: string | null;
  status?: string;
  atanan?: string | null;
  dueAt?: string | null;
  isMilestone?: boolean;
  dependsOnTaskId?: string | null;
  eventId?: string | null;
  sortOrder?: number;
};

/**
 * Kismi guncelleme: YALNIZ verilen alanlar yazilir.
 *
 * `undefined` = dokunma, `null` = temizle ayrimi korunur; aksi halde durum
 * degistirmek icin acilan bir istek son tarihi sessizce silerdi.
 */
export async function gorevGuncelle(
  guncelleme: GorevGuncelleme
): Promise<GorevSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(guncelleme.id)) return { ok: false, hata: 'Görev bulunamadı.' };

  const yama: Record<string, unknown> = {};

  if (guncelleme.title !== undefined) {
    const baslik = guncelleme.title.trim();
    if (baslik.length < 2 || baslik.length > 200) {
      return { ok: false, hata: 'Başlık 2–200 karakter olmalı.' };
    }
    yama.title = baslik;
  }
  if (guncelleme.description !== undefined) {
    yama.description = guncelleme.description?.trim() || null;
  }
  if (guncelleme.status !== undefined) {
    if (!GOREV_DURUMLARI.includes(guncelleme.status as never)) {
      return { ok: false, hata: 'Durum geçersiz.' };
    }
    yama.status = guncelleme.status;
  }
  if (guncelleme.atanan !== undefined) {
    const atama = atananCoz(guncelleme.atanan);
    if (!atama) return { ok: false, hata: 'Atanan kişi seçimi geçersiz.' };
    Object.assign(yama, atama);
  }
  if (guncelleme.dueAt !== undefined) {
    const sonTarih = zamanCoz(guncelleme.dueAt);
    if (sonTarih === undefined) return { ok: false, hata: 'Son tarih okunamadı.' };
    yama.due_at = sonTarih;
  }
  if (guncelleme.isMilestone !== undefined) {
    yama.is_milestone = guncelleme.isMilestone;
  }
  if (guncelleme.dependsOnTaskId !== undefined) {
    if (guncelleme.dependsOnTaskId && !uuidMi(guncelleme.dependsOnTaskId)) {
      return { ok: false, hata: 'Bağlanacak görev seçimi geçersiz.' };
    }
    yama.depends_on_task_id = guncelleme.dependsOnTaskId || null;
  }
  if (guncelleme.eventId !== undefined) {
    if (guncelleme.eventId && !uuidMi(guncelleme.eventId)) {
      return { ok: false, hata: 'Etkinlik seçimi geçersiz.' };
    }
    yama.event_id = guncelleme.eventId || null;
  }
  if (guncelleme.sortOrder !== undefined) {
    yama.sort_order = guncelleme.sortOrder;
  }

  if (Object.keys(yama).length === 0) return { ok: true };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .update(yama)
    .eq('id', guncelleme.id)
    .select('id, event_id')
    .maybeSingle();

  if (error) {
    console.error('[gorev] guncelle', error.code, error.message);
    return { ok: false, hata: gorevHataMetni(error) };
  }
  // RLS engellediyse UPDATE 0 satir doner (hata degil) — sessiz basari olmasin.
  if (!data) return { ok: false, hata: 'Bu işlem için yetkin yok.' };

  tazele((data as { event_id: string | null }).event_id);
  return { ok: true, id: guncelleme.id };
}

export async function gorevSil(
  id: string,
  eventId?: string | null
): Promise<GorevSonucu> {
  const user = await getCachedUser();
  if (!user) return { ok: false, hata: 'Oturum gerekiyor.' };
  if (!uuidMi(id)) return { ok: false, hata: 'Görev bulunamadı.' };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[gorev] sil', error.code, error.message);
    return { ok: false, hata: gorevHataMetni(error) };
  }
  if (!data || data.length === 0) {
    return { ok: false, hata: 'Bu işlem için yetkin yok.' };
  }

  tazele(eventId);
  return { ok: true };
}
