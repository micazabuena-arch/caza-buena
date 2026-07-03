export const SOA_DOCUMENT_TYPES = {
  soa: {
    id: 'soa',
    label: 'Statement of Account',
    printLabel: 'Print SOA',
  },
  confirmation: {
    id: 'confirmation',
    label: 'Booking Confirmation',
    printLabel: 'Print booking confirmation',
  },
};

export function resolveSoaDocumentTitle(docType) {
  return SOA_DOCUMENT_TYPES[docType]?.label || SOA_DOCUMENT_TYPES.soa.label;
}
