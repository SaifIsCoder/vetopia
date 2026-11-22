export interface MembershipPlan {
  id: string;
  name: string;
  priceUsd: number;
  interval: 'year' | 'month';
  perks: string[];
  isPopular?: boolean;
}

export const VIP_MEMBERSHIP_PLAN: MembershipPlan = {
  id: 'pets_club_vip_annual',
  name: 'Annual VIP Care Membership',
  priceUsd: 29,
  interval: 'year',
  perks: [
    '1 free veterinary video consultation included',
    '10% discount on all consultations and second opinions',
    '24/7 priority triage queue access',
    'AI-powered smart care & nutrition recommendations',
    'Free shipping on marketplace orders over $50',
    'Exclusive pet club badges & event invites',
    '30-day money-back satisfaction guarantee',
  ],
  isPopular: true,
};
