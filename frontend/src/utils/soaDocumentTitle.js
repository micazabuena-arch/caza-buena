export const SOA_DOCUMENT_TYPES = {
  soa: {
    id: 'soa',
    label: 'STATEMENT OF ACCOUNT',
    printLabel: 'Print statement of account',
  },
  confirmation: {
    id: 'confirmation',
    label: 'BOOKING CONFIRMATION',
    printLabel: 'Print booking confirmation',
  },
};

export function resolveSoaDocumentTitle(docType) {
  return SOA_DOCUMENT_TYPES[docType]?.label || SOA_DOCUMENT_TYPES.soa.label;
}
