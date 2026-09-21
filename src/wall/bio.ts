import type { WallPost } from '../types';
import {
  PIN_COVERS_MARK,
  WALL_POSTS_MARK,
  bioMarkPayload,
  visibleBio,
} from '../utils';

function compactPost(post: WallPost): WallPost | null {
  const text = String(post?.text || '').trim().slice(0, 280);
  if (!post?.id || text.length < 2) return null;
  const photo = String(post.fromPhoto || '');
  return {
    id: String(post.id),
    fromId: String(post.fromId || ''),
    fromName: String(post.fromName || 'Biri').slice(0, 40),
    fromPhoto: photo.startsWith('data:') ? '' : photo.slice(0, 400),
    text,
    createdAt: Number(post.createdAt) || Date.now(),
    likeCount: Number(post.likeCount) || 0,
  };
}

export function readWallFromBio(bio?: string | null): WallPost[] {
  const raw = bioMarkPayload(String(bio || ''), WALL_POSTS_MARK);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((p) => compactPost(p as WallPost)).filter(Boolean) as WallPost[];
  } catch {
    return [];
  }
}

export function withWallInBio(bio: string, posts: WallPost[]) {
  const visible = visibleBio(bio);
  const covers = bioMarkPayload(bio, PIN_COVERS_MARK);
  const packed = posts.map(compactPost).filter(Boolean).slice(0, 24);
  let out = visible;
  if (covers) out += `\n${PIN_COVERS_MARK}${covers}`;
  if (packed.length) out += `\n${WALL_POSTS_MARK}${JSON.stringify(packed)}`;
  return out;
}
