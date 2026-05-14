'use client';

import { useState } from 'react';
import { ServiceModal } from './service-modal';
import { ServiceCard } from './service-card';
import type { Service, ServiceCategory, ServiceWithCategory } from '@/app/lib/types';

type Props = {
  services: ServiceWithCategory[];
  categories: ServiceCategory[];
  primaryCategoryId: number | null;
};

export function HizmetlerimClient({ services, categories, primaryCategoryId }: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  function openCreate() {
    setEditingService(null);
    setModalOpen(true);
  }

  function openEdit(service: Service) {
    setEditingService(service);
    setModalOpen(true);
  }

  function close() {
    setModalOpen(false);
    setEditingService(null);
  }

  return (
    <>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <p className="text-ink-72">
          {services.length === 0
            ? 'Henüz hizmet eklemedin.'
            : `${services.length} hizmet — ${services.filter((s) => s.is_active).length} aktif`}
        </p>
        <button
          type="button"
          onClick={openCreate}
          className="px-5 py-2.5 bg-terracotta text-paper rounded-lg font-display font-semibold hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[4px_4px_0_var(--color-terracotta)] transition-all"
        >
          + Yeni hizmet ekle
        </button>
      </div>

      {services.length === 0 ? (
        <div className="bg-white border border-line rounded-lg p-12 text-center">
          <p className="font-display text-2xl text-ink mb-3">
            İlk hizmetini ekle.
          </p>
          <p className="text-ink-72 max-w-md mx-auto">
            Sunduğun her hizmet ayrı bir kalem olarak görünür. Farklı paketler,
            farklı süreler için ayrı hizmetler ekleyebilirsin.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              onEdit={() => openEdit(service)}
            />
          ))}
        </div>
      )}

      <ServiceModal
        open={modalOpen}
        onClose={close}
        categories={categories}
        service={editingService}
        defaultCategoryId={primaryCategoryId}
      />
    </>
  );
}