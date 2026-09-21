export type PinKind = 'hangout' | 'activity' | 'chat';
export type RequestStatus = 'pending' | 'accepted' | 'declined';
export type Screen = 'discover' | 'map' | 'chats' | 'profile' | 'chat';

export type MapPlace = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  kind: string;
  emoji: string;
  category?: string;
  area?: string;
  meters?: number;
};

export type MapIntent =
  | { type: 'focus'; pinId: string }
  | { type: 'compose' };

export type WallMark = {
  id: string;
  text: string;
  kind: PinKind;
  placeName: string;
  createdAt: number;
  anonymous?: boolean;
  live?: boolean;
  photoUrl?: string;
};

export type WallMoment = {
  id: string;
  title: string;
  photoUrl?: string;
  createdAt?: number;
};

export type WallPost = {
  id: string;
  fromId: string;
  fromName?: string;
  fromPhoto?: string;
  text: string;
  createdAt: number;
  likeCount?: number;
  liked?: boolean;
};

export type WallReview = {
  id: string;
  fromId?: string;
  text?: string;
  placeName?: string;
  at?: number;
  createdAt?: number;
};

export type Gender = 'woman' | 'man' | 'other' | 'unspecified';

export type Profile = {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  age?: number;
  birthDate?: string;
  gender?: Gender;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  vibeNote?: string;
  bio: string;
  interests: string[];
  stats?: { marks: number; meets: number; followers?: number; following?: number };
  wallMarks?: WallMark[];
  wallPosts?: WallPost[];
  moments?: WallMoment[];
  reviews?: WallReview[];
  followingIds?: string[];
  email?: string;
  googleId?: string;
  photoUrl?: string;
  photos?: string[];
  isPro?: boolean;
  adMarksToday?: number;
  dailyPinLimit?: number;
  proPlan?: 'monthly' | 'yearly';
  onboarded?: boolean;
  badges?: string[];
  socialLeader?: boolean;
  safeShare?: { token: string; expiresAt: number; url: string } | null;
};

export type Pin = {
  id: string;
  authorId: string;
  text: string;
  kind: PinKind;
  lat: number;
  lng: number;
  createdAt: number;
  expiresAt: number;
  meetAt: number;
  placeName: string;
  coming: number;
  capacity?: 2 | 3 | 4;
  anonymous?: boolean;
  retiredAt?: number;
  featured?: boolean;
  socialLeader?: boolean;
  badges?: string[];
  area?: string;
  photoUrl?: string;
};

export type JoinRequest = {
  id: string;
  pinId: string;
  fromId: string;
  status: RequestStatus;
};

export type ChatMessage = {
  id: string;
  fromId: string;
  text: string;
  at: number;
  imageUrl?: string;
};

export type ChatThread = {
  id: string;
  pinId: string;
  memberIds: string[];
  messages: ChatMessage[];
  closesAt: number;
  needsCheckin?: boolean;
  myCheckin?: boolean | null;
};

export type MapPinPayload = {
  id: string;
  lat: number;
  lng: number;
  text: string;
  kind: PinKind;
  mine: boolean;
  coming: number;
  meetLabel: string;
  featured?: boolean;
  socialLeader?: boolean;
  authorName: string;
  photoUrl?: string;
  capacity?: 2 | 3 | 4;
  quotaLabel?: string;
};

export type AppNotice = {
  id: string;
  type: 'join' | 'accepted' | 'message' | 'filled' | 'follow_mark';
  title: string;
  body: string;
  chatId?: string;
  pinId?: string;
};
