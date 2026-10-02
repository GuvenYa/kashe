-- =============================================================================
-- FAZ 7a / 02 — Hic gonderilmemis taslak teklif silinebilir (P1 canli turu: bos teklif kaldirilamiyordu)
--
-- Kural: yalniz `status = draft` ve hicbir surumu gonderilmemis (sent_at NULL) teklif, kurulusta `proposals.manage` olan uye
-- tarafindan silinir. Surumler / kalemler / ic kalemler CASCADE ile gider; gonderilmemis teklifin portal baglantisi zaten yoktur.
-- Gonderilmis teklif SILINMEZ (musteriye ulasmis belge): satici `proposal_set_status(..., 'declined')` ile kapatir.
--
-- Idempotan. Sapkali harf yok. VERI YAZMAZ.
-- =============================================================================

BEGIN;

GRANT DELETE ON TABLE public.proposals TO authenticated;

DROP POLICY IF EXISTS proposals_delete ON public.proposals;
CREATE POLICY proposals_delete ON public.proposals FOR DELETE TO authenticated
  USING (public.has_org_permission(seller_organization_id, 'proposals.manage')
         AND status = 'draft'
         AND NOT EXISTS (SELECT 1 FROM public.proposal_versions v WHERE v.proposal_id = proposals.id AND v.sent_at IS NOT NULL));

COMMENT ON POLICY proposals_delete ON public.proposals IS 'FAZ 7a/02: yalniz hic gonderilmemis taslak; gonderilmis teklif kapatilir (declined), silinmez.';

COMMIT;
