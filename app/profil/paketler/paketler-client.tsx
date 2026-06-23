'use client';

import { useState } from 'react';
import { PackageModal } from './package-modal';
import { PackageCard } from './package-card';
import type { ServicePackage } from '@/app/lib/types';

type Props = {
  packages: ServicePackage[];
};

export function PaketlerClient({ packages }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<ServicePackage | null>(
    null
  );

  function openCreate() {
    setEditingPackage(null);
    setModalOpen(true);
  }

  function openEdit(pkg: ServicePackage) {
    setEditingPackage(pkg);
    setModalOpen(true);
  }

  function close() {
    setModalOpen(false);
    setEditingPackage(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <p className="text-ink-72">
          {packages.length === 0
            ? 'Henüz paket oluşturmadın.'
            : `${packages.length} paket — ${packages.filter((p) => p.is_active).length} aktif`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          + Yeni paket oluştur
        </button>
      </div>

      {packages.length === 0 ? (
        <div className="bg-card border border-line rounded-lg p-12 text-center">
          <p className="font-display text-2xl text-ink mb-3">
            İlk paketini oluştur.
          </p>
          <p className="text-ink-72 max-w-md mx-auto">
            Örneğin &quot;Düğün Paketi&quot;: performans + ekipman + ışık hepsi
            bir arada, tek fiyatla. Müşterinin kafası karışmaz, doğrudan paketi
            seçer.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onEdit={() => openEdit(pkg)}
            />
          ))}
        </div>
      )}

      <PackageModal open={modalOpen} onClose={close} pkg={editingPackage} />
    </>
  );
}
