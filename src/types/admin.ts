export interface AdminReport {
  id: string;
  reporterId: string;
  reporterName?: string;
  targetType: 'post' | 'comment' | 'seller' | 'product' | 'clinic' | 'user';
  targetId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface VerificationCandidate {
  id: string;
  name: string;
  type: 'vet' | 'seller' | 'clinic';
  licenseOrTaxId: string;
  country: string;
  submittedAt: string;
  status: 'pending' | 'verified' | 'rejected';
}
