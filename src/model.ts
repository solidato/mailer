export type ResolutionType = {
  noticePeriod: string;
  votingPeriod: string;
};

export type ResolutionData = {
  id: string;
  createTimestamp?: string;
  createBy?: string;
  approveTimestamp?: string;
  votingStarts?: string;
  resolutionType?: ResolutionType;
};

export type ContributorData = {
  address: string;
};

export type OfferData = {
  id: string;
  from: string;
  amount: number;
  createTimestamp: string;
};
