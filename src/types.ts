export type PinKind = 'hangout' | 'activity';
export type RequestStatus = 'pending' | 'accepted' | 'declined';
export type Screen = 'map' | 'chats' | 'profile' | 'chat';

export type Profile = {
  id: string;
  name: string;
  instagram: string;
  instagramVerified?: boolean;
  instagramId?: string;
  bio: string;
  interests: string[];
  email?: string;
  googleId?: string;
  photoUrl?: string;
  isPro?: boolean;
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
  featured?: boolean;
  socialLeader?: boolean;
  badges?: string[];
  area?: string;
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
};

export type MapPlace = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  kind: string;
  emoji: string;
};

export type AppNotice = {
  id: string;
  type: 'join' | 'accepted' | 'message';
  title: string;
  body: string;
  chatId?: string;
  pinId?: string;
};
